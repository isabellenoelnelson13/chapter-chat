# Hardcover API Migration + Discover Tab Design

## Overview

Replace the Google Books API with the Hardcover GraphQL API and add a Discover tab with trending books, genre browsing, and personalized recommendations. A Supabase Edge Function acts as a secure proxy so the Hardcover token never lives in the app bundle.

---

## Architecture

### Edge Function: `supabase/functions/books/index.ts`

A single Deno Edge Function handles all Hardcover API calls. The app POSTs to `{SUPABASE_URL}/functions/v1/books` with a JSON body:

```ts
{ action: "search" | "trending" | "by_genre", query?: string, genre?: string, limit?: number }
```

The function routes each action to the corresponding Hardcover GraphQL query, injects the `Authorization: Bearer {HARDCOVER_API_KEY}` header server-side, and returns a normalized array of book objects. CORS headers are included so React Native can call it.

The Hardcover token is stored as a Supabase secret (`HARDCOVER_API_KEY`) — never in the app bundle. The app authenticates to the Edge Function using the existing Supabase anon key (`EXPO_PUBLIC_SUPABASE_ANON_KEY`), passed as `apikey` header.

**Hardcover API endpoint:** `https://api.hardcover.app/v1/graphql`

### Normalized Book Shape

All three actions return the same shape:

```ts
interface BookSearchResult {
  hardcover_id: string;      // Hardcover integer ID stored as string
  title: string;
  author: string;
  cover_url: string | null;  // from book.image.url
  page_count: number | null; // from book.pages
  genres: string[] | null;   // from book.cached_tags (array of tag strings)
  description: string | null;
  rating: number | null;     // Hardcover community rating (0–5)
  users_read_count: number;  // used for popularity sorting
}
```

### GraphQL Queries

**Search:**
```graphql
query SearchBooks($query: String!) {
  search(query: $query, query_type: "Book", per_page: 20) {
    results
  }
}
```
The `results` field is a JSON array of Typesense hit objects. The exact field names must be confirmed by inspecting a live response during implementation — likely `id`, `title`, `author_names[0]`, `image.url`, `pages`, `description`, `rating`, `users_read_count`, and `cached_tags`. If the search results blob does not include all needed fields (e.g. `description`), fall back to a follow-up `books(where: {id: {_in: $ids}})` query to hydrate missing data.

**Trending:**
```graphql
query TrendingBooks($limit: Int!) {
  books(
    order_by: { users_read_count: desc }
    limit: $limit
    where: { users_read_count: { _gt: 100 } }
  ) {
    id
    title
    pages
    description
    image { url }
    contributions { author { name } }
    cached_tags
    rating
    users_read_count
  }
}
```

**By Genre:**
```graphql
query BooksByGenre($genre: String!, $limit: Int!) {
  books(
    where: { taggings: { tag: { tag: { _ilike: $genre } } } }
    order_by: { users_read_count: desc }
    limit: $limit
  ) {
    id
    title
    pages
    description
    image { url }
    contributions { author { name } }
    cached_tags
    rating
    users_read_count
  }
}
```

---

## Database Migration

**File:** `supabase/migrations/002_hardcover.sql`

```sql
-- Rename column
ALTER TABLE books RENAME COLUMN google_books_id TO hardcover_id;

-- Drop old unique constraint, add new one
ALTER TABLE books DROP CONSTRAINT IF EXISTS books_google_books_id_key;
ALTER TABLE books ADD CONSTRAINT books_hardcover_id_key UNIQUE (hardcover_id);
```

`hardcover_id` remains type `text` (Hardcover integer IDs stored as strings for consistency with existing infrastructure).

---

## Type Changes

### `types/database.ts`

In `books.Row`, `books.Insert`, `books.Update`: rename `google_books_id` → `hardcover_id` everywhere.

### `lib/books.ts` — `BookSearchResult`

```ts
export interface BookSearchResult {
  hardcover_id: string;       // was google_books_id
  title: string;
  author: string;
  cover_url: string | null;
  page_count: number | null;
  genres: string[] | null;
  description: string | null;
  rating: number | null;      // new
  users_read_count: number;   // new
}
```

---

## `lib/books.ts` Changes

**Remove:** `fetchBookByGoogleId` (unused at runtime).

**Replace:** `searchBooks(query)` — now POSTs `{ action: "search", query }` to the Edge Function instead of calling Google Books REST API. Parses the normalized response into `BookSearchResult[]`.

**Keep unchanged (except `hardcover_id` rename):** `upsertBook`, `updatePageCount`.

**Add shared helper:**
```ts
async function callBooksFunction(body: object): Promise<BookSearchResult[]>
```
Fetches `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/books` with the anon key header, throws on non-OK, returns parsed JSON.

`upsertBook` conflict key changes from `google_books_id` to `hardcover_id`.

---

## `lib/discover.ts` (new file)

Three exported functions:

```ts
export async function getTrending(limit = 20): Promise<BookSearchResult[]>
// Calls Edge Function { action: "trending", limit }

export async function getBooksByGenre(genre: string, limit = 20): Promise<BookSearchResult[]>
// Calls Edge Function { action: "by_genre", genre, limit }

export async function getRecommended(userId: string): Promise<BookSearchResult[]>
// 1. Queries user's "read" + "reading" shelf from Supabase (joins books table for genres)
// 2. Counts genre frequency across those books, takes top 2
// 3. Calls getBooksByGenre for each, merges, deduplicates by hardcover_id
// 4. Filters out books already on any of the user's shelves
// 5. Returns up to 20 results
```

---

## Discover Tab UI

**File:** `app/(tabs)/discover.tsx`

### Layout

```
[ Trending | For You ]          ← pill toggle at top

[ Fantasy | Romance | Thriller | Sci-Fi | Mystery | Historical | Literary | Non-Fiction ]
                                ← horizontal genre pills, only shown in Trending mode

[ Book card ]
[ Book card ]
[ Book card ]
...
```

### Trending Mode

- Loads `getTrending()` on mount (and on focus via `useFocusEffect`)
- Genre pills filter the list: tapping a pill calls `getBooksByGenre(genre)`, tapping the active pill again resets to full trending
- Book cards: cover image (50×75) + title + author + `★ {rating} · {users_read_count} readers`
- Tapping a card opens `ActionSheetIOS` shelf picker → `upsertBook` + `addToShelf` → `router.back()`-equivalent dismiss

### For You Mode

- Calls `getRecommended(userId)` on tab switch
- If user has < 3 books on any shelf: shows empty state — "Add some books to your library and we'll find recommendations for you."
- Otherwise: same card list as Trending (no genre pills)

### Tab Registration

`app/(tabs)/_layout.tsx` — add Discover tab:
- `name: "discover"`
- `title: "Discover"`
- Icon: `compass-outline` (inactive), `compass` (active)
- Positioned between Library and Social (or after Social — confirm during implementation)

---

## Affected Files Summary

| File | Change |
|------|--------|
| `supabase/migrations/002_hardcover.sql` | New — rename column, update constraint |
| `supabase/functions/books/index.ts` | New — Edge Function proxy |
| `types/database.ts` | `google_books_id` → `hardcover_id` |
| `lib/books.ts` | Replace Google Books calls, rename field, add `rating`/`users_read_count` |
| `lib/discover.ts` | New — `getTrending`, `getBooksByGenre`, `getRecommended` |
| `app/(tabs)/discover.tsx` | New — Discover tab screen |
| `app/(tabs)/_layout.tsx` | Add Discover tab entry |
| `app/search.tsx` | `google_books_id` → `hardcover_id` |
| `app/club/[clubId]/index.tsx` | `google_books_id` → `hardcover_id` |
| `__tests__/lib/books.test.ts` | Update mocks for Edge Function calls |
| `__tests__/lib/discover.test.ts` | New — unit tests for all three functions |
| `__tests__/screens/discover.test.tsx` | New — screen tests |
| `__tests__/screens/search.test.tsx` | Update `google_books_id` → `hardcover_id` |
| `__tests__/screens/clubDetail.test.tsx` | Update `google_books_id` → `hardcover_id` |

---

## Error Handling

- Edge Function returns `{ error: string }` with an appropriate HTTP status on failure
- `callBooksFunction` throws if response is not OK; callers show an `Alert` (existing pattern)
- If Hardcover returns an empty `results` array for search/trending, return `[]` — no throw
- If `getRecommended` cannot determine genres (all shelf books have null genres), fall back to `getTrending`

---

## Testing

### `__tests__/lib/discover.test.ts`
- `getTrending` calls Edge Function with `{ action: "trending", limit: 20 }`
- `getBooksByGenre` calls with `{ action: "by_genre", genre: "fantasy", limit: 20 }`
- `getRecommended` with no shelf books returns trending fallback
- `getRecommended` with shelf books extracts top genres and deduplicates results
- `getRecommended` filters out books already on user's shelves

### `__tests__/screens/discover.test.tsx`
- Renders genre pills and Trending/For You toggle on load
- Default loads trending books
- Tapping genre pill calls `getBooksByGenre` with correct genre
- Tapping active genre pill resets to trending
- For You tab with no books shows empty state message
- For You tab with books shows recommendation cards
