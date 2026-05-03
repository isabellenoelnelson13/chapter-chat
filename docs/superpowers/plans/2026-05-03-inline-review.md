# Inline Book Review Input Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a tap-to-edit inline text review input below the star rating on the book detail screen.

**Architecture:** All changes are confined to `app/book/[bookId].tsx` (state + UI) and its test file. No migration or new lib functions needed — `rateBook(id, rating, review?)` already accepts a review string.

**Tech Stack:** React Native, Expo Router, `@testing-library/react-native`, `jest-expo`

---

## File Map

| File | Change |
|------|--------|
| `app/book/[bookId].tsx` | Add `reviewEditing` + `reviewInput` state; update `handleRate` to preserve review; add review UI below `ratingRow` |
| `__tests__/screens/bookDetail.test.tsx` | Add 4 new review tests; update existing star-tap test signature |

---

### Task 1: Write failing tests for review feature

**Files:**
- Modify: `__tests__/screens/bookDetail.test.tsx`

- [ ] **Step 1: Add a `mockReadBookWithReview` fixture** after the existing `mockReadBook` constant (around line 89)

```tsx
const mockReadBookWithReview = {
  ...mockReadBook,
  review: 'A wonderful adventure.',
};
```

- [ ] **Step 2: Add the four new failing tests** at the end of the `describe('BookDetailScreen')` block (after the "shows star rating row" test, around line 161):

```tsx
it('shows review placeholder when book is read and has no review', async () => {
  (getBookById as jest.Mock).mockResolvedValue(mockBook);
  (getUserBook as jest.Mock).mockResolvedValue({ ...mockReadBook, review: null });
  render(<BookDetailScreen />);
  await waitFor(() => {
    expect(screen.getByTestId('review-placeholder')).toBeTruthy();
  });
});

it('shows existing review text when book has a review', async () => {
  (getBookById as jest.Mock).mockResolvedValue(mockBook);
  (getUserBook as jest.Mock).mockResolvedValue(mockReadBookWithReview);
  render(<BookDetailScreen />);
  await waitFor(() => {
    expect(screen.getByTestId('review-text')).toBeTruthy();
    expect(screen.getByText('A wonderful adventure.')).toBeTruthy();
  });
});

it('tapping review placeholder opens text input', async () => {
  (getBookById as jest.Mock).mockResolvedValue(mockBook);
  (getUserBook as jest.Mock).mockResolvedValue({ ...mockReadBook, review: null });
  render(<BookDetailScreen />);
  await waitFor(() => screen.getByTestId('review-placeholder'));
  fireEvent.press(screen.getByTestId('review-placeholder'));
  await waitFor(() => {
    expect(screen.getByTestId('review-input')).toBeTruthy();
  });
});

it('tapping Save calls rateBook with review text and collapses input', async () => {
  (getBookById as jest.Mock).mockResolvedValue(mockBook);
  (getUserBook as jest.Mock).mockResolvedValue({ ...mockReadBook, review: null });
  render(<BookDetailScreen />);
  await waitFor(() => screen.getByTestId('review-placeholder'));
  fireEvent.press(screen.getByTestId('review-placeholder'));
  await waitFor(() => screen.getByTestId('review-input'));
  fireEvent.changeText(screen.getByTestId('review-input'), 'Loved it!');
  fireEvent.press(screen.getByTestId('review-save'));
  await waitFor(() => {
    expect(rateBook).toHaveBeenCalledWith('ub-2', 4, 'Loved it!');
    expect(screen.queryByTestId('review-input')).toBeNull();
    expect(screen.getByText('Loved it!')).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run the new tests to confirm they fail**

```bash
npx jest __tests__/screens/bookDetail.test.tsx --testNamePattern="review" --no-coverage
```

Expected: 4 failures — elements with testIDs `review-placeholder`, `review-text`, `review-input`, `review-save` don't exist yet.

---

### Task 2: Implement review state and UI in book detail screen

**Files:**
- Modify: `app/book/[bookId].tsx`

- [ ] **Step 1: Add two new state variables** after the existing `shareConfirmed` state (around line 45):

```tsx
const [reviewEditing, setReviewEditing] = useState(false);
const [reviewInput, setReviewInput] = useState('');
```

- [ ] **Step 2: Initialize `reviewInput` from loaded data** — in the `useFocusEffect` callback, after `setUserBook(userBookData)` (around line 67), add:

```tsx
setReviewInput(userBookData?.review ?? '');
```

- [ ] **Step 3: Update `handleRate` to preserve the saved review** (around line 419). Replace:

```tsx
const handleRate = async (rating: number) => {
  setUserBook({ ...userBook!, rating });
  await rateBook(userBook!.id, rating);
};
```

With:

```tsx
const handleRate = async (rating: number) => {
  setUserBook({ ...userBook!, rating });
  await rateBook(userBook!.id, rating, userBook!.review ?? undefined);
};
```

- [ ] **Step 4: Add a `handleSaveReview` handler** after `handleRate`:

```tsx
const handleSaveReview = async () => {
  const text = reviewInput.trim() || undefined;
  await rateBook(userBook!.id, userBook!.rating ?? 0, text);
  setUserBook({ ...userBook!, review: text ?? null });
  setReviewEditing(false);
};
```

- [ ] **Step 5: Add the review UI** directly after the closing `</View>` of the `ratingRow` (the `{shelf === 'read' && ...}` block, around line 670). Insert this block inside the same outer `{shelf === 'read' && (...)}` condition — add it as a sibling, not nested. Place it right after the `ratingRow` View:

```tsx
{shelf === 'read' && (
  reviewEditing ? (
    <View style={styles.genreInputRow}>
      <TextInput
        style={[styles.genreInput, { minHeight: 60 }]}
        value={reviewInput}
        onChangeText={setReviewInput}
        placeholder="Write your thoughts..."
        placeholderTextColor={colors.textTertiary}
        multiline
        autoFocus
        testID="review-input"
      />
      <TouchableOpacity onPress={handleSaveReview}>
        <Text style={styles.genreSave} testID="review-save">Save</Text>
      </TouchableOpacity>
    </View>
  ) : (
    <TouchableOpacity
      onPress={() => setReviewEditing(true)}
      testID={userBook?.review ? 'review-text' : 'review-placeholder'}
    >
      <Text style={userBook?.review ? styles.reviewText : styles.pageCountPlaceholder}>
        {userBook?.review ?? 'Add a review...'}
      </Text>
    </TouchableOpacity>
  )
)}
```

- [ ] **Step 6: Run the new tests to confirm they pass**

```bash
npx jest __tests__/screens/bookDetail.test.tsx --testNamePattern="review" --no-coverage
```

Expected: 4 passing.

---

### Task 3: Fix the existing star-tap test and run full suite

**Files:**
- Modify: `__tests__/screens/bookDetail.test.tsx`

- [ ] **Step 1: Update the existing `rateBook` call expectation** — the `handleRate` change now passes the current `review` as the third argument. `mockReadBook.review` is `null`, so `rateBook` will be called with `undefined` as the third arg. Find this test (around line 163):

```tsx
it('tapping a star calls rateBook', async () => {
  ...
  expect(rateBook).toHaveBeenCalledWith('ub-2', 3);
});
```

Change the assertion to:

```tsx
expect(rateBook).toHaveBeenCalledWith('ub-2', 3, undefined);
```

- [ ] **Step 2: Run the full book detail test suite**

```bash
npx jest __tests__/screens/bookDetail.test.tsx --no-coverage
```

Expected: all tests pass.

- [ ] **Step 3: Run the full test suite to confirm nothing else broke**

```bash
npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add app/book/\[bookId\].tsx __tests__/screens/bookDetail.test.tsx
git commit -m "feat: add inline review text input on book detail screen"
```
