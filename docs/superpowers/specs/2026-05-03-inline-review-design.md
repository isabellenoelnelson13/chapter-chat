# Inline Book Review Input — Design Spec

**Date:** 2026-05-03
**Status:** Approved

## Summary

Add the ability for users to write a text review for books they've marked as "read". The review input lives inline on the book detail screen, directly below the star rating. This requires no database migration — the `user_books` table already has a `review` text column and `rateBook()` already accepts an optional `review` parameter.

## Data & State

**No migration needed.** The `user_books.review` column and `rateBook(userBookId, rating, review?)` already exist.

New state in `app/book/[bookId].tsx`:
- `reviewEditing: boolean` — controls whether the text input is open
- `reviewInput: string` — draft text while editing; initialized from `userBook.review ?? ''` on load

**Save flow:**
1. User taps "Save"
2. Call `rateBook(userBook.id, userBook.rating ?? 0, reviewInput.trim() || undefined)`
3. Update `userBook.review` in local state
4. Set `reviewEditing` to `false`

## UI

Rendered below the `ratingRow` view, only when `shelf === 'read'`.

**Collapsed (not editing):**
- No review: tappable `"Add a review..."` text, styled with `pageCountPlaceholder` (primary color)
- Review exists: the review text styled with `reviewText` (secondary color, regular font), tappable to edit

**Expanded (editing):**
- Row layout matching `genreInputRow`
- Multiline `TextInput` with placeholder `"Write your thoughts..."`, styled like `genreInput` (bottom border, primary color)
- "Save" button to the right, styled like `genreSave`

All styles are reused from existing constants — no new tokens needed.

## Scope

- Only `app/book/[bookId].tsx` and `lib/userBooks.ts` are touched (and `lib/userBooks.ts` may not need changes at all since `rateBook` already supports reviews).
- No new components, no new screens, no migration.
- The existing "From your friends" reviews section on the book detail page will automatically show the user's own review to their friends once saved (this is already handled by the existing `getBookReviews` query which fetches from `user_books` where `review is not null`).
