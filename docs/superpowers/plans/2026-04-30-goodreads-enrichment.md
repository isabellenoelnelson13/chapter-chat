# GoodReads Enrichment & Author Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the GoodReads seeding pipeline to populate authors, reviews, and better genres; add an author detail screen; and surface friend + seeded reviews on the book detail screen.

**Architecture:** Loose FK from `books.goodreads_author_id → authors.goodreads_author_id`; seeded reviews live in a separate `book_reviews` table distinct from user-written reviews in `user_books`; the book detail screen queries both sources in parallel.

**Tech Stack:** Expo Router, Supabase JS v2, Node.js ESM scripts (.mjs), TypeScript, React Native

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `supabase/migrations/012_authors_and_reviews.sql` | Create | DB schema for authors + book_reviews + books.goodreads_author_id |
| `types/database.ts` | Modify | Add authors, book_reviews tables; add goodreads_author_id to books |
| `lib/authors.ts` | Create | getAuthor, getAuthorBooks |
| `lib/books.ts` | Modify | Rename getBookReviews→getHardcoverReviews; add new getBookReviews(bookId,userId); add FriendReview/SeededReview types |
| `app/_layout.tsx` | Modify | Register `author/[authorId]` route |
| `app/author/[authorId].tsx` | Create | Author detail screen |
| `app/book/[bookId].tsx` | Modify | Author name → tappable link; replace reviews section |
| `scripts/import-goodreads-authors.mjs` | Create | Seed authors table from authors.json |
| `scripts/import-goodreads.mjs` | Modify | Pre-load author map; resolve id-only authors; set goodreads_author_id |
| `scripts/import-goodreads-reviews.mjs` | Create | Seed book_reviews + update books.rating/users_read_count |
| `scripts/import-goodreads-tags.mjs` | Create | Improve books.genres from book_tags.json + tags.json |

---

## Task 1: Migration — authors, book_reviews, books.goodreads_author_id

**Files:**
- Create: `supabase/migrations/012_authors_and_reviews.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/012_authors_and_reviews.sql

-- ============================================================
-- AUTHORS
-- ============================================================
CREATE TABLE public.authors (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goodreads_author_id  text UNIQUE NOT NULL,
  name                 text NOT NULL,
  bio                  text,
  photo_url            text,
  born_date            text,
  website              text,
  created_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.authors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authors are viewable by all authenticated users"
  ON public.authors FOR SELECT
  USING (auth.role() = 'authenticated');

-- ============================================================
-- BOOKS — add loose FK to authors
-- ============================================================
ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS goodreads_author_id text
  REFERENCES public.authors(goodreads_author_id);

-- ============================================================
-- BOOK_REVIEWS (seeded from GoodReads — not user reviews)
-- ============================================================
CREATE TABLE public.book_reviews (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id              uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  goodreads_review_id  text UNIQUE,
  reviewer_name        text,
  rating               numeric(2,1),
  body                 text,
  date_added           date,
  helpful_votes        int DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.book_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Book reviews are viewable by all authenticated users"
  ON public.book_reviews FOR SELECT
  USING (auth.role() = 'authenticated');
```

- [ ] **Step 2: Apply the migration**

```bash
# If using Supabase CLI:
supabase db push

# Or paste the SQL directly into the Supabase dashboard SQL editor.
```

Expected: three DDL statements complete without error. Verify in dashboard: `authors` table exists, `books` has `goodreads_author_id` column, `book_reviews` table exists.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/012_authors_and_reviews.sql
git commit -m "feat: add authors and book_reviews tables, add goodreads_author_id to books"
```

---

## Task 2: TypeScript types — authors, book_reviews, books.goodreads_author_id

**Files:**
- Modify: `types/database.ts`

- [ ] **Step 1: Add `goodreads_author_id` to the books Row/Insert/Update types**

In `types/database.ts`, find the `books` table definition and add the new column to all three shapes:

```typescript
// In books.Row, after series_position:
goodreads_author_id: string | null;

// In books.Insert, after series_position?:
goodreads_author_id?: string | null;

// In books.Update, after series_position?:
goodreads_author_id?: string | null;
```

- [ ] **Step 2: Add the `authors` table definition**

Add this block inside the `Tables` object (e.g. after the `books` block):

```typescript
authors: {
  Row: {
    id: string;
    goodreads_author_id: string;
    name: string;
    bio: string | null;
    photo_url: string | null;
    born_date: string | null;
    website: string | null;
    created_at: string;
  };
  Insert: {
    id?: string;
    goodreads_author_id: string;
    name: string;
    bio?: string | null;
    photo_url?: string | null;
    born_date?: string | null;
    website?: string | null;
    created_at?: string;
  };
  Update: {
    name?: string;
    bio?: string | null;
    photo_url?: string | null;
    born_date?: string | null;
    website?: string | null;
  };
};
```

- [ ] **Step 3: Add the `book_reviews` table definition**

Add this block inside the `Tables` object (e.g. after the `authors` block):

```typescript
book_reviews: {
  Row: {
    id: string;
    book_id: string;
    goodreads_review_id: string | null;
    reviewer_name: string | null;
    rating: number | null;
    body: string | null;
    date_added: string | null;
    helpful_votes: number;
    created_at: string;
  };
  Insert: {
    id?: string;
    book_id: string;
    goodreads_review_id?: string | null;
    reviewer_name?: string | null;
    rating?: number | null;
    body?: string | null;
    date_added?: string | null;
    helpful_votes?: number;
    created_at?: string;
  };
  Update: {
    reviewer_name?: string | null;
    rating?: number | null;
    body?: string | null;
    date_added?: string | null;
    helpful_votes?: number;
  };
};
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no new type errors.

- [ ] **Step 5: Commit**

```bash
git add types/database.ts
git commit -m "feat: add authors, book_reviews, and goodreads_author_id to database types"
```

---

## Task 3: lib/authors.ts — getAuthor, getAuthorBooks

**Files:**
- Create: `lib/authors.ts`

- [ ] **Step 1: Create lib/authors.ts**

```typescript
import { supabase } from './supabase';
import { Database } from '@/types/database';

export type Author = Database['public']['Tables']['authors']['Row'];
export type AuthorBook = Database['public']['Tables']['books']['Row'];

export async function getAuthor(goodreadsAuthorId: string): Promise<Author | null> {
  const { data, error } = await supabase
    .from('authors')
    .select('*')
    .eq('goodreads_author_id', goodreadsAuthorId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getAuthorBooks(goodreadsAuthorId: string): Promise<AuthorBook[]> {
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .eq('goodreads_author_id', goodreadsAuthorId)
    .order('users_read_count', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/authors.ts
git commit -m "feat: add lib/authors with getAuthor and getAuthorBooks"
```

---

## Task 4: lib/books.ts — rename old getBookReviews, add new getBookReviews, add types

**Files:**
- Modify: `lib/books.ts`

The existing `getBookReviews` fetches from the Hardcover API. We rename it and add a new function that queries friend reviews + seeded reviews from Supabase.

- [ ] **Step 1: Rename `getBookReviews` → `getHardcoverReviews` and update its export**

Find in `lib/books.ts`:
```typescript
export async function getBookReviews(
  hardcoverId: string,
  limit = 10
): Promise<HardcoverReview[]> {
```

Replace with:
```typescript
export async function getHardcoverReviews(
  hardcoverId: string,
  limit = 10
): Promise<HardcoverReview[]> {
```

- [ ] **Step 2: Add `FriendReview` and `SeededReview` types** (place near `HardcoverReview`)

```typescript
export interface FriendReview {
  userId: string;
  username: string;
  avatarUrl: string | null;
  rating: number | null;
  review: string;
  finishedAt: string | null;
}

export interface SeededReview {
  id: string;
  reviewerName: string | null;
  rating: number | null;
  body: string;
  dateAdded: string | null;
  helpfulVotes: number;
}
```

- [ ] **Step 3: Add the new `getBookReviews` function** (append to end of file)

```typescript
export async function getBookReviews(
  bookId: string,
  userId: string
): Promise<{ friendReviews: FriendReview[]; topReviews: SeededReview[] }> {
  // 1. Fetch IDs the current user follows
  const { data: followData } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId);

  const followingIds = (followData ?? []).map((f) => f.following_id);

  // 2. Fetch friend reviews and seeded reviews in parallel
  const [friendRes, seededRes] = await Promise.all([
    followingIds.length > 0
      ? supabase
          .from('user_books')
          .select('user_id, rating, review, finished_at, profiles(username, avatar_url)')
          .eq('book_id', bookId)
          .not('review', 'is', null)
          .in('user_id', followingIds)
      : Promise.resolve({ data: [] as any[], error: null }),
    supabase
      .from('book_reviews')
      .select('*')
      .eq('book_id', bookId)
      .order('helpful_votes', { ascending: false })
      .limit(10),
  ]);

  if (friendRes.error) throw friendRes.error;
  if (seededRes.error) throw seededRes.error;

  const friendReviews: FriendReview[] = (friendRes.data ?? []).map((row: any) => ({
    userId: row.user_id,
    username: (row.profiles as any)?.username ?? 'Unknown',
    avatarUrl: (row.profiles as any)?.avatar_url ?? null,
    rating: row.rating,
    review: row.review as string,
    finishedAt: row.finished_at,
  }));

  const topReviews: SeededReview[] = (seededRes.data ?? []).map((row) => ({
    id: row.id,
    reviewerName: row.reviewer_name,
    rating: row.rating != null ? Number(row.rating) : null,
    body: row.body ?? '',
    dateAdded: row.date_added,
    helpfulVotes: row.helpful_votes,
  }));

  return { friendReviews, topReviews };
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/books.ts
git commit -m "feat: add getBookReviews(bookId, userId) for friend and seeded reviews"
```

---

## Task 5: Register the author route

**Files:**
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Add the author screen to the Stack**

Find the block of `<Stack.Screen>` declarations in `app/_layout.tsx`. Add the author route alongside the others:

```tsx
<Stack.Screen name="author/[authorId]" />
```

Place it near the similar `series/[seriesId]` entry.

- [ ] **Step 2: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat: register author/[authorId] route"
```

---

## Task 6: app/author/[authorId].tsx — author detail screen

**Files:**
- Create: `app/author/[authorId].tsx`

- [ ] **Step 1: Create the screen**

```tsx
import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getAuthor, getAuthorBooks, type Author, type AuthorBook } from '@/lib/authors';
import { useTheme } from '@/lib/theme';
import { Fonts, Spacing, Radius, Shadow } from '@/constants/theme';

export default function AuthorScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { authorId } = useLocalSearchParams<{ authorId: string }>();

  const [author, setAuthor] = useState<Author | null>(null);
  const [books, setBooks] = useState<AuthorBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [bioExpanded, setBioExpanded] = useState(false);

  useEffect(() => {
    if (!authorId) return;
    Promise.all([getAuthor(authorId), getAuthorBooks(authorId)])
      .then(([authorData, booksData]) => {
        setAuthor(authorData);
        setBooks(booksData);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authorId]);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    backBtn: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, gap: 4,
    },
    backText: { color: colors.primary, fontSize: 16, fontFamily: Fonts.semiBold },
    header: {
      alignItems: 'center', paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md, paddingBottom: Spacing.lg, gap: Spacing.sm,
    },
    photo: { width: 100, height: 100, borderRadius: 50 },
    photoPlaceholder: {
      width: 100, height: 100, borderRadius: 50,
      backgroundColor: colors.border,
      alignItems: 'center', justifyContent: 'center',
    },
    name: {
      fontSize: 22, fontFamily: Fonts.bold,
      color: colors.textPrimary, textAlign: 'center',
    },
    born: { fontSize: 13, fontFamily: Fonts.regular, color: colors.textTertiary },
    website: { fontSize: 13, fontFamily: Fonts.semiBold, color: colors.primary },
    bio: {
      fontSize: 14, fontFamily: Fonts.bookBody,
      color: colors.textSecondary, lineHeight: 20, textAlign: 'center',
    },
    showMore: { color: colors.primary, fontSize: 13, fontFamily: Fonts.semiBold, marginTop: 2 },
    divider: { height: 1, backgroundColor: colors.border, marginHorizontal: Spacing.lg },
    sectionTitle: {
      fontSize: 17, fontFamily: Fonts.bold, color: colors.textPrimary,
      paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.sm,
    },
    list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl, gap: Spacing.sm },
    card: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: colors.surface, borderRadius: Radius.lg,
      padding: Spacing.md, gap: Spacing.md, ...Shadow.card,
    },
    cover: { width: 56, height: 84, borderRadius: Radius.sm },
    coverPlaceholder: {
      width: 56, height: 84, borderRadius: Radius.sm, backgroundColor: colors.border,
    },
    info: { flex: 1, gap: 3 },
    bookTitle: { fontSize: 15, fontFamily: Fonts.bookTitle, color: colors.textPrimary },
    bookRating: { fontSize: 12, fontFamily: Fonts.regular, color: colors.textTertiary },
    notFound: { fontSize: 16, fontFamily: Fonts.regular, color: colors.textSecondary },
  }), [colors]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!author) {
    return (
      <SafeAreaView style={styles.container}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <View style={styles.center}>
          <Text style={styles.notFound}>Author not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={24} color={colors.primary} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      <FlatList
        data={books}
        keyExtractor={(b) => b.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              {author.photo_url ? (
                <Image source={{ uri: author.photo_url }} style={styles.photo} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Ionicons name="person" size={40} color={colors.textTertiary} />
                </View>
              )}
              <Text style={styles.name}>{author.name}</Text>
              {author.born_date ? (
                <Text style={styles.born}>b. {author.born_date}</Text>
              ) : null}
              {author.website ? (
                <TouchableOpacity onPress={() => Linking.openURL(author.website!)}>
                  <Text style={styles.website}>{author.website}</Text>
                </TouchableOpacity>
              ) : null}
              {author.bio ? (
                <>
                  <Text style={styles.bio} numberOfLines={bioExpanded ? undefined : 3}>
                    {author.bio}
                  </Text>
                  <TouchableOpacity onPress={() => setBioExpanded(!bioExpanded)}>
                    <Text style={styles.showMore}>{bioExpanded ? 'Show less' : 'Read more'}</Text>
                  </TouchableOpacity>
                </>
              ) : null}
            </View>
            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>Books</Text>
          </>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/book/${item.id}`)}
            activeOpacity={0.75}
          >
            {item.cover_url ? (
              <Image source={{ uri: item.cover_url }} style={styles.cover} />
            ) : (
              <View style={styles.coverPlaceholder} />
            )}
            <View style={styles.info}>
              <Text style={styles.bookTitle} numberOfLines={2}>{item.title}</Text>
              {item.rating != null && (
                <Text style={styles.bookRating}>★ {Number(item.rating).toFixed(1)}</Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.notFound}>No books found</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/author/[authorId].tsx
git commit -m "feat: add author detail screen with bio and books list"
```

---

## Task 7: app/book/[bookId].tsx — author link + new reviews section

**Files:**
- Modify: `app/book/[bookId].tsx`

The existing screen imports `getBookReviews` (now renamed `getHardcoverReviews`) and renders `HardcoverReview[]`. We update imports, replace review state, and update the author name and reviews JSX.

- [ ] **Step 1: Update the imports at the top of the file**

Find the existing lib/books import line:
```tsx
import { getBookById, getBookReviews, updatePageCount, updateCoverUrl, updateBookGenres, searchGoogleImages, refreshBookGenres, refreshBookSeries, type BookDetails, type HardcoverReview } from '@/lib/books';
```

Replace with:
```tsx
import { getBookById, getBookReviews, updatePageCount, updateCoverUrl, updateBookGenres, searchGoogleImages, refreshBookGenres, refreshBookSeries, type BookDetails, type FriendReview, type SeededReview } from '@/lib/books';
```

- [ ] **Step 2: Replace the reviews state declarations**

Find:
```tsx
const [reviews, setReviews] = useState<HardcoverReview[]>([]);
```

Replace with:
```tsx
const [friendReviews, setFriendReviews] = useState<FriendReview[]>([]);
const [topReviews, setTopReviews] = useState<SeededReview[]>([]);
```

- [ ] **Step 3: Replace the reviews useEffect**

Find:
```tsx
// Fetch reviews once we know the hardcover_id
useEffect(() => {
  if (!book?.hardcover_id) return;
  getBookReviews(book.hardcover_id).then(setReviews).catch(() => {});
}, [book?.hardcover_id]);
```

Replace with:
```tsx
// Fetch friend reviews and seeded reviews
useEffect(() => {
  if (!bookId || !userId) return;
  getBookReviews(bookId, userId)
    .then(({ friendReviews, topReviews }) => {
      setFriendReviews(friendReviews);
      setTopReviews(topReviews);
    })
    .catch(() => {});
}, [bookId, userId]);
```

- [ ] **Step 4: Make the author name a tappable link**

Find:
```tsx
<Text style={styles.bookAuthor}>{book.author}</Text>
```

Replace with:
```tsx
{book.goodreads_author_id ? (
  <TouchableOpacity
    onPress={() => router.push(`/author/${book.goodreads_author_id}`)}
    testID="author-link"
  >
    <Text style={[styles.bookAuthor, { color: colors.primary }]}>{book.author}</Text>
  </TouchableOpacity>
) : (
  <Text style={styles.bookAuthor}>{book.author}</Text>
)}
```

- [ ] **Step 5: Replace the reviews JSX section**

Find the entire reviews block:
```tsx
{/* Reviews */}
{reviews.length > 0 && (
  <View>
    <Text style={styles.sectionTitle}>Reviews</Text>
    {reviews.map((r, i) => (
      <View key={i} style={styles.reviewCard} testID={`review-${i}`}>
        <View style={styles.reviewHeader}>
          <Text style={styles.reviewUsername}>{r.username}</Text>
          {r.rating !== null && (
            <Text style={styles.reviewRating}>
              {'★'.repeat(Math.min(5, Math.max(0, r.rating)))}
              {'☆'.repeat(5 - Math.min(5, Math.max(0, r.rating)))}
            </Text>
          )}
        </View>
        <Text style={styles.reviewText}>{r.review}</Text>
      </View>
    ))}
  </View>
)}
```

Replace with:
```tsx
{/* Reviews */}
{(friendReviews.length > 0 || topReviews.length > 0) && (
  <View>
    <Text style={styles.sectionTitle}>Reviews</Text>

    {friendReviews.length > 0 && (
      <View>
        <Text style={styles.reviewSubheader}>From your friends</Text>
        {friendReviews.map((r, i) => (
          <View key={i} style={styles.reviewCard} testID={`friend-review-${i}`}>
            <View style={styles.reviewHeader}>
              <Text style={styles.reviewUsername}>{r.username}</Text>
              {r.rating !== null && (
                <Text style={styles.reviewRating}>
                  {'★'.repeat(Math.min(5, Math.max(0, Math.round(r.rating))))}
                  {'☆'.repeat(5 - Math.min(5, Math.max(0, Math.round(r.rating))))}
                </Text>
              )}
            </View>
            <Text style={styles.reviewText}>{r.review}</Text>
          </View>
        ))}
      </View>
    )}

    {topReviews.length > 0 && (
      <View>
        <Text style={styles.reviewSubheader}>GoodReads reviews</Text>
        {topReviews.map((r) => (
          <View key={r.id} style={styles.reviewCard} testID={`seeded-review-${r.id}`}>
            <View style={styles.reviewHeader}>
              <Text style={styles.reviewUsername}>{r.reviewerName ?? 'Anonymous'}</Text>
              {r.rating !== null && (
                <Text style={styles.reviewRating}>
                  {'★'.repeat(Math.min(5, Math.max(0, Math.round(r.rating))))}
                  {'☆'.repeat(5 - Math.min(5, Math.max(0, Math.round(r.rating))))}
                </Text>
              )}
            </View>
            <Text style={styles.reviewText}>{r.body}</Text>
          </View>
        ))}
      </View>
    )}
  </View>
)}
```

- [ ] **Step 6: Add `reviewSubheader` to the memoized styles**

Inside the `useMemo(() => StyleSheet.create({...}), [colors])` block, add after the existing `reviewText` entry:

```tsx
reviewSubheader: {
  fontSize: 14,
  fontFamily: Fonts.semiBold,
  color: colors.textSecondary,
  marginBottom: 8,
  marginTop: 4,
},
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add app/book/[bookId].tsx
git commit -m "feat: tappable author link and friend/seeded reviews on book detail"
```

---

## Task 8: scripts/import-goodreads-authors.mjs

**Files:**
- Create: `scripts/import-goodreads-authors.mjs`

- [ ] **Step 1: Create the script**

```javascript
/**
 * Import GoodReads author data into Supabase.
 *
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_KEY=eyJ... \
 *   node scripts/import-goodreads-authors.mjs /path/to/authors.json
 *
 * Reads NDJSON. Strips HTML from bios. Skips entries with no name.
 * Upserts on goodreads_author_id.
 */

import fs from 'fs';
import readline from 'readline';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const FILE_PATH = process.argv[2];
const BATCH_SIZE = 100;
const DELAY_MS = 500;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables.');
  process.exit(1);
}
if (!FILE_PATH) {
  console.error('Usage: node scripts/import-goodreads-authors.mjs /path/to/authors.json');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function stripHtml(str) {
  if (!str) return null;
  return str
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim() || null;
}

function transform(raw) {
  const id = raw.author_id ?? raw.id;
  if (!id) return null;
  const name = raw.name?.trim();
  if (!name) return null;

  return {
    goodreads_author_id: String(id),
    name,
    bio: stripHtml(raw.about ?? raw.bio),
    photo_url: raw.image_url && !raw.image_url.includes('nophoto') ? raw.image_url : null,
    born_date: raw.born_at?.trim() || null,
    website: raw.website?.trim() || null,
  };
}

async function flushBatch(batch) {
  const { error } = await supabase
    .from('authors')
    .upsert(batch, { onConflict: 'goodreads_author_id', ignoreDuplicates: false });
  if (error) console.error('Upsert error:', error.message);
}

async function run() {
  console.log(`Reading: ${FILE_PATH}`);
  const rl = readline.createInterface({
    input: fs.createReadStream(FILE_PATH, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  let lineNum = 0, imported = 0, skipped = 0, batch = [];

  for await (const line of rl) {
    lineNum++;
    const trimmed = line.trim();
    if (!trimmed || trimmed === '[' || trimmed === ']') continue;
    const jsonStr = trimmed.endsWith(',') ? trimmed.slice(0, -1) : trimmed;

    let raw;
    try { raw = JSON.parse(jsonStr); }
    catch { skipped++; continue; }

    const row = transform(raw);
    if (!row) { skipped++; continue; }

    batch.push(row);
    if (batch.length >= BATCH_SIZE) {
      await flushBatch(batch);
      imported += batch.length;
      batch = [];
      await new Promise((r) => setTimeout(r, DELAY_MS));
      if (imported % 5000 === 0) {
        console.log(`  imported ${imported.toLocaleString()} | skipped ${skipped.toLocaleString()} | line ${lineNum.toLocaleString()}`);
      }
    }
  }

  if (batch.length > 0) {
    await flushBatch(batch);
    imported += batch.length;
  }

  console.log(`\nDone. Imported: ${imported.toLocaleString()}, Skipped: ${skipped.toLocaleString()}`);
}

run().catch((err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Verify the script syntax**

```bash
node --input-type=module --eval "import './scripts/import-goodreads-authors.mjs'" 2>&1 | head -5
```

Expected: exits with "Set SUPABASE_URL..." error (the arg-check fires before file arg), meaning it parsed cleanly.

- [ ] **Step 3: Commit**

```bash
git add scripts/import-goodreads-authors.mjs
git commit -m "feat: add import-goodreads-authors script"
```

---

## Task 9: scripts/import-goodreads.mjs — resolve id-only authors

**Files:**
- Modify: `scripts/import-goodreads.mjs`

- [ ] **Step 1: Add the `loadAuthorMap` function** (after the `supabase` client is created, before `extractAuthor`)

```javascript
async function loadAuthorMap() {
  const map = new Map(); // goodreads_author_id → name
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('authors')
      .select('goodreads_author_id, name')
      .range(from, from + PAGE - 1);
    if (error) { console.warn('Could not load author map:', error.message); break; }
    if (!data || data.length === 0) break;
    for (const row of data) map.set(row.goodreads_author_id, row.name);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  console.log(`Loaded ${map.size.toLocaleString()} authors into memory.`);
  return map;
}
```

- [ ] **Step 2: Update `extractAuthor` to accept and use the map**

Find:
```javascript
function extractAuthor(raw) {
  // Format A: authors: [{ name: "..." }]
  if (Array.isArray(raw.authors) && raw.authors[0]?.name) return raw.authors[0].name;
  // Format B: authors: [{ author_id: "...", role: "..." }] — name not embedded
  if (Array.isArray(raw.authors) && raw.authors[0]?.author_id) return null; // skip, no name
  // Format C: author: { name: "..." }
  if (raw.author?.name) return raw.author.name;
  // Format D: author_name: "..."
  if (typeof raw.author_name === 'string') return raw.author_name;
  return null;
}
```

Replace with:
```javascript
function extractAuthor(raw, authorMap) {
  // Format A: authors: [{ name: "..." }]
  if (Array.isArray(raw.authors) && raw.authors[0]?.name)
    return { name: raw.authors[0].name, authorId: null };
  // Format B: authors: [{ author_id: "..." }] — resolve name from pre-loaded map
  if (Array.isArray(raw.authors) && raw.authors[0]?.author_id) {
    const id = String(raw.authors[0].author_id);
    const name = authorMap.get(id);
    return name ? { name, authorId: id } : { name: null, authorId: null };
  }
  // Format C: author: { name: "..." }
  if (raw.author?.name) return { name: raw.author.name, authorId: null };
  // Format D: author_name: "..."
  if (typeof raw.author_name === 'string') return { name: raw.author_name, authorId: null };
  return { name: null, authorId: null };
}
```

- [ ] **Step 3: Update `transform` to pass `authorMap` and include `goodreads_author_id`**

Find:
```javascript
function transform(raw) {
  const id = raw.book_id ?? raw.id;
  if (!id) return null;

  const title = raw.title_without_series ?? raw.title;
  if (!title?.trim()) return null;

  const author = extractAuthor(raw);
  if (!author) return null;
```

Replace with:
```javascript
function transform(raw, authorMap) {
  const id = raw.book_id ?? raw.id;
  if (!id) return null;

  const title = raw.title_without_series ?? raw.title;
  if (!title?.trim()) return null;

  const { name: author, authorId: goodreads_author_id } = extractAuthor(raw, authorMap);
  if (!author) return null;
```

Then find the `return {` block inside `transform` and add `goodreads_author_id` after `goodreads_id`:

```javascript
  return {
    goodreads_id: String(id),
    title: title.trim(),
    author: author.trim(),
    goodreads_author_id,        // ← add this line
    cover_url: cleanCover,
    // ... rest unchanged
  };
```

- [ ] **Step 4: Update `run()` to load the author map at startup and pass it to `transform`**

Find in `run()`:
```javascript
async function run() {
  console.log(`Reading: ${FILE_PATH}`);
```

Replace with:
```javascript
async function run() {
  const authorMap = await loadAuthorMap();
  console.log(`Reading: ${FILE_PATH}`);
```

Then find all calls to `transform(raw)` inside `run()` and replace with `transform(raw, authorMap)`.

- [ ] **Step 5: Verify syntax**

```bash
node --input-type=module --eval "import './scripts/import-goodreads.mjs'" 2>&1 | head -5
```

Expected: "Set SUPABASE_URL..." error (arg-check fires), meaning it parsed cleanly.

- [ ] **Step 6: Commit**

```bash
git add scripts/import-goodreads.mjs
git commit -m "feat: resolve id-only authors using pre-loaded map in import-goodreads"
```

---

## Task 10: scripts/import-goodreads-reviews.mjs

**Files:**
- Create: `scripts/import-goodreads-reviews.mjs`

Streams reviews.json, accumulates per-book aggregates and top-10 reviews in memory, then writes in batches.

- [ ] **Step 1: Create the script**

```javascript
/**
 * Import GoodReads reviews into Supabase.
 *
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_KEY=eyJ... \
 *   node scripts/import-goodreads-reviews.mjs /path/to/reviews.json
 *
 * Streams the full reviews file (can be 50M+ lines). Keeps top 10 reviews
 * per book by helpful_votes. Recomputes books.rating and books.users_read_count
 * from the aggregated data.
 */

import fs from 'fs';
import readline from 'readline';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const FILE_PATH = process.argv[2];
const BATCH_SIZE = 100;
const DELAY_MS = 200;
const MAX_REVIEWS_PER_BOOK = 10;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables.');
  process.exit(1);
}
if (!FILE_PATH) {
  console.error('Usage: node scripts/import-goodreads-reviews.mjs /path/to/reviews.json');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/** Load goodreads_id → { id (uuid) } for all seeded books. */
async function loadBookMap() {
  const map = new Map();
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('books')
      .select('id, goodreads_id')
      .not('goodreads_id', 'is', null)
      .range(from, from + PAGE - 1);
    if (error) { console.warn('Could not load book map:', error.message); break; }
    if (!data || data.length === 0) break;
    for (const row of data) map.set(row.goodreads_id, row.id);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  console.log(`Loaded ${map.size.toLocaleString()} books into memory.`);
  return map;
}

/**
 * Add a raw review record to the in-memory accumulator.
 * acc: goodreadsBookId → { totalRating, count, top10[] }
 */
function addToAccumulator(acc, goodreadsBookId, raw) {
  let entry = acc.get(goodreadsBookId);
  if (!entry) {
    entry = { totalRating: 0, count: 0, top10: [] };
    acc.set(goodreadsBookId, entry);
  }

  const rating = parseFloat(raw.rating);
  if (!isNaN(rating) && rating > 0) {
    entry.totalRating += rating;
    entry.count += 1;
  }

  const body = raw.review_text?.trim();
  if (body) {
    const helpful = parseInt(raw.n_votes ?? raw.helpful_votes ?? '0', 10) || 0;
    entry.top10.push({
      goodreads_review_id: raw.review_id ? String(raw.review_id) : null,
      reviewer_name: raw.user_id ? `user_${raw.user_id}` : null,
      rating: isNaN(rating) ? null : Math.round(rating * 10) / 10,
      body: body.slice(0, 2000),
      date_added: raw.date_updated ? raw.date_updated.split(' ')[0] : null,
      helpful_votes: helpful,
    });
    // Keep only top MAX_REVIEWS_PER_BOOK by helpful_votes
    if (entry.top10.length > MAX_REVIEWS_PER_BOOK * 2) {
      entry.top10.sort((a, b) => b.helpful_votes - a.helpful_votes);
      entry.top10.length = MAX_REVIEWS_PER_BOOK;
    }
  }
}

async function flushReviews(batch) {
  const { error } = await supabase
    .from('book_reviews')
    .upsert(batch, { onConflict: 'goodreads_review_id', ignoreDuplicates: false });
  if (error) console.error('Review upsert error:', error.message);
}

async function run() {
  console.log('Loading existing books...');
  const bookMap = await loadBookMap();

  console.log(`Streaming reviews: ${FILE_PATH}`);
  const rl = readline.createInterface({
    input: fs.createReadStream(FILE_PATH, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  const acc = new Map(); // goodreadsBookId → { totalRating, count, top10 }
  let lineNum = 0, skipped = 0;

  for await (const line of rl) {
    lineNum++;
    if (lineNum % 1_000_000 === 0) {
      console.log(`  processed ${lineNum.toLocaleString()} lines, ${acc.size.toLocaleString()} books accumulated...`);
    }

    const trimmed = line.trim();
    if (!trimmed || trimmed === '[' || trimmed === ']') continue;
    const jsonStr = trimmed.endsWith(',') ? trimmed.slice(0, -1) : trimmed;

    let raw;
    try { raw = JSON.parse(jsonStr); }
    catch { skipped++; continue; }

    const goodreadsBookId = raw.book_id ? String(raw.book_id) : null;
    if (!goodreadsBookId || !bookMap.has(goodreadsBookId)) { skipped++; continue; }

    addToAccumulator(acc, goodreadsBookId, raw);
  }

  console.log(`\nStreaming complete. ${acc.size.toLocaleString()} books with review data.`);
  console.log('Writing reviews and updating book stats...');

  let reviewBatch = [];
  let reviewsWritten = 0, booksUpdated = 0;

  for (const [goodreadsBookId, entry] of acc) {
    const bookUuid = bookMap.get(goodreadsBookId);
    if (!bookUuid) continue;

    // Sort and trim top10 to final list
    entry.top10.sort((a, b) => b.helpful_votes - a.helpful_votes);
    entry.top10.length = Math.min(entry.top10.length, MAX_REVIEWS_PER_BOOK);

    // Queue reviews
    for (const review of entry.top10) {
      reviewBatch.push({ ...review, book_id: bookUuid });
    }

    // Update book stats
    const newRating = entry.count > 0
      ? Math.round((entry.totalRating / entry.count) * 100) / 100
      : null;
    const { error } = await supabase
      .from('books')
      .update({ rating: newRating, users_read_count: entry.count })
      .eq('id', bookUuid);
    if (error) console.error('Book update error:', error.message);
    else booksUpdated++;

    if (reviewBatch.length >= BATCH_SIZE) {
      await flushReviews(reviewBatch);
      reviewsWritten += reviewBatch.length;
      reviewBatch = [];
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  if (reviewBatch.length > 0) {
    await flushReviews(reviewBatch);
    reviewsWritten += reviewBatch.length;
  }

  console.log(`\nDone. Reviews written: ${reviewsWritten.toLocaleString()}, Books updated: ${booksUpdated.toLocaleString()}, Skipped lines: ${skipped.toLocaleString()}`);
}

run().catch((err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Verify syntax**

```bash
node --input-type=module --eval "import './scripts/import-goodreads-reviews.mjs'" 2>&1 | head -5
```

Expected: "Set SUPABASE_URL..." error.

- [ ] **Step 3: Commit**

```bash
git add scripts/import-goodreads-reviews.mjs
git commit -m "feat: add import-goodreads-reviews script"
```

---

## Task 11: scripts/import-goodreads-tags.mjs

**Files:**
- Create: `scripts/import-goodreads-tags.mjs`

- [ ] **Step 1: Create the script**

```javascript
/**
 * Improve books.genres using GoodReads tag data.
 *
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_KEY=eyJ... \
 *   node scripts/import-goodreads-tags.mjs /path/to/tags.json /path/to/book_tags.json
 *
 * Reads tags.json to build a tag_id→name map, then streams book_tags.json.
 * For each book, selects genre-matching tags by count and updates books.genres
 * only when the new list has more items than the existing value.
 */

import fs from 'fs';
import readline from 'readline';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const TAGS_FILE = process.argv[2];
const BOOK_TAGS_FILE = process.argv[3];
const BATCH_SIZE = 100;
const DELAY_MS = 200;

const GENRE_SHELVES = new Set([
  'fantasy', 'romance', 'science-fiction', 'sci-fi', 'mystery', 'thriller',
  'historical-fiction', 'literary-fiction', 'horror', 'young-adult', 'ya',
  'contemporary', 'paranormal', 'dystopian', 'adventure', 'classics',
  'biography', 'memoir', 'self-help', 'non-fiction', 'nonfiction',
  'graphic-novels', 'manga', 'poetry', 'humor', 'crime', 'detective',
  'urban-fantasy', 'epic-fantasy', 'high-fantasy', 'dark-fantasy',
  'magical-realism', 'historical-romance', 'paranormal-romance',
  'chick-lit', 'short-stories', 'spirituality', 'philosophy',
  'psychology', 'science', 'history', 'politics', 'travel',
  'children', "children's", 'middle-grade', 'picture-books',
]);

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY.');
  process.exit(1);
}
if (!TAGS_FILE || !BOOK_TAGS_FILE) {
  console.error('Usage: node scripts/import-goodreads-tags.mjs /path/to/tags.json /path/to/book_tags.json');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function loadTagMap() {
  const map = new Map(); // tag_id → lowercase name
  const rl = readline.createInterface({
    input: fs.createReadStream(TAGS_FILE, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === '[' || trimmed === ']') continue;
    const jsonStr = trimmed.endsWith(',') ? trimmed.slice(0, -1) : trimmed;
    try {
      const raw = JSON.parse(jsonStr);
      const id = raw.tag_id ?? raw.id;
      const name = raw.tag_name ?? raw.name;
      if (id != null && name) map.set(String(id), name.toLowerCase());
    } catch {}
  }
  console.log(`Loaded ${map.size.toLocaleString()} tags.`);
  return map;
}

async function loadBookMap() {
  const map = new Map(); // goodreads_id → { id, genres }
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('books')
      .select('id, goodreads_id, genres')
      .not('goodreads_id', 'is', null)
      .range(from, from + PAGE - 1);
    if (error) { console.warn('loadBookMap error:', error.message); break; }
    if (!data || data.length === 0) break;
    for (const row of data) map.set(row.goodreads_id, { id: row.id, genres: row.genres });
    if (data.length < PAGE) break;
    from += PAGE;
  }
  console.log(`Loaded ${map.size.toLocaleString()} books.`);
  return map;
}

async function run() {
  const tagMap = await loadTagMap();
  const bookMap = await loadBookMap();

  // Accumulate: goodreadsBookId → Map<genreName, totalCount>
  const acc = new Map();

  const rl = readline.createInterface({
    input: fs.createReadStream(BOOK_TAGS_FILE, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  let lineNum = 0;
  for await (const line of rl) {
    lineNum++;
    const trimmed = line.trim();
    if (!trimmed || trimmed === '[' || trimmed === ']') continue;
    const jsonStr = trimmed.endsWith(',') ? trimmed.slice(0, -1) : trimmed;

    let raw;
    try { raw = JSON.parse(jsonStr); } catch { continue; }

    const goodreadsBookId = raw.book_id ? String(raw.book_id) : null;
    if (!goodreadsBookId || !bookMap.has(goodreadsBookId)) continue;

    // Handle two formats:
    // Format A: { book_id, tag_id, count }
    // Format B: { book_id, shelves: [{tag_id, count}] }
    const pairs = raw.shelves
      ? raw.shelves.map((s) => ({ tagId: String(s.tag_id ?? s.id), count: parseInt(s.count, 10) || 0 }))
      : [{ tagId: String(raw.tag_id), count: parseInt(raw.count, 10) || 0 }];

    let tagCounts = acc.get(goodreadsBookId);
    if (!tagCounts) { tagCounts = new Map(); acc.set(goodreadsBookId, tagCounts); }

    for (const { tagId, count } of pairs) {
      const tagName = tagMap.get(tagId);
      if (!tagName || !GENRE_SHELVES.has(tagName)) continue;
      tagCounts.set(tagName, (tagCounts.get(tagName) ?? 0) + count);
    }
  }

  console.log(`\nComputed tag data for ${acc.size.toLocaleString()} books. Writing updates...`);

  let updateBatch = [];
  let updated = 0, skipped = 0;

  for (const [goodreadsBookId, tagCounts] of acc) {
    const book = bookMap.get(goodreadsBookId);
    if (!book) continue;

    const genres = [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name);

    const existingCount = book.genres?.length ?? 0;
    if (genres.length <= existingCount) { skipped++; continue; }

    updateBatch.push({ id: book.id, genres });

    if (updateBatch.length >= BATCH_SIZE) {
      for (const { id, genres } of updateBatch) {
        const { error } = await supabase.from('books').update({ genres }).eq('id', id);
        if (error) console.error('Genre update error:', error.message);
      }
      updated += updateBatch.length;
      updateBatch = [];
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  if (updateBatch.length > 0) {
    for (const { id, genres } of updateBatch) {
      await supabase.from('books').update({ genres }).eq('id', id);
    }
    updated += updateBatch.length;
  }

  console.log(`\nDone. Updated: ${updated.toLocaleString()}, Skipped (no improvement): ${skipped.toLocaleString()}`);
}

run().catch((err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Verify syntax**

```bash
node --input-type=module --eval "import './scripts/import-goodreads-tags.mjs'" 2>&1 | head -5
```

Expected: "Set SUPABASE_URL..." error.

- [ ] **Step 3: Commit**

```bash
git add scripts/import-goodreads-tags.mjs
git commit -m "feat: add import-goodreads-tags script"
```

---

## Running the full pipeline

Once all tasks are complete, run the scripts in order:

```bash
# 1. Authors first
SUPABASE_URL=https://xxx.supabase.co \
SUPABASE_SERVICE_KEY=eyJ... \
node scripts/import-goodreads-authors.mjs /path/to/authors.json

# 2. Books (pre-loads author map to resolve id-only authors)
SUPABASE_URL=https://xxx.supabase.co \
SUPABASE_SERVICE_KEY=eyJ... \
node scripts/import-goodreads.mjs /path/to/books.json

# 3. Reviews (after books so book UUIDs exist)
SUPABASE_URL=https://xxx.supabase.co \
SUPABASE_SERVICE_KEY=eyJ... \
node scripts/import-goodreads-reviews.mjs /path/to/reviews.json

# 4. Tags (after books so book UUIDs exist)
SUPABASE_URL=https://xxx.supabase.co \
SUPABASE_SERVICE_KEY=eyJ... \
node scripts/import-goodreads-tags.mjs /path/to/tags.json /path/to/book_tags.json
```
