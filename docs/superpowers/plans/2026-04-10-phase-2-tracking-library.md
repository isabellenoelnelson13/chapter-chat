# BookApp Phase 2 — Tracking & Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the core reading experience — search and add books, manage 4 library shelves, log reading sessions with a live timer or manual entry, and display today's stats on the Home dashboard.

**Architecture:** Four new lib modules (`books`, `userBooks`, `sessions`, `stats`) form the data layer; screens import from them and mock them in tests. Google Books API is hit directly from the client (no key required for dev). `lib/sessions.ts` wraps both a Supabase insert and a current-page update in one call. Stats are computed live from `reading_sessions` — no denormalized counters. Expo Router file-based routing auto-discovers `app/search.tsx` and `app/session/[bookId].tsx`; we register `search` as a modal in the root layout.

**Tech Stack:** Expo SDK 54, Expo Router 6, TypeScript, Supabase JS v2, @testing-library/react-native, Jest fake timers (session timer), ActionSheetIOS (shelf picker), react-native-safe-area-context

---

## File Map

```
lib/
  books.ts                    # Google Books API search + Supabase upsert
  userBooks.ts                # user_books CRUD (add, move, update page, rate, query)
  sessions.ts                 # reading_sessions insert + current_page update
  stats.ts                    # streak, today pages/time, reading pace
app/
  _layout.tsx                 # MODIFY: register search as modal + session routes
  (tabs)/
    index.tsx                 # REPLACE stub: Home dashboard
    library.tsx               # REPLACE stub: Library with 4 shelf tabs + FAB
  search.tsx                  # NEW: book search + shelf picker
  session/
    [bookId].tsx              # NEW: live timer session
    manual.tsx                # NEW: manual session log
__tests__/
  lib/
    books.test.ts             # searchBooks, upsertBook, http→https cover URL
    userBooks.test.ts         # addToShelf, moveShelf, getShelf, getCurrentBook, getUserBook
    sessions.test.ts          # createSession
    stats.test.ts             # getTodayStats, getStreak, estimateDaysRemaining
  screens/
    home.test.tsx             # Home dashboard render + interactions
    library.test.tsx          # Library shelf tabs + FAB
    search.test.tsx           # Search input + results + shelf selection
    session.test.tsx          # Timer phases: setup → running → paused → finish → save
    sessionManual.test.tsx    # Manual log form + validation + save
```

---

## Supabase builder mock (reuse this pattern in every lib test file)

Every lib test file needs this at the top (after imports). Copy it verbatim — do not abbreviate.

```typescript
// Shared builder mock — makes every chain method return `this`,
// plus a `then` so `await builder` resolves to `builderResolve`.
let builderResolve: { data: any; error: any } = { data: null, error: null };

const builder: any = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  lt: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  upsert: jest.fn().mockReturnThis(),
  maybeSingle: jest.fn(() => Promise.resolve(builderResolve)),
  single: jest.fn(() => Promise.resolve(builderResolve)),
  // Makes `await builder` work (used when chain ends with .eq or .order)
  then: (resolve: any, reject: any) =>
    Promise.resolve(builderResolve).then(resolve, reject),
};

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn(() => builder) },
}));

beforeEach(() => {
  builderResolve = { data: null, error: null };
  jest.clearAllMocks();
  // Re-attach mockReturnThis after clearAllMocks resets them
  builder.select.mockReturnThis();
  builder.eq.mockReturnThis();
  builder.order.mockReturnThis();
  builder.limit.mockReturnThis();
  builder.gte.mockReturnThis();
  builder.lt.mockReturnThis();
  builder.insert.mockReturnThis();
  builder.update.mockReturnThis();
  builder.upsert.mockReturnThis();
  builder.maybeSingle.mockImplementation(() => Promise.resolve(builderResolve));
  builder.single.mockImplementation(() => Promise.resolve(builderResolve));
  builder.then.mockImplementation
    ? builder.then.mockImplementation((resolve: any, reject: any) =>
        Promise.resolve(builderResolve).then(resolve, reject))
    : undefined;
});
```

---

## Task 1: Google Books API client

**Files:**
- Create: `lib/books.ts`
- Create: `__tests__/lib/books.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/books.test.ts`:

```typescript
import { searchBooks, fetchBookByGoogleId, upsertBook, type BookSearchResult } from '@/lib/books';

// Mock supabase for upsertBook
let builderResolve: { data: any; error: any } = { data: null, error: null };
const builder: any = {
  select: jest.fn().mockReturnThis(),
  upsert: jest.fn().mockReturnThis(),
  single: jest.fn(() => Promise.resolve(builderResolve)),
  then: (resolve: any, reject: any) =>
    Promise.resolve(builderResolve).then(resolve, reject),
};
jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn(() => builder) },
}));

beforeEach(() => {
  builderResolve = { data: null, error: null };
  jest.clearAllMocks();
  builder.select.mockReturnThis();
  builder.upsert.mockReturnThis();
  builder.single.mockImplementation(() => Promise.resolve(builderResolve));
  global.fetch = jest.fn();
});

const fakeVolume = {
  id: 'gbk123',
  volumeInfo: {
    title: 'The Hobbit',
    authors: ['J.R.R. Tolkien'],
    imageLinks: { thumbnail: 'http://books.google.com/cover.jpg' },
    pageCount: 310,
    categories: ['Fantasy'],
  },
};

describe('searchBooks', () => {
  it('returns mapped results from Google Books API', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [fakeVolume] }),
    });

    const results = await searchBooks('hobbit');

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      google_books_id: 'gbk123',
      title: 'The Hobbit',
      author: 'J.R.R. Tolkien',
      cover_url: 'https://books.google.com/cover.jpg',
      page_count: 310,
      genres: ['Fantasy'],
    });
  });

  it('upgrades http cover URLs to https', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [fakeVolume] }),
    });
    const results = await searchBooks('hobbit');
    expect(results[0].cover_url).toMatch(/^https:/);
  });

  it('returns empty array when items is missing', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });
    const results = await searchBooks('xyz');
    expect(results).toEqual([]);
  });

  it('handles missing authors and imageLinks gracefully', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [{ id: 'abc', volumeInfo: { title: 'No Author Book' } }],
      }),
    });
    const results = await searchBooks('no author');
    expect(results[0].author).toBe('Unknown Author');
    expect(results[0].cover_url).toBeNull();
    expect(results[0].page_count).toBeNull();
    expect(results[0].genres).toBeNull();
  });

  it('throws when the API returns a non-ok status', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 500 });
    await expect(searchBooks('error')).rejects.toThrow('Google Books API error: 500');
  });
});

describe('fetchBookByGoogleId', () => {
  it('returns null when API returns non-ok', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 404 });
    const result = await fetchBookByGoogleId('bad-id');
    expect(result).toBeNull();
  });

  it('returns mapped book on success', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => fakeVolume,
    });
    const result = await fetchBookByGoogleId('gbk123');
    expect(result?.title).toBe('The Hobbit');
  });
});

describe('upsertBook', () => {
  it('upserts to Supabase and returns the book id', async () => {
    builderResolve = { data: { id: 'supabase-uuid' }, error: null };
    const book: BookSearchResult = {
      google_books_id: 'gbk123',
      title: 'The Hobbit',
      author: 'J.R.R. Tolkien',
      cover_url: 'https://books.google.com/cover.jpg',
      page_count: 310,
      genres: ['Fantasy'],
    };
    const id = await upsertBook(book);
    expect(id).toBe('supabase-uuid');
    expect(builder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ google_books_id: 'gbk123', title: 'The Hobbit' }),
      { onConflict: 'google_books_id' }
    );
  });

  it('throws when Supabase returns an error', async () => {
    builderResolve = { data: null, error: { message: 'DB error' } };
    await expect(upsertBook({ google_books_id: 'x', title: 'X', author: 'A', cover_url: null, page_count: null, genres: null }))
      .rejects.toEqual({ message: 'DB error' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest __tests__/lib/books.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '@/lib/books'`

- [ ] **Step 3: Implement `lib/books.ts`**

```typescript
import { supabase } from './supabase';

const GOOGLE_BOOKS_BASE = 'https://www.googleapis.com/books/v1';
const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_BOOKS_API_KEY ?? '';

export interface BookSearchResult {
  google_books_id: string;
  title: string;
  author: string;
  cover_url: string | null;
  page_count: number | null;
  genres: string[] | null;
}

export async function searchBooks(query: string): Promise<BookSearchResult[]> {
  const params = new URLSearchParams({ q: query, maxResults: '20' });
  if (API_KEY) params.set('key', API_KEY);
  const res = await fetch(`${GOOGLE_BOOKS_BASE}/volumes?${params}`);
  if (!res.ok) throw new Error(`Google Books API error: ${res.status}`);
  const json = await res.json();
  return (json.items ?? []).map(volumeToBook);
}

export async function fetchBookByGoogleId(googleBooksId: string): Promise<BookSearchResult | null> {
  const params = new URLSearchParams();
  if (API_KEY) params.set('key', API_KEY);
  const qs = API_KEY ? `?${params}` : '';
  const res = await fetch(`${GOOGLE_BOOKS_BASE}/volumes/${googleBooksId}${qs}`);
  if (!res.ok) return null;
  const json = await res.json();
  return volumeToBook(json);
}

function volumeToBook(volume: any): BookSearchResult {
  const info = volume.volumeInfo ?? {};
  const thumbnail: string | null = info.imageLinks?.thumbnail ?? null;
  return {
    google_books_id: volume.id,
    title: info.title ?? 'Unknown Title',
    author: (info.authors ?? [])[0] ?? 'Unknown Author',
    cover_url: thumbnail ? thumbnail.replace('http://', 'https://') : null,
    page_count: info.pageCount ?? null,
    genres: info.categories ?? null,
  };
}

export async function upsertBook(book: BookSearchResult): Promise<string> {
  const { data, error } = await supabase
    .from('books')
    .upsert(
      {
        google_books_id: book.google_books_id,
        title: book.title,
        author: book.author,
        cover_url: book.cover_url,
        page_count: book.page_count,
        genres: book.genres,
      },
      { onConflict: 'google_books_id' }
    )
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/lib/books.test.ts --no-coverage
```

Expected: PASS — 8 tests, 0 failures

- [ ] **Step 5: Commit**

```bash
git add lib/books.ts __tests__/lib/books.test.ts
git commit -m "feat: add Google Books API client with Supabase upsert"
```

---

## Task 2: User books data layer

**Files:**
- Create: `lib/userBooks.ts`
- Create: `__tests__/lib/userBooks.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/userBooks.test.ts`:

```typescript
import {
  addToShelf,
  moveShelf,
  updateCurrentPage,
  rateBook,
  getShelf,
  getCurrentBook,
  getUserBook,
  type UserBookWithBook,
} from '@/lib/userBooks';
import { supabase } from '@/lib/supabase';

let builderResolve: { data: any; error: any } = { data: null, error: null };
const builder: any = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  maybeSingle: jest.fn(() => Promise.resolve(builderResolve)),
  single: jest.fn(() => Promise.resolve(builderResolve)),
  then: (resolve: any, reject: any) =>
    Promise.resolve(builderResolve).then(resolve, reject),
};
jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn(() => builder) },
}));

beforeEach(() => {
  builderResolve = { data: null, error: null };
  jest.clearAllMocks();
  builder.select.mockReturnThis();
  builder.eq.mockReturnThis();
  builder.order.mockReturnThis();
  builder.limit.mockReturnThis();
  builder.insert.mockReturnThis();
  builder.update.mockReturnThis();
  builder.maybeSingle.mockImplementation(() => Promise.resolve(builderResolve));
  builder.single.mockImplementation(() => Promise.resolve(builderResolve));
});

const mockUserBook: UserBookWithBook = {
  id: 'ub-1',
  user_id: 'user-1',
  book_id: 'book-1',
  shelf: 'reading',
  current_page: 50,
  rating: null,
  review: null,
  added_at: '2026-04-01T00:00:00Z',
  finished_at: null,
  book: {
    id: 'book-1',
    title: 'The Hobbit',
    author: 'Tolkien',
    cover_url: null,
    page_count: 310,
  },
};

describe('addToShelf', () => {
  it('inserts a user_book and returns its id', async () => {
    builderResolve = { data: { id: 'ub-1' }, error: null };
    const id = await addToShelf('user-1', 'book-1', 'reading');
    expect(id).toBe('ub-1');
    expect(builder.insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      book_id: 'book-1',
      shelf: 'reading',
      current_page: 0,
    });
  });

  it('throws on Supabase error', async () => {
    builderResolve = { data: null, error: { message: 'unique violation' } };
    await expect(addToShelf('user-1', 'book-1', 'reading')).rejects.toEqual({
      message: 'unique violation',
    });
  });
});

describe('moveShelf', () => {
  it('updates the shelf', async () => {
    builderResolve = { data: null, error: null };
    await moveShelf('ub-1', 'want');
    expect(builder.update).toHaveBeenCalledWith(expect.objectContaining({ shelf: 'want' }));
    expect(builder.eq).toHaveBeenCalledWith('id', 'ub-1');
  });

  it('sets finished_at when moving to read shelf', async () => {
    builderResolve = { data: null, error: null };
    await moveShelf('ub-1', 'read');
    const updateCall = builder.update.mock.calls[0][0];
    expect(updateCall.finished_at).toBeTruthy();
  });
});

describe('updateCurrentPage', () => {
  it('updates current_page', async () => {
    builderResolve = { data: null, error: null };
    await updateCurrentPage('ub-1', 120);
    expect(builder.update).toHaveBeenCalledWith({ current_page: 120 });
    expect(builder.eq).toHaveBeenCalledWith('id', 'ub-1');
  });
});

describe('rateBook', () => {
  it('updates rating and review', async () => {
    builderResolve = { data: null, error: null };
    await rateBook('ub-1', 5, 'Excellent');
    expect(builder.update).toHaveBeenCalledWith({ rating: 5, review: 'Excellent' });
  });

  it('sets review to null when not provided', async () => {
    builderResolve = { data: null, error: null };
    await rateBook('ub-1', 4);
    expect(builder.update).toHaveBeenCalledWith({ rating: 4, review: null });
  });
});

describe('getShelf', () => {
  it('returns books on the specified shelf', async () => {
    builderResolve = { data: [mockUserBook], error: null };
    const result = await getShelf('user-1', 'reading');
    expect(result).toHaveLength(1);
    expect(result[0].shelf).toBe('reading');
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(builder.eq).toHaveBeenCalledWith('shelf', 'reading');
  });

  it('returns empty array when shelf is empty', async () => {
    builderResolve = { data: [], error: null };
    const result = await getShelf('user-1', 'want');
    expect(result).toEqual([]);
  });
});

describe('getCurrentBook', () => {
  it('returns the most recent reading book', async () => {
    builderResolve = { data: mockUserBook, error: null };
    const result = await getCurrentBook('user-1');
    expect(result?.shelf).toBe('reading');
    expect(builder.maybeSingle).toHaveBeenCalled();
  });

  it('returns null when no book is being read', async () => {
    builderResolve = { data: null, error: null };
    const result = await getCurrentBook('user-1');
    expect(result).toBeNull();
  });
});

describe('getUserBook', () => {
  it('returns the user_book for a given bookId', async () => {
    builderResolve = { data: mockUserBook, error: null };
    const result = await getUserBook('user-1', 'book-1');
    expect(result?.book_id).toBe('book-1');
    expect(builder.eq).toHaveBeenCalledWith('book_id', 'book-1');
    expect(builder.maybeSingle).toHaveBeenCalled();
  });

  it('returns null when book not in library', async () => {
    builderResolve = { data: null, error: null };
    const result = await getUserBook('user-1', 'not-in-library');
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest __tests__/lib/userBooks.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '@/lib/userBooks'`

- [ ] **Step 3: Implement `lib/userBooks.ts`**

```typescript
import { supabase } from './supabase';
import { Shelf, Database } from '../types/database';

type BookRow = Database['public']['Tables']['books']['Row'];

export interface UserBookWithBook {
  id: string;
  user_id: string;
  book_id: string;
  shelf: Shelf;
  current_page: number;
  rating: number | null;
  review: string | null;
  added_at: string;
  finished_at: string | null;
  book: Pick<BookRow, 'id' | 'title' | 'author' | 'cover_url' | 'page_count'>;
}

const BOOK_SELECT = '*, book:books(id, title, author, cover_url, page_count)';

export async function addToShelf(userId: string, bookId: string, shelf: Shelf): Promise<string> {
  const { data, error } = await supabase
    .from('user_books')
    .insert({ user_id: userId, book_id: bookId, shelf, current_page: 0 })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function moveShelf(userBookId: string, shelf: Shelf, finishedAt?: string): Promise<void> {
  const update: Record<string, unknown> = { shelf };
  if (shelf === 'read') update.finished_at = finishedAt ?? new Date().toISOString();
  const { error } = await supabase
    .from('user_books')
    .update(update)
    .eq('id', userBookId);
  if (error) throw error;
}

export async function updateCurrentPage(userBookId: string, currentPage: number): Promise<void> {
  const { error } = await supabase
    .from('user_books')
    .update({ current_page: currentPage })
    .eq('id', userBookId);
  if (error) throw error;
}

export async function rateBook(userBookId: string, rating: number, review?: string): Promise<void> {
  const { error } = await supabase
    .from('user_books')
    .update({ rating, review: review ?? null })
    .eq('id', userBookId);
  if (error) throw error;
}

export async function getShelf(userId: string, shelf: Shelf): Promise<UserBookWithBook[]> {
  const { data, error } = await supabase
    .from('user_books')
    .select(BOOK_SELECT)
    .eq('user_id', userId)
    .eq('shelf', shelf)
    .order('added_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as UserBookWithBook[];
}

export async function getCurrentBook(userId: string): Promise<UserBookWithBook | null> {
  const { data, error } = await supabase
    .from('user_books')
    .select(BOOK_SELECT)
    .eq('user_id', userId)
    .eq('shelf', 'reading')
    .order('added_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as UserBookWithBook | null;
}

export async function getUserBook(userId: string, bookId: string): Promise<UserBookWithBook | null> {
  const { data, error } = await supabase
    .from('user_books')
    .select(BOOK_SELECT)
    .eq('user_id', userId)
    .eq('book_id', bookId)
    .maybeSingle();
  if (error) throw error;
  return data as UserBookWithBook | null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/lib/userBooks.test.ts --no-coverage
```

Expected: PASS — 12 tests, 0 failures

- [ ] **Step 5: Commit**

```bash
git add lib/userBooks.ts __tests__/lib/userBooks.test.ts
git commit -m "feat: add user books data layer"
```

---

## Task 3: Reading sessions data layer

**Files:**
- Create: `lib/sessions.ts`
- Create: `__tests__/lib/sessions.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/sessions.test.ts`:

```typescript
import { createSession } from '@/lib/sessions';
import { supabase } from '@/lib/supabase';

// Mock supabase for the insert
let builderResolve: { data: any; error: any } = { data: null, error: null };
const builder: any = {
  insert: jest.fn().mockReturnThis(),
  then: (resolve: any, reject: any) =>
    Promise.resolve(builderResolve).then(resolve, reject),
};
jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn(() => builder) },
}));

// Mock updateCurrentPage so we test createSession in isolation
jest.mock('@/lib/userBooks', () => ({
  updateCurrentPage: jest.fn().mockResolvedValue(undefined),
}));

import { updateCurrentPage } from '@/lib/userBooks';

beforeEach(() => {
  builderResolve = { data: null, error: null };
  jest.clearAllMocks();
  builder.insert.mockReturnThis();
});

const sessionParams = {
  userId: 'user-1',
  bookId: 'book-1',
  userBookId: 'ub-1',
  startPage: 50,
  endPage: 80,
  durationSeconds: 1800,
  startedAt: new Date('2026-04-10T09:00:00Z'),
};

describe('createSession', () => {
  it('inserts a reading session with correct fields', async () => {
    builderResolve = { data: null, error: null };
    await createSession(sessionParams);
    expect(builder.insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      book_id: 'book-1',
      start_page: 50,
      end_page: 80,
      duration_seconds: 1800,
      started_at: '2026-04-10T09:00:00.000Z',
    });
  });

  it('calls updateCurrentPage with endPage', async () => {
    builderResolve = { data: null, error: null };
    await createSession(sessionParams);
    expect(updateCurrentPage).toHaveBeenCalledWith('ub-1', 80);
  });

  it('throws when Supabase returns an error', async () => {
    builderResolve = { data: null, error: { message: 'insert failed' } };
    await expect(createSession(sessionParams)).rejects.toEqual({
      message: 'insert failed',
    });
  });

  it('does not call updateCurrentPage when insert fails', async () => {
    builderResolve = { data: null, error: { message: 'insert failed' } };
    await expect(createSession(sessionParams)).rejects.toBeTruthy();
    expect(updateCurrentPage).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest __tests__/lib/sessions.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '@/lib/sessions'`

- [ ] **Step 3: Implement `lib/sessions.ts`**

```typescript
import { supabase } from './supabase';
import { updateCurrentPage } from './userBooks';
import { Database } from '../types/database';

type SessionInsert = Database['public']['Tables']['reading_sessions']['Insert'];

export async function createSession(params: {
  userId: string;
  bookId: string;
  userBookId: string;
  startPage: number;
  endPage: number;
  durationSeconds: number;
  startedAt: Date;
}): Promise<void> {
  const { userId, bookId, userBookId, startPage, endPage, durationSeconds, startedAt } = params;

  const insert: SessionInsert = {
    user_id: userId,
    book_id: bookId,
    start_page: startPage,
    end_page: endPage,
    duration_seconds: durationSeconds,
    started_at: startedAt.toISOString(),
  };

  const { error } = await supabase.from('reading_sessions').insert(insert);
  if (error) throw error;

  await updateCurrentPage(userBookId, endPage);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/lib/sessions.test.ts --no-coverage
```

Expected: PASS — 4 tests, 0 failures

- [ ] **Step 5: Commit**

```bash
git add lib/sessions.ts __tests__/lib/sessions.test.ts
git commit -m "feat: add reading sessions data layer"
```

---

## Task 4: Stats

**Files:**
- Create: `lib/stats.ts`
- Create: `__tests__/lib/stats.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/stats.test.ts`:

```typescript
import { getTodayStats, getStreak, estimateDaysRemaining } from '@/lib/stats';

let builderResolve: { data: any; error: any } = { data: null, error: null };
const builder: any = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  lt: jest.fn().mockReturnThis(),
  then: (resolve: any, reject: any) =>
    Promise.resolve(builderResolve).then(resolve, reject),
};
jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn(() => builder) },
}));

beforeEach(() => {
  builderResolve = { data: null, error: null };
  jest.clearAllMocks();
  builder.select.mockReturnThis();
  builder.eq.mockReturnThis();
  builder.order.mockReturnThis();
  builder.gte.mockReturnThis();
  builder.lt.mockReturnThis();
});

describe('getTodayStats', () => {
  it('sums pages and time from today sessions', async () => {
    builderResolve = {
      data: [
        { start_page: 0, end_page: 30, duration_seconds: 1200, started_at: new Date().toISOString() },
        { start_page: 30, end_page: 60, duration_seconds: 1800, started_at: new Date().toISOString() },
      ],
      error: null,
    };
    const stats = await getTodayStats('user-1');
    expect(stats.pagesRead).toBe(60);
    expect(stats.timeSeconds).toBe(3000);
  });

  it('returns zeros when no sessions today', async () => {
    // First call (today sessions): empty. Second call (all sessions for streak): empty.
    let callCount = 0;
    builder.then.mockImplementation((resolve: any, reject: any) => {
      const val = callCount === 0
        ? { data: [], error: null }
        : { data: [], error: null };
      callCount++;
      return Promise.resolve(val).then(resolve, reject);
    });
    const stats = await getTodayStats('user-1');
    expect(stats.pagesRead).toBe(0);
    expect(stats.timeSeconds).toBe(0);
    expect(stats.streak).toBe(0);
  });
});

describe('getStreak', () => {
  it('returns 0 when there are no sessions', async () => {
    builderResolve = { data: [], error: null };
    const streak = await getStreak('user-1');
    expect(streak).toBe(0);
  });

  it('returns 1 for a session only today', async () => {
    const today = new Date().toISOString();
    builderResolve = { data: [{ started_at: today }], error: null };
    const streak = await getStreak('user-1');
    expect(streak).toBe(1);
  });

  it('counts consecutive days', async () => {
    const days = [0, 1, 2].map(offset => {
      const d = new Date();
      d.setDate(d.getDate() - offset);
      return { started_at: d.toISOString() };
    });
    builderResolve = { data: days, error: null };
    const streak = await getStreak('user-1');
    expect(streak).toBe(3);
  });

  it('stops at a gap', async () => {
    const days = [0, 1, 3].map(offset => { // gap at day 2
      const d = new Date();
      d.setDate(d.getDate() - offset);
      return { started_at: d.toISOString() };
    });
    builderResolve = { data: days, error: null };
    const streak = await getStreak('user-1');
    expect(streak).toBe(2);
  });
});

describe('estimateDaysRemaining', () => {
  it('returns null when pagesPerDay is 0', () => {
    expect(estimateDaysRemaining(0, 50, 300)).toBeNull();
  });

  it('returns 0 when already at or past the end', () => {
    expect(estimateDaysRemaining(10, 300, 300)).toBe(0);
  });

  it('calculates remaining days correctly', () => {
    // 300 - 100 = 200 pages remaining, 20 pages/day = 10 days
    expect(estimateDaysRemaining(20, 100, 300)).toBe(10);
  });

  it('rounds up partial days', () => {
    // 300 - 100 = 200 pages remaining, 30 pages/day = 6.67 → ceil → 7
    expect(estimateDaysRemaining(30, 100, 300)).toBe(7);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest __tests__/lib/stats.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '@/lib/stats'`

- [ ] **Step 3: Implement `lib/stats.ts`**

```typescript
import { supabase } from './supabase';

export interface TodayStats {
  pagesRead: number;
  timeSeconds: number;
  streak: number;
}

function startOfDay(date: Date = new Date()): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function startOfNextDay(date: Date = new Date()): string {
  const d = new Date(date);
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function getTodayStats(userId: string): Promise<TodayStats> {
  const { data, error } = await supabase
    .from('reading_sessions')
    .select('start_page, end_page, duration_seconds, started_at')
    .eq('user_id', userId)
    .gte('started_at', startOfDay())
    .lt('started_at', startOfNextDay());
  if (error) throw error;

  const sessions = data ?? [];
  const pagesRead = sessions.reduce((sum, s) => sum + (s.end_page - s.start_page), 0);
  const timeSeconds = sessions.reduce((sum, s) => sum + s.duration_seconds, 0);
  const streak = await getStreak(userId);
  return { pagesRead, timeSeconds, streak };
}

export async function getStreak(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('reading_sessions')
    .select('started_at')
    .eq('user_id', userId)
    .order('started_at', { ascending: false });
  if (error) throw error;
  if (!data || data.length === 0) return 0;

  const uniqueDays = Array.from(
    new Set(data.map((s) => s.started_at.slice(0, 10)))
  ).sort().reverse();

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  if (uniqueDays[0] !== today && uniqueDays[0] !== yesterday) return 0;

  let streak = 0;
  let expected = uniqueDays[0];

  for (const day of uniqueDays) {
    if (day === expected) {
      streak++;
      const d = new Date(expected);
      d.setDate(d.getDate() - 1);
      expected = d.toISOString().slice(0, 10);
    } else {
      break;
    }
  }

  return streak;
}

export function estimateDaysRemaining(
  pagesPerDay: number,
  currentPage: number,
  pageCount: number
): number | null {
  if (pagesPerDay <= 0) return null;
  const remaining = pageCount - currentPage;
  if (remaining <= 0) return 0;
  return Math.ceil(remaining / pagesPerDay);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/lib/stats.test.ts --no-coverage
```

Expected: PASS — 9 tests, 0 failures

- [ ] **Step 5: Commit**

```bash
git add lib/stats.ts __tests__/lib/stats.test.ts
git commit -m "feat: add stats computations (streak, today pages/time, reading pace)"
```

---

## Task 5: Home dashboard screen

**Files:**
- Modify: `app/(tabs)/index.tsx`
- Modify: `app/_layout.tsx`
- Create: `__tests__/screens/home.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/screens/home.test.tsx`:

```typescript
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import HomeScreen from '@/app/(tabs)/index';

jest.mock('@/lib/auth', () => ({
  useAuth: jest.fn(() => ({
    session: { user: { id: 'user-1' } },
    loading: false,
  })),
}));

const mockCurrentBook = {
  id: 'ub-1',
  user_id: 'user-1',
  book_id: 'book-1',
  shelf: 'reading',
  current_page: 50,
  rating: null,
  review: null,
  added_at: '2026-04-01T00:00:00Z',
  finished_at: null,
  book: {
    id: 'book-1',
    title: 'The Hobbit',
    author: 'J.R.R. Tolkien',
    cover_url: null,
    page_count: 310,
  },
};

jest.mock('@/lib/userBooks', () => ({
  getCurrentBook: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/lib/stats', () => ({
  getTodayStats: jest.fn().mockResolvedValue({ pagesRead: 0, timeSeconds: 0, streak: 0 }),
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

import { getCurrentBook } from '@/lib/userBooks';
import { getTodayStats } from '@/lib/stats';

beforeEach(() => {
  jest.clearAllMocks();
  (getCurrentBook as jest.Mock).mockResolvedValue(null);
  (getTodayStats as jest.Mock).mockResolvedValue({ pagesRead: 0, timeSeconds: 0, streak: 0 });
});

describe('HomeScreen', () => {
  it('shows empty state when no book is being read', async () => {
    render(<HomeScreen />);
    await waitFor(() => {
      expect(screen.getByText('Start a book')).toBeTruthy();
    });
  });

  it('shows current book title and author when reading', async () => {
    (getCurrentBook as jest.Mock).mockResolvedValue(mockCurrentBook);
    render(<HomeScreen />);
    await waitFor(() => {
      expect(screen.getByText('The Hobbit')).toBeTruthy();
      expect(screen.getByText('J.R.R. Tolkien')).toBeTruthy();
    });
  });

  it('shows today stats', async () => {
    (getTodayStats as jest.Mock).mockResolvedValue({ pagesRead: 42, timeSeconds: 3600, streak: 5 });
    render(<HomeScreen />);
    await waitFor(() => {
      expect(screen.getByText('42')).toBeTruthy();  // pages
      expect(screen.getByText('1h 0m')).toBeTruthy(); // time
      expect(screen.getByText('5')).toBeTruthy(); // streak
    });
  });

  it('navigates to session screen on book card tap', async () => {
    (getCurrentBook as jest.Mock).mockResolvedValue(mockCurrentBook);
    render(<HomeScreen />);
    await waitFor(() => screen.getByText('Start Reading'));
    fireEvent.press(screen.getByText('Start Reading'));
    expect(mockPush).toHaveBeenCalledWith('/session/book-1');
  });

  it('navigates to search when no book and tapping Start a book', async () => {
    render(<HomeScreen />);
    await waitFor(() => screen.getByText('Start a book'));
    fireEvent.press(screen.getByText('Start a book'));
    expect(mockPush).toHaveBeenCalledWith('/search');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest __tests__/screens/home.test.tsx --no-coverage
```

Expected: FAIL — HomeScreen imports don't exist yet

- [ ] **Step 3: Implement `app/(tabs)/index.tsx`**

```typescript
import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { getCurrentBook, type UserBookWithBook } from '@/lib/userBooks';
import { getTodayStats, estimateDaysRemaining, type TodayStats } from '@/lib/stats';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function HomeScreen() {
  const { session } = useAuth();
  const userId = session!.user.id;
  const router = useRouter();

  const [currentBook, setCurrentBook] = useState<UserBookWithBook | null>(null);
  const [stats, setStats] = useState<TodayStats>({ pagesRead: 0, timeSeconds: 0, streak: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getCurrentBook(userId), getTodayStats(userId)]).then(([book, todayStats]) => {
      setCurrentBook(book);
      setStats(todayStats);
      setLoading(false);
    });
  }, [userId]);

  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#f0c040" />
      </View>
    );
  }

  const pacePerDay =
    currentBook?.book.page_count && currentBook.current_page > 0
      ? stats.pagesRead
      : 0;
  const daysLeft =
    currentBook?.book.page_count
      ? estimateDaysRemaining(pacePerDay, currentBook.current_page, currentBook.book.page_count)
      : null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.greeting}>{getGreeting()}</Text>
        <Text style={styles.date}>{dateStr}</Text>

        {currentBook ? (
          <View style={styles.bookCard}>
            {currentBook.book.cover_url ? (
              <Image source={{ uri: currentBook.book.cover_url }} style={styles.cover} />
            ) : (
              <View style={styles.coverPlaceholder} />
            )}
            <View style={styles.bookInfo}>
              <Text style={styles.bookTitle}>{currentBook.book.title}</Text>
              <Text style={styles.bookAuthor}>{currentBook.book.author}</Text>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: currentBook.book.page_count
                        ? `${Math.round((currentBook.current_page / currentBook.book.page_count) * 100)}%`
                        : '0%',
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {currentBook.current_page} / {currentBook.book.page_count ?? '?'} pages
                {daysLeft !== null ? ` · ~${daysLeft}d left` : ''}
              </Text>
              <TouchableOpacity
                style={styles.startBtn}
                onPress={() => router.push(`/session/${currentBook.book_id}`)}
              >
                <Text style={styles.startBtnText}>Start Reading</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.emptyCard} onPress={() => router.push('/search')}>
            <Text style={styles.emptyIcon}>📖</Text>
            <Text style={styles.emptyText}>Start a book</Text>
            <Text style={styles.emptySubtext}>Search for something to read</Text>
          </TouchableOpacity>
        )}

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{stats.pagesRead}</Text>
            <Text style={styles.statLabel}>pages</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{formatTime(stats.timeSeconds)}</Text>
            <Text style={styles.statLabel}>today</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{stats.streak}</Text>
            <Text style={styles.statLabel}>🔥 streak</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  center: { flex: 1, backgroundColor: '#0f0f0f', justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20, gap: 20 },
  greeting: { color: '#f0c040', fontSize: 22, fontWeight: '700' },
  date: { color: '#888', fontSize: 14 },
  bookCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    gap: 14,
  },
  cover: { width: 70, height: 105, borderRadius: 6 },
  coverPlaceholder: { width: 70, height: 105, borderRadius: 6, backgroundColor: '#2a2a2a' },
  bookInfo: { flex: 1, gap: 6 },
  bookTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  bookAuthor: { color: '#888', fontSize: 13 },
  progressTrack: { height: 4, backgroundColor: '#2a2a2a', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, backgroundColor: '#f0c040', borderRadius: 2 },
  progressText: { color: '#666', fontSize: 12 },
  startBtn: {
    backgroundColor: '#f0c040',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  startBtnText: { color: '#0f0f0f', fontWeight: '700', fontSize: 14 },
  emptyCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyIcon: { fontSize: 40 },
  emptyText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  emptySubtext: { color: '#888', fontSize: 14 },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    justifyContent: 'space-around',
  },
  stat: { alignItems: 'center', gap: 4 },
  statValue: { color: '#fff', fontSize: 22, fontWeight: '700' },
  statLabel: { color: '#888', fontSize: 12 },
});
```

- [ ] **Step 4: Update `app/_layout.tsx` to register new routes**

Open `app/_layout.tsx`. Replace the `return` statement inside `RootLayoutNav` with:

```typescript
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      <Stack.Screen name="search" options={{ presentation: 'modal' }} />
      <Stack.Screen name="session/[bookId]" />
      <Stack.Screen name="session/manual" />
    </Stack>
  );
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx jest __tests__/screens/home.test.tsx --no-coverage
```

Expected: PASS — 5 tests, 0 failures

- [ ] **Step 6: Commit**

```bash
git add app/(tabs)/index.tsx app/_layout.tsx __tests__/screens/home.test.tsx
git commit -m "feat: implement Home dashboard with current book card and today stats"
```

---

## Task 6: Library screen

**Files:**
- Modify: `app/(tabs)/library.tsx`
- Create: `__tests__/screens/library.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/screens/library.test.tsx`:

```typescript
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import LibraryScreen from '@/app/(tabs)/library';

jest.mock('@/lib/auth', () => ({
  useAuth: jest.fn(() => ({ session: { user: { id: 'user-1' } } })),
}));

const mockBooks = [
  {
    id: 'ub-1',
    user_id: 'user-1',
    book_id: 'book-1',
    shelf: 'reading',
    current_page: 50,
    rating: null,
    review: null,
    added_at: '2026-04-01T00:00:00Z',
    finished_at: null,
    book: { id: 'book-1', title: 'The Hobbit', author: 'Tolkien', cover_url: null, page_count: 310 },
  },
];

jest.mock('@/lib/userBooks', () => ({
  getShelf: jest.fn().mockResolvedValue([]),
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

import { getShelf } from '@/lib/userBooks';

beforeEach(() => {
  jest.clearAllMocks();
  (getShelf as jest.Mock).mockResolvedValue([]);
});

describe('LibraryScreen', () => {
  it('renders all four shelf tabs', async () => {
    render(<LibraryScreen />);
    expect(screen.getByText('Reading')).toBeTruthy();
    expect(screen.getByText('Want')).toBeTruthy();
    expect(screen.getByText('Read')).toBeTruthy();
    expect(screen.getByText('DNF')).toBeTruthy();
  });

  it('shows empty state message when shelf is empty', async () => {
    render(<LibraryScreen />);
    await waitFor(() => {
      expect(screen.getByText('No books here yet')).toBeTruthy();
    });
  });

  it('shows book title when shelf has books', async () => {
    (getShelf as jest.Mock).mockResolvedValue(mockBooks);
    render(<LibraryScreen />);
    await waitFor(() => {
      expect(screen.getByText('The Hobbit')).toBeTruthy();
    });
  });

  it('loads Want shelf when Want tab is tapped', async () => {
    render(<LibraryScreen />);
    fireEvent.press(screen.getByText('Want'));
    await waitFor(() => {
      expect(getShelf).toHaveBeenCalledWith('user-1', 'want');
    });
  });

  it('navigates to search when + button is pressed', async () => {
    render(<LibraryScreen />);
    await waitFor(() => screen.getByText('No books here yet'));
    fireEvent.press(screen.getByText('+'));
    expect(mockPush).toHaveBeenCalledWith('/search');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest __tests__/screens/library.test.tsx --no-coverage
```

Expected: FAIL — LibraryScreen is still a stub

- [ ] **Step 3: Implement `app/(tabs)/library.tsx`**

```typescript
import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { getShelf, type UserBookWithBook } from '@/lib/userBooks';
import { Shelf } from '@/types/database';

const SHELVES: { key: Shelf; label: string }[] = [
  { key: 'reading', label: 'Reading' },
  { key: 'want', label: 'Want' },
  { key: 'read', label: 'Read' },
  { key: 'dnf', label: 'DNF' },
];

export default function LibraryScreen() {
  const { session } = useAuth();
  const userId = session!.user.id;
  const router = useRouter();

  const [activeShelf, setActiveShelf] = useState<Shelf>('reading');
  const [books, setBooks] = useState<UserBookWithBook[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getShelf(userId, activeShelf)
      .then(setBooks)
      .finally(() => setLoading(false));
  }, [userId, activeShelf]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.tabs}>
        {SHELVES.map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={[styles.tab, activeShelf === key && styles.activeTab]}
            onPress={() => setActiveShelf(key)}
          >
            <Text style={[styles.tabText, activeShelf === key && styles.activeTabText]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#f0c040" />
        </View>
      ) : (
        <FlatList
          data={books}
          keyExtractor={(item) => item.id}
          contentContainerStyle={books.length === 0 ? styles.emptyContainer : styles.list}
          renderItem={({ item }) => <BookCard book={item} shelf={activeShelf} />}
          ListEmptyComponent={<Text style={styles.emptyText}>No books here yet</Text>}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => router.push('/search')}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function BookCard({ book, shelf }: { book: UserBookWithBook; shelf: Shelf }) {
  const progress = book.book.page_count ? book.current_page / book.book.page_count : 0;

  return (
    <View style={styles.card}>
      {book.book.cover_url ? (
        <Image source={{ uri: book.book.cover_url }} style={styles.cover} />
      ) : (
        <View style={styles.coverPlaceholder} />
      )}
      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle} numberOfLines={2}>{book.book.title}</Text>
        <Text style={styles.cardAuthor}>{book.book.author}</Text>
        {shelf === 'reading' && book.book.page_count && (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
        )}
        {shelf === 'read' && book.rating !== null && (
          <Text style={styles.rating}>{'★'.repeat(book.rating)}{'☆'.repeat(5 - book.rating)}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  activeTab: { borderBottomWidth: 2, borderBottomColor: '#f0c040' },
  tabText: { color: '#555', fontSize: 13, fontWeight: '600' },
  activeTabText: { color: '#f0c040' },
  list: { padding: 16, gap: 12 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#555', fontSize: 15 },
  card: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 12,
    gap: 12,
  },
  cover: { width: 56, height: 84, borderRadius: 4 },
  coverPlaceholder: { width: 56, height: 84, borderRadius: 4, backgroundColor: '#2a2a2a' },
  cardInfo: { flex: 1, gap: 4, justifyContent: 'center' },
  cardTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },
  cardAuthor: { color: '#888', fontSize: 13 },
  progressTrack: { height: 3, backgroundColor: '#2a2a2a', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 3, backgroundColor: '#f0c040', borderRadius: 2 },
  rating: { color: '#f0c040', fontSize: 14 },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#f0c040',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  fabText: { color: '#0f0f0f', fontSize: 28, fontWeight: '700', lineHeight: 32 },
});
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/screens/library.test.tsx --no-coverage
```

Expected: PASS — 5 tests, 0 failures

- [ ] **Step 5: Commit**

```bash
git add app/(tabs)/library.tsx __tests__/screens/library.test.tsx
git commit -m "feat: implement Library screen with 4 shelf tabs and floating add button"
```

---

## Task 7: Book search screen

**Files:**
- Create: `app/search.tsx`
- Create: `__tests__/screens/search.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/screens/search.test.tsx`:

```typescript
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import SearchScreen from '@/app/search';
import { ActionSheetIOS } from 'react-native';

jest.mock('@/lib/auth', () => ({
  useAuth: jest.fn(() => ({ session: { user: { id: 'user-1' } } })),
}));

jest.mock('@/lib/books', () => ({
  searchBooks: jest.fn().mockResolvedValue([]),
  upsertBook: jest.fn().mockResolvedValue('book-uuid'),
}));

jest.mock('@/lib/userBooks', () => ({
  addToShelf: jest.fn().mockResolvedValue('ub-uuid'),
}));

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
}));

jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation(
  (_options, callback) => callback(1) // simulate selecting "Reading" (index 1)
);

import { searchBooks, upsertBook } from '@/lib/books';
import { addToShelf } from '@/lib/userBooks';

const mockResult = {
  google_books_id: 'gbk1',
  title: 'The Hobbit',
  author: 'Tolkien',
  cover_url: null,
  page_count: 310,
  genres: ['Fantasy'],
};

beforeEach(() => {
  jest.clearAllMocks();
  (searchBooks as jest.Mock).mockResolvedValue([]);
  (upsertBook as jest.Mock).mockResolvedValue('book-uuid');
  (addToShelf as jest.Mock).mockResolvedValue('ub-uuid');
  jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation(
    (_options, callback) => callback(1)
  );
});

describe('SearchScreen', () => {
  it('renders search input', () => {
    render(<SearchScreen />);
    expect(screen.getByPlaceholderText('Search by title or author...')).toBeTruthy();
  });

  it('shows results after typing', async () => {
    (searchBooks as jest.Mock).mockResolvedValue([mockResult]);
    jest.useFakeTimers();
    render(<SearchScreen />);
    fireEvent.changeText(
      screen.getByPlaceholderText('Search by title or author...'),
      'hobbit'
    );
    await act(async () => { jest.advanceTimersByTime(500); });
    await waitFor(() => expect(screen.getByText('The Hobbit')).toBeTruthy());
    jest.useRealTimers();
  });

  it('clears results when input is cleared', async () => {
    (searchBooks as jest.Mock).mockResolvedValue([mockResult]);
    jest.useFakeTimers();
    render(<SearchScreen />);
    const input = screen.getByPlaceholderText('Search by title or author...');
    fireEvent.changeText(input, 'hobbit');
    await act(async () => { jest.advanceTimersByTime(500); });
    await waitFor(() => screen.getByText('The Hobbit'));
    fireEvent.changeText(input, '');
    expect(screen.queryByText('The Hobbit')).toBeNull();
    jest.useRealTimers();
  });

  it('shows action sheet when result is tapped', async () => {
    (searchBooks as jest.Mock).mockResolvedValue([mockResult]);
    jest.useFakeTimers();
    render(<SearchScreen />);
    fireEvent.changeText(
      screen.getByPlaceholderText('Search by title or author...'),
      'hobbit'
    );
    await act(async () => { jest.advanceTimersByTime(500); });
    await waitFor(() => screen.getByText('The Hobbit'));
    fireEvent.press(screen.getByText('The Hobbit'));
    expect(ActionSheetIOS.showActionSheetWithOptions).toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('upserts book and adds to shelf then navigates back', async () => {
    (searchBooks as jest.Mock).mockResolvedValue([mockResult]);
    jest.useFakeTimers();
    render(<SearchScreen />);
    fireEvent.changeText(
      screen.getByPlaceholderText('Search by title or author...'),
      'hobbit'
    );
    await act(async () => { jest.advanceTimersByTime(500); });
    await waitFor(() => screen.getByText('The Hobbit'));
    fireEvent.press(screen.getByText('The Hobbit'));
    await waitFor(() => expect(upsertBook).toHaveBeenCalledWith(mockResult));
    expect(addToShelf).toHaveBeenCalledWith('user-1', 'book-uuid', 'reading');
    expect(mockBack).toHaveBeenCalled();
    jest.useRealTimers();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest __tests__/screens/search.test.tsx --no-coverage
```

Expected: FAIL — `Cannot find module '@/app/search'`

- [ ] **Step 3: Implement `app/search.tsx`**

```typescript
import { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  ActionSheetIOS,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { searchBooks, upsertBook, type BookSearchResult } from '@/lib/books';
import { addToShelf } from '@/lib/userBooks';
import { Shelf } from '@/types/database';

const SHELF_OPTIONS = ['Cancel', 'Reading', 'Want to Read', 'Read', 'Did Not Finish'] as const;
const SHELF_KEYS: (Shelf | null)[] = [null, 'reading', 'want', 'read', 'dnf'];

export default function SearchScreen() {
  const { session } = useAuth();
  const userId = session!.user.id;
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BookSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onChangeText = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const items = await searchBooks(text.trim());
        setResults(items);
      } finally {
        setSearching(false);
      }
    }, 400);
  };

  const addBook = async (book: BookSearchResult, shelf: Shelf) => {
    const bookId = await upsertBook(book);
    await addToShelf(userId, bookId, shelf);
    router.back();
  };

  const showShelfPicker = (book: BookSearchResult) => {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [...SHELF_OPTIONS],
        cancelButtonIndex: 0,
        title: `Add "${book.title}" to...`,
      },
      (buttonIndex) => {
        const shelf = SHELF_KEYS[buttonIndex];
        if (shelf) addBook(book, shelf);
      }
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TextInput
          style={styles.input}
          placeholder="Search by title or author..."
          placeholderTextColor="#555"
          value={query}
          onChangeText={onChangeText}
          autoFocus
          returnKeyType="search"
        />
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.cancel}>Cancel</Text>
        </TouchableOpacity>
      </View>

      {searching && <ActivityIndicator color="#f0c040" style={styles.spinner} />}

      <FlatList
        data={results}
        keyExtractor={(item) => item.google_books_id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.result} onPress={() => showShelfPicker(item)}>
            {item.cover_url ? (
              <Image source={{ uri: item.cover_url }} style={styles.cover} />
            ) : (
              <View style={styles.coverPlaceholder} />
            )}
            <View style={styles.info}>
              <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
              <Text style={styles.author}>{item.author}</Text>
              {item.page_count && (
                <Text style={styles.pages}>{item.page_count} pages</Text>
              )}
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  input: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    color: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  cancel: { color: '#f0c040', fontSize: 15 },
  spinner: { marginVertical: 16 },
  list: { padding: 16, gap: 12 },
  result: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 12,
    gap: 12,
  },
  cover: { width: 50, height: 75, borderRadius: 4 },
  coverPlaceholder: { width: 50, height: 75, borderRadius: 4, backgroundColor: '#2a2a2a' },
  info: { flex: 1, gap: 4, justifyContent: 'center' },
  title: { color: '#fff', fontSize: 15, fontWeight: '600' },
  author: { color: '#888', fontSize: 13 },
  pages: { color: '#555', fontSize: 12 },
});
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/screens/search.test.tsx --no-coverage
```

Expected: PASS — 5 tests, 0 failures

- [ ] **Step 5: Commit**

```bash
git add app/search.tsx __tests__/screens/search.test.tsx
git commit -m "feat: implement book search screen with Google Books API and shelf picker"
```

---

## Task 8: Timer session screen

**Files:**
- Create: `app/session/[bookId].tsx`
- Create: `__tests__/screens/session.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/screens/session.test.tsx`:

```typescript
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import SessionScreen from '@/app/session/[bookId]';

jest.mock('@/lib/auth', () => ({
  useAuth: jest.fn(() => ({ session: { user: { id: 'user-1' } } })),
}));

const mockUserBook = {
  id: 'ub-1',
  user_id: 'user-1',
  book_id: 'book-1',
  shelf: 'reading',
  current_page: 50,
  rating: null,
  review: null,
  added_at: '2026-04-01T00:00:00Z',
  finished_at: null,
  book: { id: 'book-1', title: 'The Hobbit', author: 'Tolkien', cover_url: null, page_count: 310 },
};

jest.mock('@/lib/userBooks', () => ({
  getUserBook: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/lib/sessions', () => ({
  createSession: jest.fn().mockResolvedValue(undefined),
}));

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
  useLocalSearchParams: () => ({ bookId: 'book-1' }),
}));

import { getUserBook } from '@/lib/userBooks';
import { createSession } from '@/lib/sessions';

beforeEach(() => {
  jest.clearAllMocks();
  (getUserBook as jest.Mock).mockResolvedValue(mockUserBook);
  (createSession as jest.Mock).mockResolvedValue(undefined);
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('SessionScreen', () => {
  it('shows start page input in setup phase', async () => {
    render(<SessionScreen />);
    await waitFor(() => expect(screen.getByText('The Hobbit')).toBeTruthy());
    expect(screen.getByPlaceholderText('Starting page')).toBeTruthy();
    expect(screen.getByText('Start Reading')).toBeTruthy();
  });

  it('starts the timer when Start Reading is pressed', async () => {
    render(<SessionScreen />);
    await waitFor(() => screen.getByText('Start Reading'));
    fireEvent.changeText(screen.getByPlaceholderText('Starting page'), '50');
    fireEvent.press(screen.getByText('Start Reading'));
    expect(screen.getByText('0:00')).toBeTruthy();
    expect(screen.getByText('Pause')).toBeTruthy();
  });

  it('increments the timer each second', async () => {
    render(<SessionScreen />);
    await waitFor(() => screen.getByText('Start Reading'));
    fireEvent.changeText(screen.getByPlaceholderText('Starting page'), '50');
    fireEvent.press(screen.getByText('Start Reading'));
    act(() => { jest.advanceTimersByTime(3000); });
    expect(screen.getByText('0:03')).toBeTruthy();
  });

  it('pauses and resumes the timer', async () => {
    render(<SessionScreen />);
    await waitFor(() => screen.getByText('Start Reading'));
    fireEvent.changeText(screen.getByPlaceholderText('Starting page'), '50');
    fireEvent.press(screen.getByText('Start Reading'));
    act(() => { jest.advanceTimersByTime(5000); });
    fireEvent.press(screen.getByText('Pause'));
    expect(screen.getByText('Resume')).toBeTruthy();
    act(() => { jest.advanceTimersByTime(5000); });
    expect(screen.getByText('0:05')).toBeTruthy(); // time frozen while paused
    fireEvent.press(screen.getByText('Resume'));
    act(() => { jest.advanceTimersByTime(2000); });
    expect(screen.getByText('0:07')).toBeTruthy();
  });

  it('shows end page input after tapping Finish', async () => {
    render(<SessionScreen />);
    await waitFor(() => screen.getByText('Start Reading'));
    fireEvent.changeText(screen.getByPlaceholderText('Starting page'), '50');
    fireEvent.press(screen.getByText('Start Reading'));
    fireEvent.press(screen.getByText('Finish'));
    expect(screen.getByPlaceholderText('Ending page')).toBeTruthy();
    expect(screen.getByText('Save Session')).toBeTruthy();
  });

  it('saves session and navigates back', async () => {
    render(<SessionScreen />);
    await waitFor(() => screen.getByText('Start Reading'));
    fireEvent.changeText(screen.getByPlaceholderText('Starting page'), '50');
    fireEvent.press(screen.getByText('Start Reading'));
    act(() => { jest.advanceTimersByTime(1800000); }); // 30 minutes
    fireEvent.press(screen.getByText('Finish'));
    fireEvent.changeText(screen.getByPlaceholderText('Ending page'), '80');
    fireEvent.press(screen.getByText('Save Session'));
    await waitFor(() => expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        bookId: 'book-1',
        userBookId: 'ub-1',
        startPage: 50,
        endPage: 80,
        durationSeconds: 1800,
      })
    ));
    expect(mockBack).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest __tests__/screens/session.test.tsx --no-coverage
```

Expected: FAIL — `Cannot find module '@/app/session/[bookId]'`

- [ ] **Step 3: Implement `app/session/[bookId].tsx`**

```typescript
import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { getUserBook, type UserBookWithBook } from '@/lib/userBooks';
import { createSession } from '@/lib/sessions';

type Phase = 'setup' | 'running' | 'paused' | 'finish';

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function SessionScreen() {
  const { bookId } = useLocalSearchParams<{ bookId: string }>();
  const { session } = useAuth();
  const userId = session!.user.id;
  const router = useRouter();

  const [userBook, setUserBook] = useState<UserBookWithBook | null>(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<Phase>('setup');
  const [startPage, setStartPage] = useState('');
  const [endPage, setEndPage] = useState('');
  const [seconds, setSeconds] = useState(0);
  const startedAtRef = useRef<Date>(new Date());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    getUserBook(userId, bookId).then((book) => {
      setUserBook(book);
      if (book) setStartPage(String(book.current_page));
      setLoading(false);
    });
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [userId, bookId]);

  const startTimer = () => {
    startedAtRef.current = new Date();
    setPhase('running');
    intervalRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  };

  const pauseTimer = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setPhase('paused');
  };

  const resumeTimer = () => {
    setPhase('running');
    intervalRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  };

  const finishTimer = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setPhase('finish');
  };

  const saveSession = async () => {
    const sp = parseInt(startPage, 10);
    const ep = parseInt(endPage, 10);
    if (isNaN(sp) || isNaN(ep) || ep <= sp || !userBook) return;

    await createSession({
      userId,
      bookId,
      userBookId: userBook.id,
      startPage: sp,
      endPage: ep,
      durationSeconds: seconds,
      startedAt: startedAtRef.current,
    });
    router.back();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#f0c040" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      {userBook && (
        <Text style={styles.bookTitle} numberOfLines={1}>{userBook.book.title}</Text>
      )}

      <View style={styles.timerArea}>
        <Text style={styles.timer}>{formatTimer(seconds)}</Text>
      </View>

      {phase === 'setup' && (
        <View style={styles.controls}>
          <TextInput
            style={styles.input}
            placeholder="Starting page"
            placeholderTextColor="#555"
            value={startPage}
            onChangeText={setStartPage}
            keyboardType="number-pad"
          />
          <TouchableOpacity style={styles.primaryBtn} onPress={startTimer}>
            <Text style={styles.primaryBtnText}>Start Reading</Text>
          </TouchableOpacity>
        </View>
      )}

      {phase === 'running' && (
        <View style={styles.controls}>
          <TouchableOpacity style={styles.secondaryBtn} onPress={pauseTimer}>
            <Text style={styles.secondaryBtnText}>Pause</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryBtn} onPress={finishTimer}>
            <Text style={styles.primaryBtnText}>Finish</Text>
          </TouchableOpacity>
        </View>
      )}

      {phase === 'paused' && (
        <View style={styles.controls}>
          <TouchableOpacity style={styles.secondaryBtn} onPress={resumeTimer}>
            <Text style={styles.secondaryBtnText}>Resume</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryBtn} onPress={finishTimer}>
            <Text style={styles.primaryBtnText}>Finish</Text>
          </TouchableOpacity>
        </View>
      )}

      {phase === 'finish' && (
        <View style={styles.controls}>
          <TextInput
            style={styles.input}
            placeholder="Ending page"
            placeholderTextColor="#555"
            value={endPage}
            onChangeText={setEndPage}
            keyboardType="number-pad"
          />
          <TouchableOpacity style={styles.primaryBtn} onPress={saveSession}>
            <Text style={styles.primaryBtnText}>Save Session</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f', padding: 24 },
  center: { flex: 1, backgroundColor: '#0f0f0f', justifyContent: 'center', alignItems: 'center' },
  backBtn: { marginBottom: 8 },
  backText: { color: '#888', fontSize: 15 },
  bookTitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 40 },
  timerArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  timer: { color: '#f0c040', fontSize: 72, fontWeight: '200', fontVariant: ['tabular-nums'] },
  controls: { gap: 12 },
  input: {
    backgroundColor: '#1a1a1a',
    color: '#fff',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  primaryBtn: {
    backgroundColor: '#f0c040',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#0f0f0f', fontSize: 16, fontWeight: '700' },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
  },
  secondaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/screens/session.test.tsx --no-coverage
```

Expected: PASS — 6 tests, 0 failures

- [ ] **Step 5: Commit**

```bash
git add "app/session/[bookId].tsx" __tests__/screens/session.test.tsx
git commit -m "feat: implement timer-based reading session screen"
```

---

## Task 9: Manual session log

**Files:**
- Create: `app/session/manual.tsx`
- Create: `__tests__/screens/sessionManual.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/screens/sessionManual.test.tsx`:

```typescript
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import ManualSessionScreen from '@/app/session/manual';

jest.mock('@/lib/auth', () => ({
  useAuth: jest.fn(() => ({ session: { user: { id: 'user-1' } } })),
}));

const mockUserBook = {
  id: 'ub-1',
  user_id: 'user-1',
  book_id: 'book-1',
  shelf: 'reading',
  current_page: 50,
  rating: null,
  review: null,
  added_at: '2026-04-01T00:00:00Z',
  finished_at: null,
  book: { id: 'book-1', title: 'The Hobbit', author: 'Tolkien', cover_url: null, page_count: 310 },
};

jest.mock('@/lib/userBooks', () => ({
  getShelf: jest.fn().mockResolvedValue([mockUserBook]),
}));

jest.mock('@/lib/sessions', () => ({
  createSession: jest.fn().mockResolvedValue(undefined),
}));

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
}));

import { createSession } from '@/lib/sessions';
import { getShelf } from '@/lib/userBooks';

beforeEach(() => {
  jest.clearAllMocks();
  (getShelf as jest.Mock).mockResolvedValue([mockUserBook]);
  (createSession as jest.Mock).mockResolvedValue(undefined);
});

describe('ManualSessionScreen', () => {
  it('renders start page, end page and time inputs', async () => {
    render(<ManualSessionScreen />);
    await waitFor(() => screen.getByText('The Hobbit'));
    expect(screen.getByPlaceholderText('Start page')).toBeTruthy();
    expect(screen.getByPlaceholderText('End page')).toBeTruthy();
    expect(screen.getByPlaceholderText('HH:MM')).toBeTruthy();
  });

  it('shows error when end page is not greater than start page', async () => {
    render(<ManualSessionScreen />);
    await waitFor(() => screen.getByText('Log Session'));
    fireEvent.changeText(screen.getByPlaceholderText('Start page'), '80');
    fireEvent.changeText(screen.getByPlaceholderText('End page'), '50');
    fireEvent.changeText(screen.getByPlaceholderText('HH:MM'), '0:30');
    fireEvent.press(screen.getByText('Log Session'));
    expect(screen.getByText('End page must be greater than start page')).toBeTruthy();
    expect(createSession).not.toHaveBeenCalled();
  });

  it('shows error when time format is invalid', async () => {
    render(<ManualSessionScreen />);
    await waitFor(() => screen.getByText('Log Session'));
    fireEvent.changeText(screen.getByPlaceholderText('Start page'), '50');
    fireEvent.changeText(screen.getByPlaceholderText('End page'), '80');
    fireEvent.changeText(screen.getByPlaceholderText('HH:MM'), 'not-a-time');
    fireEvent.press(screen.getByText('Log Session'));
    expect(screen.getByText('Enter time as H:MM or HH:MM')).toBeTruthy();
    expect(createSession).not.toHaveBeenCalled();
  });

  it('saves session and navigates back on valid input', async () => {
    render(<ManualSessionScreen />);
    await waitFor(() => screen.getByText('Log Session'));
    fireEvent.changeText(screen.getByPlaceholderText('Start page'), '50');
    fireEvent.changeText(screen.getByPlaceholderText('End page'), '80');
    fireEvent.changeText(screen.getByPlaceholderText('HH:MM'), '0:30');
    fireEvent.press(screen.getByText('Log Session'));
    await waitFor(() => expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        userBookId: 'ub-1',
        startPage: 50,
        endPage: 80,
        durationSeconds: 1800,
      })
    ));
    expect(mockBack).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest __tests__/screens/sessionManual.test.tsx --no-coverage
```

Expected: FAIL — `Cannot find module '@/app/session/manual'`

- [ ] **Step 3: Implement `app/session/manual.tsx`**

```typescript
import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { getShelf, type UserBookWithBook } from '@/lib/userBooks';
import { createSession } from '@/lib/sessions';

function parseTime(hhmm: string): number | null {
  const parts = hhmm.split(':');
  if (parts.length !== 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m) || m < 0 || m > 59) return null;
  return h * 3600 + m * 60;
}

export default function ManualSessionScreen() {
  const { session } = useAuth();
  const userId = session!.user.id;
  const router = useRouter();

  const [readingBooks, setReadingBooks] = useState<UserBookWithBook[]>([]);
  const [selectedBook, setSelectedBook] = useState<UserBookWithBook | null>(null);
  const [loading, setLoading] = useState(true);
  const [startPage, setStartPage] = useState('');
  const [endPage, setEndPage] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    getShelf(userId, 'reading').then((books) => {
      setReadingBooks(books);
      if (books.length > 0) {
        setSelectedBook(books[0]);
        setStartPage(String(books[0].current_page));
      }
      setLoading(false);
    });
  }, [userId]);

  const logSession = async () => {
    setError('');
    const sp = parseInt(startPage, 10);
    const ep = parseInt(endPage, 10);
    if (isNaN(sp) || isNaN(ep) || ep <= sp) {
      setError('End page must be greater than start page');
      return;
    }
    const durationSeconds = parseTime(timeStr);
    if (durationSeconds === null || durationSeconds <= 0) {
      setError('Enter time as H:MM or HH:MM');
      return;
    }
    if (!selectedBook) return;

    await createSession({
      userId,
      bookId: selectedBook.book_id,
      userBookId: selectedBook.id,
      startPage: sp,
      endPage: ep,
      durationSeconds,
      startedAt: new Date(),
    });
    router.back();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#f0c040" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.heading}>Log a Session</Text>

        {selectedBook && (
          <Text style={styles.bookTitle}>{selectedBook.book.title}</Text>
        )}

        {readingBooks.length === 0 && (
          <Text style={styles.noBooks}>No books currently being read</Text>
        )}

        {readingBooks.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bookPicker}>
            {readingBooks.map((book) => (
              <TouchableOpacity
                key={book.id}
                style={[
                  styles.bookChip,
                  selectedBook?.id === book.id && styles.bookChipActive,
                ]}
                onPress={() => {
                  setSelectedBook(book);
                  setStartPage(String(book.current_page));
                }}
              >
                <Text style={styles.bookChipText} numberOfLines={1}>{book.book.title}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <View style={styles.row}>
          <View style={styles.halfField}>
            <Text style={styles.label}>Start page</Text>
            <TextInput
              style={styles.input}
              placeholder="Start page"
              placeholderTextColor="#555"
              value={startPage}
              onChangeText={setStartPage}
              keyboardType="number-pad"
            />
          </View>
          <View style={styles.halfField}>
            <Text style={styles.label}>End page</Text>
            <TextInput
              style={styles.input}
              placeholder="End page"
              placeholderTextColor="#555"
              value={endPage}
              onChangeText={setEndPage}
              keyboardType="number-pad"
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Time spent</Text>
          <TextInput
            style={styles.input}
            placeholder="HH:MM"
            placeholderTextColor="#555"
            value={timeStr}
            onChangeText={setTimeStr}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity style={styles.saveBtn} onPress={logSession}>
          <Text style={styles.saveBtnText}>Log Session</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  center: { flex: 1, backgroundColor: '#0f0f0f', justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 24, gap: 20 },
  backBtn: {},
  backText: { color: '#888', fontSize: 15 },
  heading: { color: '#fff', fontSize: 22, fontWeight: '700' },
  bookTitle: { color: '#f0c040', fontSize: 16, fontWeight: '600' },
  noBooks: { color: '#888', fontSize: 15 },
  bookPicker: { flexGrow: 0 },
  bookChip: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    maxWidth: 160,
  },
  bookChipActive: { backgroundColor: '#f0c040' },
  bookChipText: { color: '#fff', fontSize: 13 },
  row: { flexDirection: 'row', gap: 12 },
  halfField: { flex: 1, gap: 6 },
  field: { gap: 6 },
  label: { color: '#888', fontSize: 13 },
  input: {
    backgroundColor: '#1a1a1a',
    color: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
  },
  error: { color: '#ff4444', fontSize: 13 },
  saveBtn: {
    backgroundColor: '#f0c040',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveBtnText: { color: '#0f0f0f', fontSize: 16, fontWeight: '700' },
});
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/screens/sessionManual.test.tsx --no-coverage
```

Expected: PASS — 4 tests, 0 failures

- [ ] **Step 5: Run the full test suite to verify nothing regressed**

```bash
npx jest --no-coverage
```

Expected: All suites pass (16 original Phase 1 tests + ~42 new Phase 2 tests)

- [ ] **Step 6: Commit**

```bash
git add app/session/manual.tsx __tests__/screens/sessionManual.test.tsx
git commit -m "feat: implement manual reading session log screen"
```
