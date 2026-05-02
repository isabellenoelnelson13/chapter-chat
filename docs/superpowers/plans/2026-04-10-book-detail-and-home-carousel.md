# Book Detail + Home Carousel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a book detail page, a swipeable carousel for multiple books in progress on the home screen, and tappable library cards that navigate to the detail page.

**Architecture:** Four sequential tasks — data layer first (description column propagated through types → lib → DB), then the new screen, then the two existing-screen updates. Each task is self-contained and leaves the app in a working state.

**Tech Stack:** Expo Router, React Native, Supabase, `@expo/vector-icons` (Ionicons), `constants/theme.ts` tokens, `ActionSheetIOS`, horizontal `ScrollView` with `pagingEnabled`, `Dimensions` from `react-native`.

---

## File Map

```
types/database.ts               MODIFY — add description to books.Row / Insert / Update
lib/books.ts                    MODIFY — add description to BookSearchResult, volumeToBook, upsertBook
lib/userBooks.ts                MODIFY — add description to BOOK_SELECT and UserBookWithBook.book
__tests__/lib/books.test.ts     MODIFY — add description: null to all toEqual assertions and fixtures
app/book/[bookId].tsx           CREATE — book detail screen
__tests__/screens/bookDetail.test.tsx  CREATE — book detail tests
app/(tabs)/library.tsx          MODIFY — wrap BookCard in TouchableOpacity → router.push
__tests__/screens/library.test.tsx     MODIFY — add tappable card test, add description to fixtures
app/(tabs)/index.tsx            MODIFY — carousel, getShelf instead of getCurrentBook
__tests__/screens/home.test.tsx MODIFY — mock getShelf, add multi-book carousel test, add description to fixtures
```

---

## Task 1: Data Layer — description field

**Files:**
- Modify: `types/database.ts`
- Modify: `lib/books.ts`
- Modify: `lib/userBooks.ts`
- Modify: `__tests__/lib/books.test.ts`

> **Manual prerequisite:** Before running any tests, run this SQL in the Supabase dashboard (SQL editor):
> ```sql
> ALTER TABLE books ADD COLUMN description text;
> ```

- [ ] **Step 1: Update the failing tests first**

Open `__tests__/lib/books.test.ts`. The `toEqual` assertions check the exact shape of `BookSearchResult`. Once `description` is added to the type, `volumeToBook` will include it and these assertions will fail. Add `description: null` to every expected object now so the test describes the target state.

Replace the `fakeVolume` block and the two full `toEqual` assertions as shown:

```typescript
const fakeVolume = {
  id: 'gbk123',
  volumeInfo: {
    title: 'The Hobbit',
    authors: ['J.R.R. Tolkien'],
    imageLinks: { thumbnail: 'http://books.google.com/cover.jpg' },
    pageCount: 310,
    categories: ['Fantasy'],
    // no description field → will map to null
  },
};
```

In the `searchBooks` describe block, update the `toEqual` assertion:

```typescript
expect(results[0]).toEqual({
  google_books_id: 'gbk123',
  title: 'The Hobbit',
  author: 'J.R.R. Tolkien',
  cover_url: 'https://books.google.com/cover.jpg',
  page_count: 310,
  genres: ['Fantasy'],
  description: null,
});
```

In the `fetchBookByGoogleId` describe block, update the `toEqual` assertion:

```typescript
expect(result).toEqual({
  google_books_id: 'gbk123',
  title: 'The Hobbit',
  author: 'J.R.R. Tolkien',
  cover_url: 'https://books.google.com/cover.jpg',
  page_count: 310,
  genres: ['Fantasy'],
  description: null,
});
```

In the `upsertBook` describe block, the fixture is typed as `BookSearchResult` and will fail TypeScript once the type requires `description`. Add `description: null` to both book literals:

```typescript
// First upsertBook test:
const book: BookSearchResult = {
  google_books_id: 'gbk123',
  title: 'The Hobbit',
  author: 'J.R.R. Tolkien',
  cover_url: 'https://books.google.com/cover.jpg',
  page_count: 310,
  genres: ['Fantasy'],
  description: null,
};

// Second upsertBook test (throws on error):
await expect(upsertBook({
  google_books_id: 'x',
  title: 'X',
  author: 'A',
  cover_url: null,
  page_count: null,
  genres: null,
  description: null,
})).rejects.toEqual({ message: 'DB error' });
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/isabellenelson/WebstormProjects/bookapp
npx jest __tests__/lib/books.test.ts --no-coverage
```

Expected: tests FAIL because `BookSearchResult` doesn't have `description` yet and `volumeToBook` doesn't return it.

- [ ] **Step 3: Add description to `types/database.ts`**

In `types/database.ts`, add `description: string | null` to `books.Row`, `books.Insert`, and `books.Update`:

```typescript
books: {
  Row: {
    id: string;
    google_books_id: string | null;
    title: string;
    author: string;
    cover_url: string | null;
    page_count: number | null;
    genres: string[] | null;
    description: string | null;   // ← ADD
    created_at: string;
  };
  Insert: {
    id?: string;
    google_books_id?: string | null;
    title: string;
    author: string;
    cover_url?: string | null;
    page_count?: number | null;
    genres?: string[] | null;
    description?: string | null;  // ← ADD
    created_at?: string;
  };
  Update: {
    google_books_id?: string | null;
    title?: string;
    author?: string;
    cover_url?: string | null;
    page_count?: number | null;
    genres?: string[] | null;
    description?: string | null;  // ← ADD
  };
};
```

- [ ] **Step 4: Add description to `lib/books.ts`**

Add `description: string | null` to `BookSearchResult`, extract it in `volumeToBook`, and include it in the `upsertBook` payload:

```typescript
export interface BookSearchResult {
  google_books_id: string;
  title: string;
  author: string;
  cover_url: string | null;
  page_count: number | null;
  genres: string[] | null;
  description: string | null;   // ← ADD
}

function volumeToBook(volume: any): BookSearchResult {
  const info = volume.volumeInfo ?? {};
  const thumbnail: string | null = info.imageLinks?.thumbnail ?? null;
  return {
    google_books_id: volume.id ?? '',
    title: info.title ?? 'Unknown Title',
    author: (info.authors ?? [])[0] ?? 'Unknown Author',
    cover_url: thumbnail ? thumbnail.replace('http://', 'https://') : null,
    page_count: info.pageCount ?? null,
    genres: info.categories ?? null,
    description: info.description ?? null,   // ← ADD
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
        description: book.description,   // ← ADD
      },
      { onConflict: 'google_books_id' }
    )
    .select('id')
    .single();
  if (error) throw error;
  if (!data) throw new Error('upsertBook: no data returned from Supabase');
  return data.id;
}
```

- [ ] **Step 5: Add description to `lib/userBooks.ts`**

Update `BOOK_SELECT` to include `description`, and update `UserBookWithBook.book` to include `description` via intersection type (avoids regenerating the full Supabase type):

```typescript
const BOOK_SELECT = '*, book:books(id, title, author, cover_url, page_count, description)';

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
  book: Pick<BookRow, 'id' | 'title' | 'author' | 'cover_url' | 'page_count'> & {
    description: string | null;
  };
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npx jest __tests__/lib/books.test.ts --no-coverage
```

Expected: all 8 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add types/database.ts lib/books.ts lib/userBooks.ts __tests__/lib/books.test.ts
git commit -m "feat: add description field to books data layer"
```

---

## Task 2: Book Detail Screen

**Files:**
- Create: `app/book/[bookId].tsx`
- Create: `__tests__/screens/bookDetail.test.tsx`

- [ ] **Step 1: Write the failing test file**

Create `__tests__/screens/bookDetail.test.tsx`:

```typescript
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { ActionSheetIOS } from 'react-native';
import BookDetailScreen from '@/app/book/[bookId]';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(() => { cb(); }, []);
  },
}));

jest.mock('@/lib/auth', () => ({
  useAuth: jest.fn(() => ({
    session: { user: { id: 'user-1' } },
  })),
}));

jest.mock('@/lib/userBooks', () => ({
  getUserBook: jest.fn().mockResolvedValue(null),
  moveShelf: jest.fn().mockResolvedValue(undefined),
  rateBook: jest.fn().mockResolvedValue(undefined),
}));

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
  useLocalSearchParams: () => ({ bookId: 'book-1' }),
}));

import { getUserBook, moveShelf, rateBook } from '@/lib/userBooks';

const mockReadingBook = {
  id: 'ub-1',
  user_id: 'user-1',
  book_id: 'book-1',
  shelf: 'reading' as const,
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
    description: 'In a hole in the ground there lived a hobbit.',
  },
};

const mockReadBook = {
  ...mockReadingBook,
  id: 'ub-2',
  shelf: 'read' as const,
  rating: 4,
};

beforeEach(() => {
  jest.clearAllMocks();
  (getUserBook as jest.Mock).mockResolvedValue(null);
});

describe('BookDetailScreen', () => {
  it('shows loading spinner then book info', async () => {
    (getUserBook as jest.Mock).mockResolvedValue(mockReadingBook);
    render(<BookDetailScreen />);
    await waitFor(() => {
      expect(screen.getByText('The Hobbit')).toBeTruthy();
      expect(screen.getByText('J.R.R. Tolkien')).toBeTruthy();
    });
  });

  it('shows book not found when getUserBook returns null', async () => {
    render(<BookDetailScreen />);
    await waitFor(() => {
      expect(screen.getByText('Book not found')).toBeTruthy();
    });
  });

  it('shows Start Reading Session button on reading shelf', async () => {
    (getUserBook as jest.Mock).mockResolvedValue(mockReadingBook);
    render(<BookDetailScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('start-session-btn')).toBeTruthy();
    });
  });

  it('does not show Start Reading Session on read shelf', async () => {
    (getUserBook as jest.Mock).mockResolvedValue(mockReadBook);
    render(<BookDetailScreen />);
    await waitFor(() => {
      expect(screen.getByText('The Hobbit')).toBeTruthy();
    });
    expect(screen.queryByTestId('start-session-btn')).toBeNull();
  });

  it('shows star rating row on read shelf', async () => {
    (getUserBook as jest.Mock).mockResolvedValue(mockReadBook);
    render(<BookDetailScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('rating-row')).toBeTruthy();
    });
  });

  it('tapping a star calls rateBook and updates local state', async () => {
    (getUserBook as jest.Mock).mockResolvedValue({ ...mockReadBook, rating: null });
    render(<BookDetailScreen />);
    await waitFor(() => screen.getByTestId('star-3'));
    fireEvent.press(screen.getByTestId('star-3'));
    await waitFor(() => {
      expect(rateBook).toHaveBeenCalledWith('ub-2', 3);
    });
  });

  it('tapping Move to shelf calls moveShelf and navigates back', async () => {
    jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation(
      (_opts: any, callback: (index: number) => void) => { callback(1); } // 1 = "Reading"
    );
    (getUserBook as jest.Mock).mockResolvedValue(mockReadingBook);
    render(<BookDetailScreen />);
    await waitFor(() => screen.getByTestId('move-shelf-btn'));
    fireEvent.press(screen.getByTestId('move-shelf-btn'));
    await waitFor(() => {
      expect(moveShelf).toHaveBeenCalledWith('ub-1', 'reading');
      expect(mockBack).toHaveBeenCalled();
    });
  });

  it('Start Reading Session navigates to session screen', async () => {
    (getUserBook as jest.Mock).mockResolvedValue(mockReadingBook);
    render(<BookDetailScreen />);
    await waitFor(() => screen.getByTestId('start-session-btn'));
    fireEvent.press(screen.getByTestId('start-session-btn'));
    expect(mockPush).toHaveBeenCalledWith('/session/book-1');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest __tests__/screens/bookDetail.test.tsx --no-coverage
```

Expected: FAIL — module `@/app/book/[bookId]` not found.

- [ ] **Step 3: Create `app/book/[bookId].tsx`**

```typescript
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  ActionSheetIOS,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { getUserBook, moveShelf, rateBook, type UserBookWithBook } from '@/lib/userBooks';
import { Shelf } from '@/types/database';
import { Colors, Spacing, Radius, Shadow } from '@/constants/theme';

const SHELF_OPTIONS = ['Cancel', 'Reading', 'Want to Read', 'Read', 'Did Not Finish'] as const;
const SHELF_KEYS: (Shelf | null)[] = [null, 'reading', 'want', 'read', 'dnf'];

export default function BookDetailScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const { bookId } = useLocalSearchParams<{ bookId: string }>();

  const [userBook, setUserBook] = useState<UserBookWithBook | null>(null);
  const [loading, setLoading] = useState(true);
  const [descExpanded, setDescExpanded] = useState(false);

  const userId = session?.user.id ?? '';

  useFocusEffect(
    useCallback(() => {
      if (!userId || !bookId) return;
      setLoading(true);
      getUserBook(userId, bookId)
        .then((data) => {
          setUserBook(data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }, [userId, bookId])
  );

  if (!session) return null;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (!userBook) {
    return (
      <SafeAreaView style={styles.container}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={Colors.primary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <View style={styles.center}>
          <Text style={styles.notFound}>Book not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { book, shelf } = userBook;

  const handleMoveShelf = () => {
    ActionSheetIOS.showActionSheetWithOptions(
      { options: [...SHELF_OPTIONS], cancelButtonIndex: 0, title: `Move "${book.title}" to...` },
      async (buttonIndex) => {
        const newShelf = SHELF_KEYS[buttonIndex];
        if (newShelf) {
          await moveShelf(userBook.id, newShelf);
          router.back();
        }
      }
    );
  };

  const handleRate = async (rating: number) => {
    setUserBook({ ...userBook, rating });
    await rateBook(userBook.id, rating);
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={24} color={Colors.primary} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Book header */}
        <View style={styles.bookHeader}>
          {book.cover_url ? (
            <Image source={{ uri: book.cover_url }} style={styles.cover} />
          ) : (
            <View style={styles.coverPlaceholder} />
          )}
          <View style={styles.bookMeta}>
            <Text style={styles.bookTitle}>{book.title}</Text>
            <Text style={styles.bookAuthor}>{book.author}</Text>
            {!!book.page_count && (
              <Text style={styles.pageCount}>{book.page_count} pages</Text>
            )}
          </View>
        </View>

        {/* Description */}
        {book.description ? (
          <View>
            <Text
              style={styles.description}
              numberOfLines={descExpanded ? undefined : 4}
            >
              {book.description}
            </Text>
            <TouchableOpacity onPress={() => setDescExpanded(!descExpanded)}>
              <Text style={styles.showMore}>{descExpanded ? 'Show less' : 'Show more'}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Action bar */}
        <View style={styles.actions}>
          {shelf === 'reading' && (
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => router.push(`/session/${userBook.book_id}`)}
              testID="start-session-btn"
            >
              <Ionicons name="play" size={14} color={Colors.surface} />
              <Text style={styles.primaryBtnText}>Start Reading Session</Text>
            </TouchableOpacity>
          )}

          {shelf === 'read' && (
            <View style={styles.ratingRow} testID="rating-row">
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => handleRate(star)}
                  testID={`star-${star}`}
                >
                  <Text style={styles.star}>
                    {(userBook.rating ?? 0) >= star ? '★' : '☆'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={handleMoveShelf}
            testID="move-shelf-btn"
          >
            <Text style={styles.secondaryBtnText}>Move to shelf</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    gap: 4,
  },
  backText: { color: Colors.primary, fontSize: 16, fontWeight: '600' },
  scroll: { padding: Spacing.lg, gap: Spacing.lg },

  bookHeader: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
  cover: { width: 140, height: 200, borderRadius: Radius.md },
  coverPlaceholder: {
    width: 140,
    height: 200,
    borderRadius: Radius.md,
    backgroundColor: Colors.border,
  },
  bookMeta: { flex: 1, gap: 6, paddingTop: 4 },
  bookTitle: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary },
  bookAuthor: { fontSize: 15, color: Colors.textSecondary },
  pageCount: { fontSize: 13, color: Colors.textTertiary },
  notFound: { fontSize: 16, color: Colors.textSecondary },

  description: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  showMore: { color: Colors.primary, fontSize: 13, fontWeight: '600', marginTop: 4 },

  actions: { gap: Spacing.sm },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: Radius.xl,
    paddingVertical: 14,
    gap: 6,
  },
  primaryBtnText: { color: Colors.surface, fontWeight: '700', fontSize: 15 },
  secondaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: Radius.xl,
    paddingVertical: 12,
  },
  secondaryBtnText: { color: Colors.primary, fontWeight: '600', fontSize: 15 },

  ratingRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.sm },
  star: { fontSize: 32, color: Colors.primary },
});
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/screens/bookDetail.test.tsx --no-coverage
```

Expected: all 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/book/[bookId].tsx __tests__/screens/bookDetail.test.tsx
git commit -m "feat: add book detail screen"
```

---

## Task 3: Library Tappable Cards

**Files:**
- Modify: `app/(tabs)/library.tsx`
- Modify: `__tests__/screens/library.test.tsx`

- [ ] **Step 1: Write the failing test**

Open `__tests__/screens/library.test.tsx`. Add `description: null` to the `mockBooks[0].book` fixture (TypeScript will require it now that the type includes it), and add a new test at the end of the `describe` block:

Update `mockBooks`:
```typescript
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
    book: {
      id: 'book-1',
      title: 'The Hobbit',
      author: 'Tolkien',
      cover_url: null,
      page_count: 310,
      description: null,    // ← ADD
    },
  },
];
```

Add the new test inside the `describe('LibraryScreen')` block:

```typescript
it('taps a book card and navigates to book detail', async () => {
  (getShelf as jest.Mock).mockResolvedValue(mockBooks);
  render(<LibraryScreen />);
  await waitFor(() => screen.getByText('The Hobbit'));
  fireEvent.press(screen.getByText('The Hobbit'));
  expect(mockPush).toHaveBeenCalledWith('/book/book-1');
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx jest __tests__/screens/library.test.tsx --no-coverage
```

Expected: new test FAILS — pressing "The Hobbit" does not navigate (BookCard is a plain View).

- [ ] **Step 3: Update `app/(tabs)/library.tsx`**

In `LibraryScreen`, change the `renderItem` prop of the `FlatList` to wrap `BookCard` in a `TouchableOpacity`:

```typescript
import { useRouter } from 'expo-router';
// (already imported)

// Inside LibraryScreen function, add:
const router = useRouter();
// (already in the component)

// Change renderItem from:
renderItem={({ item }) => <BookCard book={item} shelf={activeShelf} />}

// To:
renderItem={({ item }) => (
  <TouchableOpacity onPress={() => router.push(`/book/${item.book_id}`)}>
    <BookCard book={item} shelf={activeShelf} />
  </TouchableOpacity>
)}
```

`BookCard` itself stays as a plain `View` internally — no changes needed there.

- [ ] **Step 4: Run to verify tests pass**

```bash
npx jest __tests__/screens/library.test.tsx --no-coverage
```

Expected: all 7 tests PASS (6 existing + 1 new).

- [ ] **Step 5: Commit**

```bash
git add app/(tabs)/library.tsx __tests__/screens/library.test.tsx
git commit -m "feat: library cards navigate to book detail"
```

---

## Task 4: Home Screen Carousel

**Files:**
- Modify: `app/(tabs)/index.tsx`
- Modify: `__tests__/screens/home.test.tsx`

- [ ] **Step 1: Write the failing tests**

Replace the entire content of `__tests__/screens/home.test.tsx` with:

```typescript
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import HomeScreen from '@/app/(tabs)/index';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(() => { cb(); }, []);
  },
}));

jest.mock('@/lib/auth', () => ({
  useAuth: jest.fn(() => ({
    session: { user: { id: 'user-1' } },
    loading: false,
  })),
}));

const mockBook1 = {
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
    description: null,
  },
};

const mockBook2 = {
  id: 'ub-2',
  user_id: 'user-1',
  book_id: 'book-2',
  shelf: 'reading',
  current_page: 20,
  rating: null,
  review: null,
  added_at: '2026-04-02T00:00:00Z',
  finished_at: null,
  book: {
    id: 'book-2',
    title: 'Dune',
    author: 'Frank Herbert',
    cover_url: null,
    page_count: 412,
    description: null,
  },
};

jest.mock('@/lib/userBooks', () => ({
  getShelf: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/lib/stats', () => ({
  getTodayStats: jest.fn().mockResolvedValue({ pagesRead: 0, timeSeconds: 0, streak: 0 }),
  estimateDaysRemaining: jest.fn().mockReturnValue(null),
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

import { getShelf } from '@/lib/userBooks';
import { getTodayStats } from '@/lib/stats';

beforeEach(() => {
  jest.clearAllMocks();
  (getShelf as jest.Mock).mockResolvedValue([]);
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
    (getShelf as jest.Mock).mockResolvedValue([mockBook1]);
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
      expect(screen.getByText('42')).toBeTruthy();
      expect(screen.getByText('1h 0m')).toBeTruthy();
      expect(screen.getByText('5')).toBeTruthy();
    });
  });

  it('navigates to session screen on book card tap', async () => {
    (getShelf as jest.Mock).mockResolvedValue([mockBook1]);
    render(<HomeScreen />);
    await waitFor(() => screen.getByText('Start Reading Session'));
    fireEvent.press(screen.getByText('Start Reading Session'));
    expect(mockPush).toHaveBeenCalledWith('/session/book-1');
  });

  it('navigates to search when no book and tapping Start a book', async () => {
    render(<HomeScreen />);
    await waitFor(() => screen.getByText('Start a book'));
    fireEvent.press(screen.getByText('Start a book'));
    expect(mockPush).toHaveBeenCalledWith('/search');
  });

  it('renders both book titles when there are multiple reading books', async () => {
    (getShelf as jest.Mock).mockResolvedValue([mockBook1, mockBook2]);
    render(<HomeScreen />);
    await waitFor(() => {
      expect(screen.getByText('The Hobbit')).toBeTruthy();
      expect(screen.getByText('Dune')).toBeTruthy();
    });
  });

  it('renders dot indicators when there are multiple reading books', async () => {
    (getShelf as jest.Mock).mockResolvedValue([mockBook1, mockBook2]);
    render(<HomeScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('carousel-dots')).toBeTruthy();
    });
  });

  it('does not render dot indicators for a single book', async () => {
    (getShelf as jest.Mock).mockResolvedValue([mockBook1]);
    render(<HomeScreen />);
    await waitFor(() => screen.getByText('The Hobbit'));
    expect(screen.queryByTestId('carousel-dots')).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
npx jest __tests__/screens/home.test.tsx --no-coverage
```

Expected: FAIL — `getShelf` is not in the mock (currently mocks `getCurrentBook`), and `carousel-dots` testID doesn't exist.

- [ ] **Step 3: Rewrite `app/(tabs)/index.tsx`**

Replace the full file content:

```typescript
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { getShelf, type UserBookWithBook } from '@/lib/userBooks';
import { getTodayStats, estimateDaysRemaining, type TodayStats } from '@/lib/stats';
import { Colors, Spacing, Radius, Shadow } from '@/constants/theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = SCREEN_WIDTH - 2 * Spacing.lg;

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function HomeScreen() {
  const { session } = useAuth();
  const router = useRouter();

  const [readingBooks, setReadingBooks] = useState<UserBookWithBook[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [stats, setStats] = useState<TodayStats>({ pagesRead: 0, timeSeconds: 0, streak: 0 });
  const [loading, setLoading] = useState(true);

  const userId = session?.user.id ?? '';

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      setLoading(true);
      Promise.all([getShelf(userId, 'reading'), getTodayStats(userId)])
        .then(([books, todayStats]) => {
          setReadingBooks(books);
          setStats(todayStats);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }, [userId])
  );

  if (!session) return null;

  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  const renderBookCard = (book: UserBookWithBook) => {
    const progress = book.book.page_count
      ? Math.min(1, book.current_page / book.book.page_count)
      : 0;
    const pct = Math.round(progress * 100);
    const pacePerDay = book.book.page_count && book.current_page > 0 ? stats.pagesRead : 0;
    const daysLeft = book.book.page_count
      ? estimateDaysRemaining(pacePerDay, book.current_page, book.book.page_count)
      : null;

    return (
      <View key={book.id} style={[styles.bookCard, { width: CARD_WIDTH }]}>
        {book.book.cover_url ? (
          <Image source={{ uri: book.book.cover_url }} style={styles.cover} />
        ) : (
          <View style={styles.coverPlaceholder} />
        )}
        <View style={styles.bookInfo}>
          <Text style={styles.bookTitle} numberOfLines={2}>{book.book.title}</Text>
          <Text style={styles.bookAuthor}>{book.book.author}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${pct}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {book.current_page} / {book.book.page_count ?? '?'} pages · {pct}%
            {daysLeft !== null ? `  ·  ~${daysLeft} days left` : ''}
          </Text>
          <TouchableOpacity
            style={styles.startBtn}
            onPress={() => router.push(`/session/${book.book_id}`)}
          >
            <Ionicons name="play" size={14} color={Colors.primary} />
            <Text style={styles.startBtnText}>Start Reading Session</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderCurrentBookSection = () => {
    if (readingBooks.length === 0) {
      return (
        <TouchableOpacity style={styles.emptyCard} onPress={() => router.push('/search')}>
          <Ionicons name="book-outline" size={40} color={Colors.textTertiary} />
          <Text style={styles.emptyText}>Start a book</Text>
          <Text style={styles.emptySubtext}>Search for something to read</Text>
        </TouchableOpacity>
      );
    }

    if (readingBooks.length === 1) {
      return renderBookCard(readingBooks[0]);
    }

    // 2+ books: carousel
    return (
      <View>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={{ width: CARD_WIDTH }}
          onScroll={(e) => {
            const offsetX = e.nativeEvent.contentOffset.x;
            setActiveIndex(Math.round(offsetX / CARD_WIDTH));
          }}
          scrollEventThrottle={16}
        >
          {readingBooks.map(renderBookCard)}
        </ScrollView>
        <View style={styles.dotsRow} testID="carousel-dots">
          {readingBooks.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === activeIndex ? styles.dotActive : styles.dotInactive]}
            />
          ))}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.date}>{dateStr}</Text>
          </View>
          <TouchableOpacity
            style={styles.profileBtn}
            onPress={() => router.push('/(tabs)/profile')}
          >
            <Ionicons name="person-circle-outline" size={32} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {renderCurrentBookSection()}

        {/* Today's Progress */}
        <Text style={styles.sectionTitle}>Today's Progress</Text>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="book-outline" size={20} color={Colors.primary} />
            <Text style={styles.statValue}>{stats.pagesRead}</Text>
            <Text style={styles.statLabel}>Pages</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="time-outline" size={20} color={Colors.primary} />
            <Text style={styles.statValue}>{formatTime(stats.timeSeconds)}</Text>
            <Text style={styles.statLabel}>Time</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="flame" size={20} color={Colors.orange} />
            <Text style={styles.statValue}>{stats.streak}</Text>
            <Text style={styles.statLabel}>Streak</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: { padding: Spacing.lg, gap: Spacing.lg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  greeting: { fontSize: 28, fontWeight: '700', color: Colors.primary },
  date: { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
  profileBtn: { padding: 4 },

  bookCard: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    flexDirection: 'row',
    gap: Spacing.md,
    ...Shadow.card,
  },
  cover: { width: 80, height: 120, borderRadius: Radius.sm },
  coverPlaceholder: {
    width: 80,
    height: 120,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  bookInfo: { flex: 1, gap: 6 },
  bookTitle: { color: Colors.surface, fontSize: 17, fontWeight: '700' },
  bookAuthor: { color: 'rgba(255,255,255,0.75)', fontSize: 13 },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: { height: 4, backgroundColor: Colors.surface, borderRadius: 2 },
  progressText: { color: 'rgba(255,255,255,0.75)', fontSize: 12 },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    paddingVertical: 10,
    gap: 6,
    marginTop: 4,
  },
  startBtnText: { color: Colors.primary, fontWeight: '700', fontSize: 14 },

  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 32,
    alignItems: 'center',
    gap: Spacing.sm,
    ...Shadow.card,
  },
  emptyText: { color: Colors.textPrimary, fontSize: 18, fontWeight: '600' },
  emptySubtext: { color: Colors.textSecondary, fontSize: 14 },

  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: Spacing.sm,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotActive: { backgroundColor: Colors.primary },
  dotInactive: { borderWidth: 1.5, borderColor: Colors.primary, backgroundColor: 'transparent' },

  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  statsRow: { flexDirection: 'row', gap: Spacing.sm },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 6,
    ...Shadow.card,
  },
  statValue: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary },
  statLabel: { fontSize: 12, color: Colors.textSecondary },
});
```

- [ ] **Step 4: Run to verify all home tests pass**

```bash
npx jest __tests__/screens/home.test.tsx --no-coverage
```

Expected: all 8 tests PASS.

- [ ] **Step 5: Run the full test suite**

```bash
npx jest --no-coverage
```

Expected: all tests PASS across all test files.

- [ ] **Step 6: Commit**

```bash
git add app/(tabs)/index.tsx __tests__/screens/home.test.tsx
git commit -m "feat: home carousel for multiple reading books"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ DB migration (manual SQL noted at Task 1 start)
- ✅ `description` added to `BookSearchResult`, `volumeToBook`, `upsertBook` (Task 1)
- ✅ `BOOK_SELECT` updated, `UserBookWithBook.book` updated (Task 1)
- ✅ Book detail page at `app/book/[bookId].tsx` (Task 2)
- ✅ Back button, cover 140×200, title/author/page count (Task 2)
- ✅ Description with 4-line clamp + Show more/less toggle (Task 2)
- ✅ Action bar: "Start Reading Session" for reading shelf (Task 2)
- ✅ Action bar: star rating for read shelf, optimistic update (Task 2)
- ✅ Action bar: "Move to shelf" for all shelves via ActionSheetIOS (Task 2)
- ✅ Loading spinner and "Book not found" error state (Task 2)
- ✅ Library BookCard wrapped in TouchableOpacity → `/book/${book_id}` (Task 3)
- ✅ BookCard itself remains plain View (Task 3)
- ✅ 0 books → empty state (Task 4)
- ✅ 1 book → flat card, no dots (Task 4)
- ✅ 2+ books → horizontal ScrollView pagingEnabled, dot indicators (Task 4)
- ✅ Each card's button passes that card's `book_id` (Task 4 `renderBookCard`)
- ✅ `getShelf(userId, 'reading')` replaces `getCurrentBook` (Task 4)

**Type consistency:**
- `UserBookWithBook.book.description` added in Task 1; used in Task 2 (`book.description`)
- `getShelf` in Task 4 returns `UserBookWithBook[]` — same type used in Task 2 detail screen
- `moveShelf(userBook.id, newShelf)` — `userBook.id` is `user_book.id` (string), matches function signature
- `rateBook(userBook.id, rating)` — matches `lib/userBooks.ts` signature

**No placeholders found.**
