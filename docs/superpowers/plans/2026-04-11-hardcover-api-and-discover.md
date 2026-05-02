# Hardcover API Migration + Discover Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Google Books API with Hardcover GraphQL API via a Supabase Edge Function proxy, and build a Discover tab with trending books, genre browsing, and personalized recommendations.

**Architecture:** A single Supabase Edge Function (`books`) handles all Hardcover API calls server-side, keeping the token out of the app bundle. `lib/books.ts` and a new `lib/discover.ts` call the Edge Function using the existing Supabase anon key. The `books` DB table renames `google_books_id` → `hardcover_id`.

**Tech Stack:** Deno (Edge Function), Hardcover GraphQL API, React Native, Supabase, TypeScript, Jest/RNTL

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/002_hardcover.sql` | Create | Rename DB column, update constraint |
| `supabase/functions/books/index.ts` | Create | Edge Function proxy to Hardcover API |
| `types/database.ts` | Modify | `google_books_id` → `hardcover_id` |
| `lib/books.ts` | Modify | Replace Google Books fetch with Edge Function calls |
| `lib/discover.ts` | Create | `getTrending`, `getBooksByGenre`, `getRecommended` |
| `app/(tabs)/discover.tsx` | Modify | Replace stub with full Discover screen |
| `app/search.tsx` | Modify | `google_books_id` → `hardcover_id` in mock type ref |
| `app/club/[clubId]/index.tsx` | Modify | Rename `google_books_id` → `hardcover_id` in key/testID |
| `__tests__/lib/books.test.ts` | Modify | Update for Edge Function, remove fetchBookByGoogleId |
| `__tests__/lib/discover.test.ts` | Create | Tests for all three discover functions |
| `__tests__/screens/discover.test.tsx` | Create | Discover screen tests |
| `__tests__/screens/search.test.tsx` | Modify | `google_books_id` → `hardcover_id` in mock data |
| `__tests__/screens/clubDetail.test.tsx` | Modify | `google_books_id` → `hardcover_id` in mock data |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/002_hardcover.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/002_hardcover.sql

-- Rename column
ALTER TABLE books RENAME COLUMN google_books_id TO hardcover_id;

-- Drop old unique constraint and add new one on renamed column
ALTER TABLE books DROP CONSTRAINT IF EXISTS books_google_books_id_key;
ALTER TABLE books ADD CONSTRAINT books_hardcover_id_key UNIQUE (hardcover_id);
```

- [ ] **Step 2: Run the migration in Supabase**

In the Supabase dashboard → SQL Editor, paste and run the contents of `supabase/migrations/002_hardcover.sql`.

Expected: no errors, `books` table now has `hardcover_id` column with a unique constraint.

- [ ] **Step 3: Set the Hardcover API secret in Supabase**

In the Supabase dashboard → Project Settings → Edge Functions → Secrets, add:

```
Name:  HARDCOVER_API_KEY
Value: <your Hardcover token from hardcover.app/account/api>
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/002_hardcover.sql
git commit -m "feat: rename google_books_id to hardcover_id in DB migration"
```

---

## Task 2: Update types/database.ts

**Files:**
- Modify: `types/database.ts`

- [ ] **Step 1: Rename the field in `books.Row`**

In `types/database.ts`, find `books.Row` and change:
```ts
// Before
google_books_id: string | null;

// After
hardcover_id: string | null;
```

- [ ] **Step 2: Rename in `books.Insert`**

```ts
// Before
google_books_id?: string | null;

// After
hardcover_id?: string | null;
```

- [ ] **Step 3: Rename in `books.Update`**

```ts
// Before
google_books_id?: string | null;

// After
hardcover_id?: string | null;
```

- [ ] **Step 4: Verify no TypeScript errors**

```bash
npx tsc --noEmit
```

Expected: 0 errors (or same errors as before this change — existing tests/screens may still reference `google_books_id` and will be fixed in later tasks).

- [ ] **Step 5: Commit**

```bash
git add types/database.ts
git commit -m "feat: rename google_books_id to hardcover_id in database types"
```

---

## Task 3: Rewrite lib/books.ts (TDD)

**Files:**
- Modify: `__tests__/lib/books.test.ts`
- Modify: `lib/books.ts`

- [ ] **Step 1: Replace `__tests__/lib/books.test.ts` with updated tests**

```ts
import { searchBooks, upsertBook, type BookSearchResult } from '@/lib/books';

const testState = {
  builderResolve: { data: null as any, error: null },
  mockBuilder: null as any,
};

jest.mock('@/lib/supabase', () => {
  const mockBuilder = {
    select: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(() => Promise.resolve(testState.builderResolve)),
    then: (resolve: any, reject: any) =>
      Promise.resolve(testState.builderResolve).then(resolve, reject),
  };
  testState.mockBuilder = mockBuilder;
  return {
    supabase: { from: jest.fn(() => mockBuilder) },
  };
});

beforeEach(() => {
  testState.builderResolve = { data: null, error: null };
  jest.clearAllMocks();
  if (testState.mockBuilder) {
    testState.mockBuilder.select.mockReturnThis();
    testState.mockBuilder.upsert.mockReturnThis();
    testState.mockBuilder.update.mockReturnThis();
    testState.mockBuilder.eq.mockReturnThis();
    testState.mockBuilder.single.mockImplementation(() =>
      Promise.resolve(testState.builderResolve)
    );
  }
  global.fetch = jest.fn();
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
});

const fakeBook: BookSearchResult = {
  hardcover_id: '12345',
  title: 'The Hobbit',
  author: 'J.R.R. Tolkien',
  cover_url: 'https://hardcover.app/cover.jpg',
  page_count: 310,
  genres: ['Fantasy'],
  description: 'A hobbit goes on an adventure.',
  rating: 4.5,
  users_read_count: 95000,
};

describe('searchBooks', () => {
  it('calls the Edge Function with action search and returns results', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [fakeBook],
    });

    const results = await searchBooks('hobbit');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://test.supabase.co/functions/v1/books',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ action: 'search', query: 'hobbit' }),
      })
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(fakeBook);
  });

  it('returns empty array when Edge Function returns empty array', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });
    const results = await searchBooks('xyz');
    expect(results).toEqual([]);
  });

  it('throws when Edge Function returns non-ok status', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 502 });
    await expect(searchBooks('error')).rejects.toThrow('Books function error: 502');
  });
});

describe('upsertBook', () => {
  it('upserts to Supabase with hardcover_id and returns the book id', async () => {
    testState.builderResolve = { data: { id: 'supabase-uuid' }, error: null };

    const id = await upsertBook(fakeBook);

    expect(id).toBe('supabase-uuid');
    expect(testState.mockBuilder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ hardcover_id: '12345', title: 'The Hobbit' }),
      { onConflict: 'hardcover_id' }
    );
  });

  it('throws when Supabase returns an error', async () => {
    testState.builderResolve = { data: null, error: { message: 'DB error' } };
    await expect(upsertBook(fakeBook)).rejects.toEqual({ message: 'DB error' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest __tests__/lib/books.test.ts --no-coverage
```

Expected: FAIL — `searchBooks` still calls Google Books, `upsertBook` still uses `google_books_id`.

- [ ] **Step 3: Replace `lib/books.ts` with the new implementation**

```ts
import { supabase } from './supabase';

const EDGE_FN_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/books`;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export interface BookSearchResult {
  hardcover_id: string;
  title: string;
  author: string;
  cover_url: string | null;
  page_count: number | null;
  genres: string[] | null;
  description: string | null;
  rating: number | null;
  users_read_count: number;
}

async function callBooksFunction(body: object): Promise<BookSearchResult[]> {
  const res = await fetch(EDGE_FN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Books function error: ${res.status}`);
  return res.json();
}

export async function searchBooks(query: string): Promise<BookSearchResult[]> {
  return callBooksFunction({ action: 'search', query });
}

export async function updatePageCount(bookId: string, pageCount: number): Promise<void> {
  const { error } = await supabase
    .from('books')
    .update({ page_count: pageCount })
    .eq('id', bookId);
  if (error) throw error;
}

export async function upsertBook(book: BookSearchResult): Promise<string> {
  const { data, error } = await supabase
    .from('books')
    .upsert(
      {
        hardcover_id: book.hardcover_id,
        title: book.title,
        author: book.author,
        cover_url: book.cover_url,
        page_count: book.page_count,
        genres: book.genres,
        description: book.description,
      },
      { onConflict: 'hardcover_id' }
    )
    .select('id')
    .single();
  if (error) throw error;
  if (!data) throw new Error('upsertBook: no data returned from Supabase');
  return data.id;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/lib/books.test.ts --no-coverage
```

Expected: PASS — all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/books.ts __tests__/lib/books.test.ts
git commit -m "feat: replace Google Books API with Hardcover Edge Function in lib/books"
```

---

## Task 4: Create Supabase Edge Function

**Files:**
- Create: `supabase/functions/books/index.ts`

- [ ] **Step 1: Create the directory**

```bash
mkdir -p supabase/functions/books
```

- [ ] **Step 2: Create `supabase/functions/books/index.ts`**

```ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const HARDCOVER_URL = 'https://api.hardcover.app/v1/graphql';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BOOK_FIELDS = `
  id
  title
  pages
  description
  image { url }
  contributions { author { name } }
  cached_tags
  rating
  users_read_count
`;

const SEARCH_QUERY = `
  query SearchBooks($query: String!, $per_page: Int!) {
    search(query: $query, query_type: "Book", per_page: $per_page) {
      results
    }
  }
`;

const TRENDING_QUERY = `
  query TrendingBooks($limit: Int!) {
    books(
      order_by: { users_read_count: desc }
      limit: $limit
      where: { users_read_count: { _gt: 100 } }
    ) {
      ${BOOK_FIELDS}
    }
  }
`;

const BY_GENRE_QUERY = `
  query BooksByGenre($genre: String!, $limit: Int!) {
    books(
      where: { taggings: { tag: { tag: { _ilike: $genre } } } }
      order_by: { users_read_count: desc }
      limit: $limit
    ) {
      ${BOOK_FIELDS}
    }
  }
`;

interface BookResult {
  hardcover_id: string;
  title: string;
  author: string;
  cover_url: string | null;
  page_count: number | null;
  genres: string[] | null;
  description: string | null;
  rating: number | null;
  users_read_count: number;
}

function normalizeBook(b: any): BookResult {
  return {
    hardcover_id: String(b.id),
    title: b.title ?? 'Unknown Title',
    author: b.contributions?.[0]?.author?.name ?? 'Unknown Author',
    cover_url: b.image?.url ?? null,
    page_count: b.pages ?? null,
    genres: Array.isArray(b.cached_tags)
      ? b.cached_tags
          .map((t: any) => (typeof t === 'string' ? t : t?.tag))
          .filter(Boolean)
      : null,
    description: b.description ?? null,
    rating: typeof b.rating === 'number' ? b.rating : null,
    users_read_count: b.users_read_count ?? 0,
  };
}

// Search results come back as a Typesense JSON blob with different field names
function normalizeSearchHit(hit: any): BookResult {
  const doc = hit.document ?? hit;
  return {
    hardcover_id: String(doc.id),
    title: doc.title ?? 'Unknown Title',
    author: Array.isArray(doc.author_names)
      ? (doc.author_names[0] ?? 'Unknown Author')
      : 'Unknown Author',
    cover_url: doc.image?.url ?? doc.cover_image_url ?? null,
    page_count: doc.pages ?? null,
    genres: Array.isArray(doc.cached_tags)
      ? doc.cached_tags
          .map((t: any) => (typeof t === 'string' ? t : t?.tag))
          .filter(Boolean)
      : null,
    description: doc.description ?? null,
    rating: typeof doc.rating === 'number' ? doc.rating : null,
    users_read_count: doc.users_read_count ?? 0,
  };
}

async function queryHardcover(
  apiKey: string,
  query: string,
  variables: Record<string, unknown>
): Promise<any> {
  const res = await fetch(HARDCOVER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Hardcover API error: ${res.status}`);
  return res.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, query, genre, limit = 20 } = await req.json();
    const apiKey = Deno.env.get('HARDCOVER_API_KEY') ?? '';

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'HARDCOVER_API_KEY secret not set' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let books: BookResult[];

    if (action === 'search') {
      const json = await queryHardcover(apiKey, SEARCH_QUERY, {
        query: String(query ?? ''),
        per_page: Number(limit),
      });
      const rawResults = json.data?.search?.results;
      // results is a JSON string from Typesense — parse it
      const hits: any[] = typeof rawResults === 'string'
        ? JSON.parse(rawResults)
        : (Array.isArray(rawResults) ? rawResults : []);
      books = hits.map(normalizeSearchHit);
    } else if (action === 'trending') {
      const json = await queryHardcover(apiKey, TRENDING_QUERY, {
        limit: Number(limit),
      });
      books = (json.data?.books ?? []).map(normalizeBook);
    } else if (action === 'by_genre') {
      const json = await queryHardcover(apiKey, BY_GENRE_QUERY, {
        genre: String(genre ?? ''),
        limit: Number(limit),
      });
      books = (json.data?.books ?? []).map(normalizeBook);
    } else {
      return new Response(
        JSON.stringify({ error: `Unknown action: ${action}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify(books), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
```

- [ ] **Step 3: Deploy the Edge Function**

```bash
npx supabase functions deploy books --project-ref <your-project-ref>
```

Where `<your-project-ref>` is the string from your Supabase project URL (e.g. `abcdefghijklmnop`). Find it in Supabase dashboard → Settings → General → Reference ID.

Expected: `Deployed Functions books` with no errors.

- [ ] **Step 4: Smoke-test the deployed function**

```bash
curl -X POST https://<your-project-ref>.supabase.co/functions/v1/books \
  -H "Content-Type: application/json" \
  -H "apikey: <your-anon-key>" \
  -d '{"action":"search","query":"dune"}'
```

Expected: JSON array of books with `hardcover_id`, `title`, `author`, etc.

**Note on search results:** If the response shows `author: "Unknown Author"` for all results, the Typesense hit structure uses different field names than anticipated. Inspect the raw response and update `normalizeSearchHit` in the Edge Function accordingly. Common alternatives: `author_names[0]`, `cached_contributors[0].name`. Redeploy after any fix.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/books/index.ts
git commit -m "feat: add Supabase Edge Function proxy for Hardcover API"
```

---

## Task 5: Update call sites (rename google_books_id → hardcover_id)

**Files:**
- Modify: `app/search.tsx`
- Modify: `__tests__/screens/search.test.tsx`
- Modify: `__tests__/screens/clubDetail.test.tsx`

- [ ] **Step 1: Update `app/search.tsx`**

`app/search.tsx` passes `BookSearchResult` objects straight to `upsertBook` — no direct field access. Verify:

```bash
grep -n "google_books_id" app/search.tsx
```

Expected: no matches. If any exist, rename to `hardcover_id`.

- [ ] **Step 2: Update `app/club/[clubId]/index.tsx`**

In the book search results map (around line 326), change:

```tsx
// Before
key={b.google_books_id}
...
testID={`book-result-${b.google_books_id}`}

// After
key={b.hardcover_id}
...
testID={`book-result-${b.hardcover_id}`}
```

- [ ] **Step 3: Update mock data in `__tests__/screens/search.test.tsx`**

Find `mockResult` (around line 31) and change:
```ts
// Before
const mockResult = {
  google_books_id: 'gbk1',
  title: 'The Hobbit',
  author: 'Tolkien',
  cover_url: null,
  page_count: 310,
  genres: ['Fantasy'],
};

// After
const mockResult = {
  hardcover_id: 'hc1',
  title: 'The Hobbit',
  author: 'Tolkien',
  cover_url: null,
  page_count: 310,
  genres: ['Fantasy'],
  description: null,
  rating: 4.2,
  users_read_count: 50000,
};
```

- [ ] **Step 4: Update mock data in `__tests__/screens/clubDetail.test.tsx`**

The `@/lib/books` mock uses `upsertBook` and `searchBooks` — no field-level changes needed there. Verify:

```bash
grep -n "google_books_id" __tests__/screens/clubDetail.test.tsx
```

Expected: no matches. If any exist, rename to `hardcover_id`.

- [ ] **Step 5: Run all tests to verify nothing is broken**

```bash
npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add app/search.tsx app/club/[clubId]/index.tsx __tests__/screens/search.test.tsx __tests__/screens/clubDetail.test.tsx
git commit -m "feat: update call sites to use hardcover_id"
```

---

## Task 6: Create lib/discover.ts (TDD)

**Files:**
- Create: `__tests__/lib/discover.test.ts`
- Create: `lib/discover.ts`

- [ ] **Step 1: Create `__tests__/lib/discover.test.ts`**

```ts
import { getTrending, getBooksByGenre, getRecommended } from '@/lib/discover';
import { type BookSearchResult } from '@/lib/books';

// ── Supabase mock ──────────────────────────────────────────────────────────────
const testState = {
  builderResolve: { data: null as any, error: null },
  mockBuilder: null as any,
};

jest.mock('@/lib/supabase', () => {
  const mockBuilder: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    then: (_resolve: any, _reject: any) =>
      Promise.resolve(testState.builderResolve).then(_resolve, _reject),
  };
  testState.mockBuilder = mockBuilder;
  return {
    supabase: { from: jest.fn(() => mockBuilder) },
  };
});

beforeEach(() => {
  testState.builderResolve = { data: [], error: null };
  jest.clearAllMocks();
  if (testState.mockBuilder) {
    testState.mockBuilder.select.mockReturnThis();
    testState.mockBuilder.eq.mockReturnThis();
    testState.mockBuilder.in.mockReturnThis();
  }
  global.fetch = jest.fn();
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
});

const fakeBook: BookSearchResult = {
  hardcover_id: '1',
  title: 'Dune',
  author: 'Frank Herbert',
  cover_url: null,
  page_count: 412,
  genres: ['Sci-Fi'],
  description: null,
  rating: 4.7,
  users_read_count: 200000,
};

const fakeBook2: BookSearchResult = {
  hardcover_id: '2',
  title: 'Foundation',
  author: 'Isaac Asimov',
  cover_url: null,
  page_count: 244,
  genres: ['Sci-Fi'],
  description: null,
  rating: 4.6,
  users_read_count: 180000,
};

describe('getTrending', () => {
  it('calls Edge Function with action trending and default limit', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [fakeBook],
    });

    const results = await getTrending();

    expect(global.fetch).toHaveBeenCalledWith(
      'https://test.supabase.co/functions/v1/books',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ action: 'trending', limit: 20 }),
      })
    );
    expect(results).toEqual([fakeBook]);
  });

  it('respects custom limit', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    await getTrending(5);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ body: JSON.stringify({ action: 'trending', limit: 5 }) })
    );
  });
});

describe('getBooksByGenre', () => {
  it('calls Edge Function with action by_genre and genre string', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [fakeBook],
    });

    const results = await getBooksByGenre('fantasy');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://test.supabase.co/functions/v1/books',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ action: 'by_genre', genre: 'fantasy', limit: 20 }),
      })
    );
    expect(results).toEqual([fakeBook]);
  });
});

describe('getRecommended', () => {
  it('falls back to trending when user has fewer than 3 read/reading books', async () => {
    // Supabase returns only 2 user_books
    testState.builderResolve = { data: [{ books: { genres: ['Fantasy'], hardcover_id: 'a' } }, { books: { genres: ['Fantasy'], hardcover_id: 'b' } }], error: null };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [fakeBook],
    });

    const result = await getRecommended('user-1');

    // Should call trending (not by_genre) as fallback
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ body: JSON.stringify({ action: 'trending', limit: 20 }) })
    );
    expect(result.personalized).toBe(false);
    expect(result.books).toEqual([fakeBook]);
  });

  it('returns personalized results based on top genres when user has 3+ books', async () => {
    // 3 books: 2 Sci-Fi, 1 Fantasy → top genre is Sci-Fi
    testState.builderResolve = {
      data: [
        { books: { genres: ['Sci-Fi'], hardcover_id: 'x1' } },
        { books: { genres: ['Sci-Fi'], hardcover_id: 'x2' } },
        { books: { genres: ['Fantasy'], hardcover_id: 'x3' } },
      ],
      error: null,
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => [fakeBook] })   // by_genre Sci-Fi
      .mockResolvedValueOnce({ ok: true, json: async () => [fakeBook2] }); // by_genre Fantasy

    const result = await getRecommended('user-1');

    expect(result.personalized).toBe(true);
    expect(result.books.map((b) => b.hardcover_id)).toEqual(['1', '2']);
  });

  it('deduplicates books that appear in multiple genre results', async () => {
    testState.builderResolve = {
      data: [
        { books: { genres: ['Sci-Fi'], hardcover_id: 'x1' } },
        { books: { genres: ['Sci-Fi'], hardcover_id: 'x2' } },
        { books: { genres: ['Fantasy'], hardcover_id: 'x3' } },
      ],
      error: null,
    };

    // Both genre queries return the same book
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => [fakeBook] })
      .mockResolvedValueOnce({ ok: true, json: async () => [fakeBook] });

    const result = await getRecommended('user-1');

    expect(result.books.filter((b) => b.hardcover_id === '1')).toHaveLength(1);
  });

  it('filters out books already on the user shelves', async () => {
    testState.builderResolve = {
      data: [
        { books: { genres: ['Sci-Fi'], hardcover_id: '1' } },  // same hardcover_id as fakeBook
        { books: { genres: ['Sci-Fi'], hardcover_id: 'x2' } },
        { books: { genres: ['Sci-Fi'], hardcover_id: 'x3' } },
      ],
      error: null,
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => [fakeBook, fakeBook2] });

    const result = await getRecommended('user-1');

    // fakeBook (hardcover_id '1') is already on shelf, should be filtered
    expect(result.books.find((b) => b.hardcover_id === '1')).toBeUndefined();
    expect(result.books.find((b) => b.hardcover_id === '2')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest __tests__/lib/discover.test.ts --no-coverage
```

Expected: FAIL — `lib/discover.ts` does not exist.

- [ ] **Step 3: Create `lib/discover.ts`**

```ts
import { supabase } from './supabase';
import { type BookSearchResult } from './books';

const EDGE_FN_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/books`;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

async function callBooksFunction(body: object): Promise<BookSearchResult[]> {
  const res = await fetch(EDGE_FN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Books function error: ${res.status}`);
  return res.json();
}

export async function getTrending(limit = 20): Promise<BookSearchResult[]> {
  return callBooksFunction({ action: 'trending', limit });
}

export async function getBooksByGenre(
  genre: string,
  limit = 20
): Promise<BookSearchResult[]> {
  return callBooksFunction({ action: 'by_genre', genre, limit });
}

export async function getRecommended(
  userId: string
): Promise<{ books: BookSearchResult[]; personalized: boolean }> {
  // 1. Load user's read + reading books with genres and hardcover_id
  const { data: userBooks } = await supabase
    .from('user_books')
    .select('books(genres, hardcover_id)')
    .eq('user_id', userId)
    .in('shelf', ['read', 'reading']);

  if (!userBooks || userBooks.length < 3) {
    const books = await getTrending(20);
    return { books, personalized: false };
  }

  // 2. Count genre frequency across shelf books
  const genreCount: Record<string, number> = {};
  const shelfHardcoverIds = new Set<string>();

  for (const ub of userBooks) {
    const book = (ub as any).books;
    if (book?.hardcover_id) shelfHardcoverIds.add(book.hardcover_id);
    for (const g of (book?.genres ?? [])) {
      genreCount[g] = (genreCount[g] ?? 0) + 1;
    }
  }

  const topGenres = Object.entries(genreCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([g]) => g);

  if (topGenres.length === 0) {
    const books = await getTrending(20);
    return { books, personalized: false };
  }

  // 3. Fetch by top genres, merge, deduplicate, filter shelf books
  const results = await Promise.all(topGenres.map((g) => getBooksByGenre(g, 20)));

  const seen = new Set<string>();
  const merged: BookSearchResult[] = [];

  for (const genreBooks of results) {
    for (const book of genreBooks) {
      if (!seen.has(book.hardcover_id) && !shelfHardcoverIds.has(book.hardcover_id)) {
        seen.add(book.hardcover_id);
        merged.push(book);
      }
    }
  }

  return { books: merged.slice(0, 20), personalized: true };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/lib/discover.test.ts --no-coverage
```

Expected: PASS — all 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/discover.ts __tests__/lib/discover.test.ts
git commit -m "feat: add lib/discover with getTrending, getBooksByGenre, getRecommended"
```

---

## Task 7: Build Discover Tab Screen (TDD)

**Files:**
- Create: `__tests__/screens/discover.test.tsx`
- Modify: `app/(tabs)/discover.tsx`

- [ ] **Step 1: Create `__tests__/screens/discover.test.tsx`**

```tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import DiscoverScreen from '@/app/(tabs)/discover';
import { ActionSheetIOS } from 'react-native';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(() => { cb(); }, []);
  },
}));

jest.mock('@/lib/auth', () => ({
  useAuth: jest.fn(() => ({ session: { user: { id: 'user-1' } } })),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));

jest.mock('@/lib/discover', () => ({
  getTrending: jest.fn().mockResolvedValue([]),
  getBooksByGenre: jest.fn().mockResolvedValue([]),
  getRecommended: jest.fn().mockResolvedValue({ books: [], personalized: false }),
}));

jest.mock('@/lib/books', () => ({
  upsertBook: jest.fn().mockResolvedValue('book-uuid'),
}));

jest.mock('@/lib/userBooks', () => ({
  addToShelf: jest.fn().mockResolvedValue('ub-uuid'),
}));

jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation(
  (_opts, cb) => cb(1)
);

import { getTrending, getBooksByGenre, getRecommended } from '@/lib/discover';
import { upsertBook } from '@/lib/books';
import { addToShelf } from '@/lib/userBooks';

const fakeBook = {
  hardcover_id: '1',
  title: 'Dune',
  author: 'Frank Herbert',
  cover_url: null,
  page_count: 412,
  genres: ['Sci-Fi'],
  description: null,
  rating: 4.7,
  users_read_count: 200000,
};

beforeEach(() => {
  jest.clearAllMocks();
  (getTrending as jest.Mock).mockResolvedValue([]);
  (getBooksByGenre as jest.Mock).mockResolvedValue([]);
  (getRecommended as jest.Mock).mockResolvedValue({ books: [], personalized: false });
  (upsertBook as jest.Mock).mockResolvedValue('book-uuid');
  (addToShelf as jest.Mock).mockResolvedValue('ub-uuid');
  jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation(
    (_opts, cb) => cb(1)
  );
});

describe('DiscoverScreen — Trending tab', () => {
  it('renders Trending and For You tab buttons', async () => {
    render(<DiscoverScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('tab-trending')).toBeTruthy();
      expect(screen.getByTestId('tab-for-you')).toBeTruthy();
    });
  });

  it('renders genre pills', async () => {
    render(<DiscoverScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('genre-pill-Fantasy')).toBeTruthy();
      expect(screen.getByTestId('genre-pill-Thriller')).toBeTruthy();
    });
  });

  it('calls getTrending on mount', async () => {
    render(<DiscoverScreen />);
    await waitFor(() => {
      expect(getTrending).toHaveBeenCalled();
    });
  });

  it('renders book cards from trending results', async () => {
    (getTrending as jest.Mock).mockResolvedValue([fakeBook]);
    render(<DiscoverScreen />);
    await waitFor(() => {
      expect(screen.getByText('Dune')).toBeTruthy();
      expect(screen.getByText('Frank Herbert')).toBeTruthy();
    });
  });

  it('tapping a genre pill calls getBooksByGenre with that genre', async () => {
    render(<DiscoverScreen />);
    await waitFor(() => screen.getByTestId('genre-pill-Fantasy'));
    fireEvent.press(screen.getByTestId('genre-pill-Fantasy'));
    await waitFor(() => {
      expect(getBooksByGenre).toHaveBeenCalledWith('Fantasy');
    });
  });

  it('tapping active genre pill a second time resets to trending', async () => {
    render(<DiscoverScreen />);
    await waitFor(() => screen.getByTestId('genre-pill-Fantasy'));
    fireEvent.press(screen.getByTestId('genre-pill-Fantasy'));
    await waitFor(() => expect(getBooksByGenre).toHaveBeenCalledTimes(1));
    fireEvent.press(screen.getByTestId('genre-pill-Fantasy'));
    await waitFor(() => {
      expect(getTrending).toHaveBeenCalledTimes(2);
    });
  });

  it('tapping a book card shows shelf action sheet and calls upsertBook + addToShelf', async () => {
    (getTrending as jest.Mock).mockResolvedValue([fakeBook]);
    render(<DiscoverScreen />);
    await waitFor(() => screen.getByTestId('book-card-1'));
    fireEvent.press(screen.getByTestId('book-card-1'));
    await waitFor(() => {
      expect(upsertBook).toHaveBeenCalledWith(fakeBook);
      expect(addToShelf).toHaveBeenCalledWith('user-1', 'book-uuid', 'reading');
    });
  });
});

describe('DiscoverScreen — For You tab', () => {
  it('shows empty state when not personalized', async () => {
    (getRecommended as jest.Mock).mockResolvedValue({ books: [], personalized: false });
    render(<DiscoverScreen />);
    await waitFor(() => screen.getByTestId('tab-for-you'));
    fireEvent.press(screen.getByTestId('tab-for-you'));
    await waitFor(() => {
      expect(
        screen.getByText('Add some books to your library and we\'ll find recommendations for you.')
      ).toBeTruthy();
    });
  });

  it('shows recommendation cards when personalized', async () => {
    (getRecommended as jest.Mock).mockResolvedValue({ books: [fakeBook], personalized: true });
    render(<DiscoverScreen />);
    await waitFor(() => screen.getByTestId('tab-for-you'));
    fireEvent.press(screen.getByTestId('tab-for-you'));
    await waitFor(() => {
      expect(screen.getByText('Dune')).toBeTruthy();
    });
  });

  it('does not show genre pills in For You mode', async () => {
    render(<DiscoverScreen />);
    await waitFor(() => screen.getByTestId('tab-for-you'));
    fireEvent.press(screen.getByTestId('tab-for-you'));
    await waitFor(() => {
      expect(screen.queryByTestId('genre-pill-Fantasy')).toBeNull();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest __tests__/screens/discover.test.tsx --no-coverage
```

Expected: FAIL — `discover.tsx` is a stub with no real implementation.

- [ ] **Step 3: Replace `app/(tabs)/discover.tsx` with full implementation**

```tsx
import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  ActionSheetIOS,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@/lib/auth';
import { getTrending, getBooksByGenre, getRecommended } from '@/lib/discover';
import { upsertBook, type BookSearchResult } from '@/lib/books';
import { addToShelf } from '@/lib/userBooks';
import { Shelf } from '@/types/database';
import { Colors, Spacing, Radius, Shadow } from '@/constants/theme';

const SHELF_OPTIONS = ['Cancel', 'Reading', 'Want to Read', 'Read', 'Did Not Finish'] as const;
const SHELF_KEYS: (Shelf | null)[] = [null, 'reading', 'want', 'read', 'dnf'];

const GENRES = [
  'Fantasy',
  'Romance',
  'Thriller',
  'Sci-Fi',
  'Mystery',
  'Historical Fiction',
  'Literary Fiction',
  'Non-Fiction',
];

type Tab = 'trending' | 'for_you';

export default function DiscoverScreen() {
  const { session } = useAuth();
  const userId = session?.user.id ?? '';

  const [activeTab, setActiveTab] = useState<Tab>('trending');
  const [activeGenre, setActiveGenre] = useState<string | null>(null);
  const [books, setBooks] = useState<BookSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPersonalized, setIsPersonalized] = useState(false);

  const loadBooks = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      if (activeTab === 'for_you') {
        const result = await getRecommended(userId);
        setBooks(result.books);
        setIsPersonalized(result.personalized);
      } else {
        const results = activeGenre
          ? await getBooksByGenre(activeGenre)
          : await getTrending();
        setBooks(results);
      }
    } catch {
      setBooks([]);
    } finally {
      setLoading(false);
    }
  }, [userId, activeTab, activeGenre]);

  useFocusEffect(useCallback(() => { loadBooks(); }, [loadBooks]));

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setActiveGenre(null);
  };

  const handleGenrePress = (genre: string) => {
    if (activeGenre === genre) {
      setActiveGenre(null); // reset to trending
    } else {
      setActiveGenre(genre);
    }
  };

  const handleBookPress = (book: BookSearchResult) => {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [...SHELF_OPTIONS],
        cancelButtonIndex: 0,
        title: `Add "${book.title}" to...`,
      },
      async (buttonIndex) => {
        const shelf = SHELF_KEYS[buttonIndex];
        if (!shelf) return;
        try {
          const bookId = await upsertBook(book);
          await addToShelf(userId, bookId, shelf);
        } catch {
          Alert.alert('Error', 'Could not add book. Please try again.');
        }
      }
    );
  };

  if (!session) return null;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <Text style={styles.title}>Discover</Text>

      {/* Tab toggle */}
      <View style={styles.tabTrack}>
        <TouchableOpacity
          testID="tab-trending"
          style={[styles.tab, activeTab === 'trending' && styles.activeTab]}
          onPress={() => handleTabChange('trending')}
        >
          <Text style={[styles.tabText, activeTab === 'trending' && styles.activeTabText]}>
            Trending
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="tab-for-you"
          style={[styles.tab, activeTab === 'for_you' && styles.activeTab]}
          onPress={() => handleTabChange('for_you')}
        >
          <Text style={[styles.tabText, activeTab === 'for_you' && styles.activeTabText]}>
            For You
          </Text>
        </TouchableOpacity>
      </View>

      {/* Genre pills — only in Trending mode */}
      {activeTab === 'trending' && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.genreRow}
        >
          {GENRES.map((genre) => (
            <TouchableOpacity
              key={genre}
              testID={`genre-pill-${genre}`}
              style={[styles.genrePill, activeGenre === genre && styles.activeGenrePill]}
              onPress={() => handleGenrePress(genre)}
            >
              <Text style={[styles.genreText, activeGenre === genre && styles.activeGenreText]}>
                {genre}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : activeTab === 'for_you' && !isPersonalized ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>
            Add some books to your library and we'll find recommendations for you.
          </Text>
        </View>
      ) : (
        <FlatList
          data={books}
          keyExtractor={(item) => item.hardcover_id}
          contentContainerStyle={books.length === 0 ? styles.emptyContainer : styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              testID={`book-card-${item.hardcover_id}`}
              style={styles.card}
              onPress={() => handleBookPress(item)}
            >
              {item.cover_url ? (
                <Image source={{ uri: item.cover_url }} style={styles.cover} />
              ) : (
                <View style={styles.coverPlaceholder} />
              )}
              <View style={styles.cardInfo}>
                <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.cardAuthor}>{item.author}</Text>
                {item.rating !== null && (
                  <Text style={styles.cardMeta}>
                    ★ {item.rating.toFixed(1)} · {(item.users_read_count / 1000).toFixed(0)}k readers
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No books found.</Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  tabTrack: {
    flexDirection: 'row',
    backgroundColor: Colors.border,
    borderRadius: Radius.xl,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    padding: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: Radius.xl,
  },
  activeTab: { backgroundColor: Colors.surface, ...Shadow.card },
  tabText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  activeTabText: { color: Colors.textPrimary, fontWeight: '700' },
  genreRow: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    gap: 8,
  },
  genrePill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  activeGenrePill: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  genreText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  activeGenreText: { color: Colors.surface },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg, gap: Spacing.sm },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
    ...Shadow.card,
  },
  cover: { width: 50, height: 75, borderRadius: Radius.sm },
  coverPlaceholder: {
    width: 50,
    height: 75,
    borderRadius: Radius.sm,
    backgroundColor: Colors.border,
  },
  cardInfo: { flex: 1, gap: 4, justifyContent: 'center' },
  cardTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '600' },
  cardAuthor: { color: Colors.textSecondary, fontSize: 13 },
  cardMeta: { color: Colors.textTertiary, fontSize: 12 },
});
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/screens/discover.test.tsx --no-coverage
```

Expected: PASS — all 9 tests green.

- [ ] **Step 5: Run the full test suite**

```bash
npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add app/(tabs)/discover.tsx __tests__/screens/discover.test.tsx
git commit -m "feat: build Discover tab with trending, genre browsing, and For You recommendations"
```
