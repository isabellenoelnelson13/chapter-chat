# Book Detail Page + Home Carousel Design Spec

**Date:** 2026-04-10
**Status:** Approved

---

## Overview

Three connected improvements to the reading experience:

1. **Book detail page** — a dedicated screen showing book info with shelf/rating actions, accessible from anywhere a book appears.
2. **Home screen carousel** — swipeable cards when the user has multiple books in progress.
3. **Library tappable cards** — tap any book card to open its detail page.

---

## Architecture

No new libraries. Uses the existing horizontal `ScrollView` with `pagingEnabled` for the carousel, existing `ActionSheetIOS` for shelf picker, `getUserBook` for the detail page data fetch. One Supabase migration to add `description` to the `books` table.

**Tech Stack:** Expo Router, React Native, Supabase, `@expo/vector-icons` (Ionicons), existing `constants/theme.ts` tokens.

---

## Section 1: DB + Data Layer

### Supabase migration

Add `description text` column to the `books` table (nullable, no default):

```sql
ALTER TABLE books ADD COLUMN description text;
```

### `lib/books.ts` changes

- Add `description: string | null` to `BookSearchResult`
- Extract in `volumeToBook`: `description: info.description ?? null`
- Include in `upsertBook` insert/upsert payload: `description: book.description`

### `lib/userBooks.ts` changes

The `BOOK_SELECT` constant selects `book:books(id, title, author, cover_url, page_count)`. Extend to include `description`:

```typescript
const BOOK_SELECT = '*, book:books(id, title, author, cover_url, page_count, description)';
```

Update `UserBookWithBook.book` type to include `description: string | null`.

---

## Section 2: Book Detail Page

**Route:** `app/book/[bookId].tsx`

**Navigation:** Navigated to from Library cards (all shelves). In future phases, also from search results and activity feed. Receives `bookId` (internal Supabase `book_id`).

**Data fetch:** `getUserBook(userId, bookId)` — already exists, returns `UserBookWithBook`.

### Layout

```
[ Back button ]

[ Cover image 140×200 ]   [ Title (bold)        ]
                          [ Author (secondary)  ]
                          [ Page count · genres ]

[ Description (4 lines, "Show more" expands to full) ]

[ Action bar ]
```

### Action bar (shelf-dependent)

- **All shelves:** "Move to shelf" button → `ActionSheetIOS` with options: Cancel / Reading / Want to Read / Read / Did Not Finish. Calls `moveShelf(userBookId, shelf)`. Navigates back on success.
- **Reading shelf only:** "Start Reading Session" primary button → `router.push('/session/[bookId]')`.
- **Read shelf only:** 5-star rating row. Tapping a star calls `rateBook(userBookId, rating)` and updates local state immediately (optimistic).

### Error / loading states

- Loading spinner while `getUserBook` resolves.
- If book not found (null), show "Book not found" with a back button.

---

## Section 3: Home Screen Carousel

**Goal:** When the user has multiple books on the Reading shelf, swipe horizontally between them on the Home screen.

### State change

Replace:
```typescript
const [currentBook, setCurrentBook] = useState<UserBookWithBook | null>(null);
```

With:
```typescript
const [readingBooks, setReadingBooks] = useState<UserBookWithBook[]>([]);
const [activeIndex, setActiveIndex] = useState(0);
```

Data fetch changes from `getCurrentBook(userId)` to `getShelf(userId, 'reading')`.

### Rendering logic

- **0 books:** existing empty state ("Start a book").
- **1 book:** render the single book card as-is (no swipe UI, no dots).
- **2+ books:** horizontal `ScrollView` with `pagingEnabled`, `showsHorizontalScrollIndicator={false}`. Each card is `width: SCREEN_WIDTH - 2 * Spacing.lg` (full card width). Dot indicators below, updated via `onScroll` using `contentOffset.x`.

### Dot indicators

```typescript
const dotIndex = Math.round(offsetX / cardWidth);
```

Dots: filled circle for active, outlined for inactive, using `Colors.primary`.

### "Start Reading Session" button

Each card's button passes that card's `book_id` to `router.push('/session/[bookId]')`. The active card is whichever the user has scrolled to.

---

## Section 4: Library Tappable Cards

Wrap `BookCard` in a `TouchableOpacity` that navigates to `/book/${book.book_id}`.

```typescript
<TouchableOpacity onPress={() => router.push(`/book/${book.book_id}`)}>
  <BookCard book={item} shelf={activeShelf} />
</TouchableOpacity>
```

`BookCard` itself remains a plain `View` internally — the tap target is the wrapper in `renderItem`.

---

## File Map

```
lib/books.ts                    MODIFY — add description to type, volumeToBook, upsertBook
lib/userBooks.ts                MODIFY — add description to BOOK_SELECT and UserBookWithBook type
app/book/[bookId].tsx           CREATE — book detail screen
app/(tabs)/index.tsx            MODIFY — carousel + dots, getShelf instead of getCurrentBook
app/(tabs)/library.tsx          MODIFY — tappable cards
```

---

## Testing

- `__tests__/screens/bookDetail.test.tsx` — loading state, book info rendered, "Start Reading Session" shown on reading shelf, star rating rendered on read shelf, move shelf triggers `moveShelf`
- `__tests__/screens/home.test.tsx` — update existing tests; add test for multiple books rendering carousel, single book rendering flat card
- `__tests__/screens/library.test.tsx` — tap on card navigates to `/book/[bookId]`
- `__tests__/lib/books.test.ts` — `volumeToBook` includes description; `upsertBook` passes description to Supabase

---

## Out of Scope

- "Show more" expand animation (plain state toggle is fine)
- Editing book metadata (title, author, page count)
- Review text field (rating only for now)
- Carousel momentum velocity / custom snap animation
