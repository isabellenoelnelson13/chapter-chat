# GoodReads Data Enrichment & Author Pages

**Date:** 2026-04-30
**Status:** Approved

## Overview

Extend the existing GoodReads seeding pipeline to use `authors.json`, `reviews.json`, and `book_tags.json` + `tags.json` in addition to the already-handled `books.json`. The goal is more accurate book data (better genres, updated ratings/counts, top reviews) and a new author detail page reachable from the book detail screen.

## Database Schema

### New table: `authors`

```sql
CREATE TABLE public.authors (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goodreads_author_id  text UNIQUE NOT NULL,
  name                 text NOT NULL,
  bio                  text,
  photo_url            text,
  born_date            text,   -- kept as text; GoodReads dates are inconsistent
  website              text,
  created_at           timestamptz NOT NULL DEFAULT now()
);
```

RLS: viewable by all authenticated users (same policy as `books`).

### Updated table: `books`

One new column:

```sql
ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS goodreads_author_id text
  REFERENCES public.authors(goodreads_author_id);
```

The existing `author` text field is retained for display everywhere. `goodreads_author_id` is nullable — books without a matching author record continue to work as today.

### New table: `book_reviews`

```sql
CREATE TABLE public.book_reviews (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id              uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  goodreads_review_id  text UNIQUE,    -- prevents duplicate imports
  reviewer_name        text,
  rating               numeric(2,1),
  body                 text,
  date_added           date,
  helpful_votes        int DEFAULT 0,  -- used to rank "top" reviews
  created_at           timestamptz NOT NULL DEFAULT now()
);
```

These are seeded GoodReads reviews — no `user_id` FK. RLS: viewable by all authenticated users.

## Import Scripts

Run order: **authors → books → reviews → tags**

### `scripts/import-goodreads-authors.mjs`

- Reads `authors.json` (NDJSON)
- Strips HTML from bio fields (`<br>`, `<b>`, etc.)
- Skips entries with no name
- Upserts into `authors` on `goodreads_author_id`

### `scripts/import-goodreads.mjs` (updated)

- Existing logic unchanged
- At startup, pre-loads an in-memory map of `goodreads_author_id → name` from the `authors` table
- After resolving a book record, if `authors[0].author_id` is present (id-only format), resolves the author name from that map and sets both `author` and `goodreads_author_id`
- This recovers books previously skipped due to missing embedded author names
- Must run after authors script

### `scripts/import-goodreads-reviews.mjs`

- Reads `reviews.json` (NDJSON)
- Matches reviews to books via `goodreads_id`
- Skips reviews with no body text
- Per book: keeps top 10 reviews by `helpful_votes`; upserts into `book_reviews` on `goodreads_review_id`
- In the same pass: recomputes `books.rating` (arithmetic mean of all review ratings for that book) and `books.users_read_count` (total review count) from the review data; updates the books row
- Must run after books script

### `scripts/import-goodreads-tags.mjs`

- Reads `tags.json` (id→name map) then `book_tags.json` (book→tag counts)
- For each book (matched by `goodreads_id`), selects the top genre-matching tags by count using the existing `GENRE_SHELVES` allowlist
- Updates `books.genres` only when the new tag list has more items than the existing value
- Must run after books script

## App Changes

### New screen: `app/author/[authorId].tsx`

- Param: `authorId` = `goodreads_author_id`
- **Header section:** author photo, name, born date, website link (if present), bio collapsed to ~3 lines with a "Read more" toggle
- **Books section:** scrollable grid of books linked to this author, ordered by `users_read_count` desc
- Tapping any book navigates to `/book/[bookId]`
- Uses `useTheme()` + memoized styles (consistent with the rest of the app)

### Updated screen: `app/book/[bookId].tsx`

**Author name → tappable link**
- If `goodreads_author_id` is non-null, the author name renders as a `TouchableOpacity` that pushes to `/author/[goodreads_author_id]`
- If null, renders as plain text (no change to current behaviour)

**New Reviews section**
- Appended at the bottom of the scroll view
- Queries two sources in parallel:
  - **Friend reviews:** from `user_books` joined to `follows` and `profiles`, filtered to users the current user follows, only rows with non-null `review` text
  - **Seeded reviews:** from `book_reviews` ordered by `helpful_votes` desc, limited to 10
- Renders "From your friends" header + friend reviews first; if no friend reviews, this section is hidden
- Renders "GoodReads reviews" header + seeded reviews below

## New Library Functions

### `lib/authors.ts` (new file)

- `getAuthor(goodreadsAuthorId: string)` — fetches single author row
- `getAuthorBooks(goodreadsAuthorId: string)` — fetches books with matching `goodreads_author_id`, ordered by `users_read_count` desc

### `lib/books.ts` (updated)

- `getBookReviews(bookId: string, userId: string): Promise<{ friendReviews, topReviews }>` — runs both queries in parallel and returns them as separate arrays for the UI to render

## Migration

Single migration file: `012_authors_and_reviews.sql`
- Creates `authors` table
- Adds `goodreads_author_id` column to `books`
- Creates `book_reviews` table
- Adds RLS policies for both new tables
