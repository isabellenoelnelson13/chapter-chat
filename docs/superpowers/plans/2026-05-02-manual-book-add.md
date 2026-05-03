# Manual Book Add Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users manually add a book when search returns zero results, collecting title/author/page count/format/cover URL/description and placing the book on a chosen shelf.

**Architecture:** Four small changes — add `createManualBook()` to `lib/books.ts`, add an optional `format` param to `addToShelf` in `lib/userBooks.ts`, create the form screen at `app/add-book.tsx`, and extend `app/search.tsx` with an empty-state "Add manually" button.

**Tech Stack:** React Native, Expo Router, Supabase JS client, ActionSheetIOS (shelf picker, iOS-only app)

---

### Task 1: `createManualBook()` in `lib/books.ts`

**Files:**
- Modify: `lib/books.ts`

- [ ] **Step 1: Add `createManualBook` at the bottom of `lib/books.ts`**

```typescript
export async function createManualBook(params: {
  title: string;
  author?: string;
  pageCount?: number;
  coverUrl?: string;
  description?: string;
}): Promise<string> {
  const { data, error } = await supabase
    .from('books')
    .insert({
      hardcover_id: null,
      title: params.title,
      author: params.author ?? null,
      page_count: params.pageCount ?? null,
      cover_url: params.coverUrl ?? null,
      description: params.description ?? null,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}
```

- [ ] **Step 2: Verify TypeScript compiles without errors**

Run: `npx tsc --noEmit`
Expected: No errors in `lib/books.ts`

- [ ] **Step 3: Commit**

```bash
git add lib/books.ts
git commit -m "feat: add createManualBook() to lib/books.ts"
```

---

### Task 2: Optional `format` param on `addToShelf` in `lib/userBooks.ts`

**Files:**
- Modify: `lib/userBooks.ts`

- [ ] **Step 1: Update `addToShelf` signature and body**

Replace the existing `addToShelf` function (lines 36–48) with:

```typescript
export async function addToShelf(userId: string, bookId: string, shelf: Shelf, format?: BookFormat): Promise<string> {
  const now = new Date().toISOString();
  const row: Record<string, unknown> = { user_id: userId, book_id: bookId, shelf, current_page: 0 };
  if (format) row.format = format;
  if (shelf === 'reading') row.started_at = now;
  if (shelf === 'read') { row.started_at = now; row.finished_at = now; }
  const { data, error } = await supabase
    .from('user_books')
    .insert(row)
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}
```

- [ ] **Step 2: Verify existing call sites still compile (they pass no `format`, which is now optional)**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add lib/userBooks.ts
git commit -m "feat: add optional format param to addToShelf"
```

---

### Task 3: Create `app/add-book.tsx`

**Files:**
- Create: `app/add-book.tsx`

- [ ] **Step 1: Create the file**

```typescript
import { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActionSheetIOS,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { createManualBook } from '@/lib/books';
import { addToShelf, BookFormat } from '@/lib/userBooks';
import { Shelf } from '@/types/database';
import { useTheme } from '@/lib/theme';
import { Fonts, Spacing, Radius, Shadow } from '@/constants/theme';

const SHELF_OPTIONS = ['Cancel', 'Reading', 'Want to Read', 'Read', 'Did Not Finish'] as const;
const SHELF_KEYS: (Shelf | null)[] = [null, 'reading', 'want', 'read', 'dnf'];
const FORMAT_OPTIONS: BookFormat[] = ['physical', 'ebook', 'audiobook'];
const FORMAT_LABELS: Record<BookFormat, string> = {
  physical: 'Physical',
  ebook: 'eBook',
  audiobook: 'Audiobook',
};

export default function AddBookScreen() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const router = useRouter();
  const { title: initialTitle } = useLocalSearchParams<{ title?: string }>();

  const [title, setTitle] = useState(initialTitle ?? '');
  const [author, setAuthor] = useState('');
  const [pageCount, setPageCount] = useState('');
  const [format, setFormat] = useState<BookFormat>('physical');
  const [coverUrl, setCoverUrl] = useState('');
  const [description, setDescription] = useState('');
  const [titleError, setTitleError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const styles = useMemo(() => StyleSheet.create({
    outer: { flex: 1, backgroundColor: colors.background },
    container: { flex: 1, padding: Spacing.lg },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: Spacing.lg },
    backText: { color: colors.textSecondary, fontSize: 15, fontFamily: Fonts.regular },
    screenTitle: {
      color: colors.textPrimary,
      fontSize: 22,
      fontFamily: Fonts.bold,
      marginBottom: Spacing.lg,
    },
    label: {
      color: colors.textSecondary,
      fontSize: 13,
      fontFamily: Fonts.semiBold,
      marginBottom: 6,
    },
    input: {
      backgroundColor: colors.surface,
      color: colors.textPrimary,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: Spacing.md,
      paddingVertical: 14,
      fontSize: 15,
      fontFamily: Fonts.regular,
      marginBottom: Spacing.md,
      ...Shadow.card,
    },
    inputError: {
      borderColor: colors.error,
    },
    multilineInput: {
      height: 90,
      textAlignVertical: 'top',
    },
    errorText: {
      color: colors.error,
      fontSize: 13,
      fontFamily: Fonts.regular,
      marginTop: -Spacing.sm,
      marginBottom: Spacing.md,
    },
    formatRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginBottom: Spacing.md,
    },
    formatBtn: {
      flex: 1,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 10,
      alignItems: 'center',
      backgroundColor: colors.surface,
    },
    formatBtnActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '18',
    },
    formatBtnText: {
      fontSize: 13,
      fontFamily: Fonts.semiBold,
      color: colors.textSecondary,
    },
    formatBtnTextActive: {
      color: colors.primary,
    },
    submitBtn: {
      backgroundColor: colors.primary,
      borderRadius: Radius.md,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: Spacing.sm,
    },
    submitBtnText: { color: colors.surface, fontSize: 16, fontFamily: Fonts.bold },
    submitError: {
      color: colors.error,
      fontSize: 13,
      fontFamily: Fonts.regular,
      textAlign: 'center',
      marginTop: Spacing.sm,
    },
  }), [colors]);

  if (!session) return null;
  const userId = session.user.id;

  const handleSubmit = async () => {
    setTitleError('');
    setSubmitError('');
    if (!title.trim()) {
      setTitleError('Title is required');
      return;
    }

    let bookId: string;
    setSubmitting(true);
    try {
      bookId = await createManualBook({
        title: title.trim(),
        author: author.trim() || undefined,
        pageCount: pageCount ? parseInt(pageCount, 10) : undefined,
        coverUrl: coverUrl.trim() || undefined,
        description: description.trim() || undefined,
      });
    } catch {
      setSubmitError('Could not create book. Please try again.');
      setSubmitting(false);
      return;
    }
    setSubmitting(false);

    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [...SHELF_OPTIONS],
        cancelButtonIndex: 0,
        title: `Add "${title.trim()}" to...`,
      },
      async (buttonIndex) => {
        const shelf = SHELF_KEYS[buttonIndex];
        if (!shelf) return;
        try {
          await addToShelf(userId, bookId, shelf, format);
          router.replace(`/book/${bookId}`);
        } catch {
          Alert.alert('Error', 'Could not add book to shelf. Please try again.');
        }
      }
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <SafeAreaView style={styles.outer}>
        <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={colors.textSecondary} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>

          <Text style={styles.screenTitle}>Add book manually</Text>

          <Text style={styles.label}>Title *</Text>
          <TextInput
            style={[styles.input, titleError ? styles.inputError : null]}
            placeholder="Book title"
            placeholderTextColor={colors.textTertiary}
            value={title}
            onChangeText={(t) => { setTitle(t); if (titleError) setTitleError(''); }}
            returnKeyType="next"
          />
          {titleError ? <Text style={styles.errorText}>{titleError}</Text> : null}

          <Text style={styles.label}>Author</Text>
          <TextInput
            style={styles.input}
            placeholder="Author name"
            placeholderTextColor={colors.textTertiary}
            value={author}
            onChangeText={setAuthor}
            returnKeyType="next"
          />

          <Text style={styles.label}>Page count</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 320"
            placeholderTextColor={colors.textTertiary}
            value={pageCount}
            onChangeText={setPageCount}
            keyboardType="number-pad"
            returnKeyType="next"
          />

          <Text style={styles.label}>Format</Text>
          <View style={styles.formatRow}>
            {FORMAT_OPTIONS.map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.formatBtn, format === f && styles.formatBtnActive]}
                onPress={() => setFormat(f)}
              >
                <Text style={[styles.formatBtnText, format === f && styles.formatBtnTextActive]}>
                  {FORMAT_LABELS[f]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Cover image URL</Text>
          <TextInput
            style={styles.input}
            placeholder="https://..."
            placeholderTextColor={colors.textTertiary}
            value={coverUrl}
            onChangeText={setCoverUrl}
            keyboardType="url"
            autoCapitalize="none"
            returnKeyType="next"
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            placeholder="Optional description"
            placeholderTextColor={colors.textTertiary}
            value={description}
            onChangeText={setDescription}
            multiline
            returnKeyType="done"
          />

          <TouchableOpacity
            style={styles.submitBtn}
            onPress={handleSubmit}
            disabled={submitting}
          >
            <Text style={styles.submitBtnText}>
              {submitting ? 'Adding...' : 'Add to Library'}
            </Text>
          </TouchableOpacity>
          {submitError ? <Text style={styles.submitError}>{submitError}</Text> : null}
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors in `app/add-book.tsx`.

- [ ] **Step 3: Commit**

```bash
git add app/add-book.tsx
git commit -m "feat: add manual book entry form screen"
```

---

### Task 4: Empty state in `app/search.tsx`

**Files:**
- Modify: `app/search.tsx`

- [ ] **Step 1: Add `hasSearched` state and track when search completes**

In `SearchScreen`, add a new state variable after the existing state declarations:

```typescript
const [hasSearched, setHasSearched] = useState(false);
```

In `onChangeText`, inside the `try/finally` block, set `hasSearched` after results arrive. Replace the existing `try` block inside the debounce timeout:

```typescript
debounceRef.current = setTimeout(async () => {
  setSearching(true);
  try {
    const items = await searchBooks(text.trim());
    setResults(items);
    setHasSearched(true);
  } finally {
    setSearching(false);
  }
}, 400);
```

Also reset `hasSearched` when the query is cleared. In the `if (!text.trim())` branch:

```typescript
if (!text.trim()) {
  setResults([]);
  setHasSearched(false);
  return;
}
```

- [ ] **Step 2: Add empty-state styles**

Inside the `useMemo(() => StyleSheet.create({...}), [colors])` block, add these entries before the closing `})`:

```typescript
emptyState: {
  alignItems: 'center',
  paddingHorizontal: Spacing.lg,
  paddingTop: Spacing.xl,
  gap: Spacing.md,
},
emptyText: {
  color: colors.textTertiary,
  fontSize: 15,
  fontFamily: Fonts.regular,
  textAlign: 'center',
},
addManuallyBtn: {
  backgroundColor: colors.primary,
  borderRadius: Radius.md,
  paddingVertical: 14,
  paddingHorizontal: Spacing.lg,
  alignItems: 'center',
  width: '100%',
},
addManuallyText: {
  color: colors.surface,
  fontSize: 15,
  fontFamily: Fonts.semiBold,
},
```

- [ ] **Step 3: Render empty state below the FlatList**

After the closing `/>` of `<FlatList ... />` and before `</SafeAreaView>`, add:

```tsx
{!searching && hasSearched && query.trim() !== '' && results.length === 0 && (
  <View style={styles.emptyState}>
    <Text style={styles.emptyText}>No results found</Text>
    <TouchableOpacity
      style={styles.addManuallyBtn}
      onPress={() => router.push(`/add-book?title=${encodeURIComponent(query.trim())}`)}
    >
      <Text style={styles.addManuallyText}>+ Add "{query.trim()}" manually</Text>
    </TouchableOpacity>
  </View>
)}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add app/search.tsx
git commit -m "feat: show Add manually button in search empty state"
```
