# Manual Book Add Design

## Goal

Allow users to manually add a book when search returns zero results. The entry point is the search empty state; the form collects enough data to make the book usable for reading sessions.

## Architecture

Three files changed:
- **Create `app/add-book.tsx`** — manual entry form screen
- **Modify `app/search.tsx`** — add empty state with "Add manually" button
- **Modify `lib/books.ts`** — add `createManualBook()` function
- **Modify `lib/userBooks.ts`** — add optional `format` param to `addToShelf`

No database migrations needed. All new fields are already nullable columns on the `books` table. Format is stored on `user_books` (existing column).

---

## Entry Point

`app/search.tsx` shows the "Add manually" button **only when search returns zero results** (empty state). The button reads **"+ Add '[query]' manually"** and navigates to `app/add-book.tsx?title=<encoded query>`.

The button does not appear before the user searches or while results are loading.

---

## Form Screen (`app/add-book.tsx`)

### Fields

| Field | Type | Required | Default |
|---|---|---|---|
| `title` | Text input | Yes | Pre-filled from nav param |
| `author` | Text input | No | Empty |
| `pageCount` | Numeric input | No | Empty |
| `format` | Segmented picker: Physical / eBook / Audiobook | No | Physical |
| `coverUrl` | Text input (URL) | No | Empty |
| `description` | Multiline text input | No | Empty |

### Validation

Only `title` is validated — must be non-empty. Show an inline error message below the field on submit if blank. All other fields silently store as `null` if left empty.

### Submit flow

1. User taps **Add to Library**
2. Validate title — show error and stop if blank
3. Call `createManualBook({ title, author, pageCount, coverUrl, description })` → get `bookId`
4. Show shelf picker bottom sheet (same pattern as `app/search.tsx`)
5. User picks shelf → call `addToShelf(userId, bookId, shelf, format)`
6. Navigate to `app/book/[bookId]`

### Error handling

If `createManualBook` throws, show an inline error below the submit button. Do not navigate away. The shelf picker only appears after successful book creation.

---

## `createManualBook()` — `lib/books.ts`

```typescript
async function createManualBook(params: {
  title: string;
  author?: string;
  pageCount?: number;
  coverUrl?: string;
  description?: string;
}): Promise<string>
```

- Plain `insert` into `books` table (no upsert — manual books have no `hardcover_id` to deduplicate on)
- Sets `hardcover_id: null`
- Returns the new book's `id`

---

## `addToShelf` update — `lib/userBooks.ts`

Adds an optional fourth parameter:

```typescript
addToShelf(
  userId: string,
  bookId: string,
  shelf: Shelf,
  format?: 'physical' | 'ebook' | 'audiobook'
): Promise<string>
```

If `format` is provided, it is stored on the `user_books` row at creation time. Existing call sites pass no `format` and are unaffected.

---

## What Is Not Changing

- No image upload — cover is URL only, consistent with the rest of the app
- No deduplication of manually added books — each submit creates a new row
- No edit flow for manually added books — out of scope
- The shelf picker UI is reused as-is from `app/search.tsx`
