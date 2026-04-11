# Activity Feed Design Spec

**Date:** 2026-04-11
**Status:** Approved

---

## Overview

A friends' activity feed in the Social tab. Shows milestone events (started reading, finished a book, added to shelf) and explicitly shared reading sessions from people the current user follows. Feed items support likes and flat comments.

This spec covers the activity feed only. Book clubs, challenges, and DMs are separate future specs.

---

## Architecture

Pull-on-demand: one `activity_events` table queried at read time by joining against `follows`. No fan-out. Three new tables (`activity_events`, `activity_likes`, `activity_comments`), one new lib file (`lib/activity.ts`), modifications to the Social tab, the session screen, and the book detail screen.

**Auto-events** are written inside `lib/userBooks.ts` when `moveShelf` is called. **Shared sessions** are written from the session completion screen and the book detail page.

**Tech Stack:** Expo Router, React Native, Supabase, `@expo/vector-icons` (Ionicons), `constants/theme.ts` tokens.

---

## Section 1: Data Layer

### Supabase Migration

```sql
CREATE TABLE activity_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_type   text NOT NULL CHECK (event_type IN (
                 'started_book','finished_book','added_to_shelf','shared_session'
               )),
  book_id      uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  metadata     jsonb NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX activity_events_actor_created ON activity_events(actor_id, created_at DESC);

CREATE TABLE activity_likes (
  event_id    uuid NOT NULL REFERENCES activity_events(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

CREATE TABLE activity_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES activity_events(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

**`metadata` shape by event type:**
- `started_book`: `{}`
- `finished_book`: `{ rating: number | null, review_snippet: string | null }`
- `added_to_shelf`: `{ shelf: 'want' | 'dnf' }`
- `shared_session`: `{ pages_read: number, duration_seconds: number }`

### `lib/activity.ts` — new file

```typescript
export type EventType =
  | 'started_book'
  | 'finished_book'
  | 'added_to_shelf'
  | 'shared_session';

export interface ActivityEvent {
  id: string;
  actorId: string;
  actorUsername: string;
  eventType: EventType;
  bookId: string;
  bookTitle: string;
  bookCoverUrl: string | null;
  metadata: Record<string, any>;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
}

export interface ActivityComment {
  id: string;
  userId: string;
  username: string;
  body: string;
  createdAt: string;
}

// Returns up to 50 events from users the current user follows, newest first
export async function getFeed(userId: string): Promise<ActivityEvent[]>

// Writes one event row; called internally by userBooks and session screens
export async function createEvent(
  actorId: string,
  eventType: EventType,
  bookId: string,
  metadata: Record<string, any>
): Promise<void>

// Toggle helpers — insert or delete from activity_likes
export async function likeEvent(userId: string, eventId: string): Promise<void>
export async function unlikeEvent(userId: string, eventId: string): Promise<void>

// Returns comments for a given event, oldest first
export async function getComments(eventId: string): Promise<ActivityComment[]>

// Inserts a comment and returns the new row
export async function addComment(
  userId: string,
  eventId: string,
  body: string
): Promise<ActivityComment>
```

**Implementation notes:**

- `getFeed`: three sequential queries:
  1. Fetch `follows` where `follower_id = userId` → array of `following_id`s. If empty, return `[]`.
  2. Query `activity_events` with `.in('actor_id', followingIds)`, selecting:
     ```
     id, event_type, book_id, metadata, created_at,
     actor:profiles!actor_id(id, username),
     book:books!book_id(id, title, cover_url),
     likes:activity_likes(count),
     comments:activity_comments(count)
     ```
     Order by `created_at DESC`, limit 50.
  3. Query `activity_likes` where `user_id = userId` and `event_id` in the returned event IDs → set of liked event IDs. Derive `likedByMe` by checking membership.
  Map results to `ActivityEvent[]`.

- `createEvent`: simple insert into `activity_events`.
- `likeEvent` / `unlikeEvent`: insert/delete from `activity_likes`.
- `getComments`: query `activity_comments` joined with `profiles!user_id(username)`, order by `created_at ASC`.
- `addComment`: insert into `activity_comments`, return mapped `ActivityComment`.

### `lib/userBooks.ts` — modifications

In the existing `moveShelf` function, after the successful shelf update, call `createEvent` based on the new shelf:

```typescript
// After successful moveShelf:
if (shelf === 'reading') {
  await createEvent(userId, 'started_book', bookId, {});
} else if (shelf === 'read') {
  // Re-fetch the user_books row to get the latest rating and review
  const ub = await getUserBook(userId, bookId);
  await createEvent(userId, 'finished_book', bookId, {
    rating: ub?.rating ?? null,
    review_snippet: ub?.review ? ub.review.slice(0, 200) : null,
  });
} else if (shelf === 'want' || shelf === 'dnf') {
  await createEvent(userId, 'added_to_shelf', bookId, { shelf });
}
```

`getUserBook` is already exported from `lib/userBooks.ts` — no new dependency needed.

---

## Section 2: Social Tab (`app/(tabs)/social.tsx`)

### Data fetch

On `useFocusEffect` (already present), add `getFeed(userId)` alongside `getFollowing`:

```typescript
Promise.all([
  getFollowing(userId),
  getFeed(userId),
]).then(([followingData, feedData]) => {
  setFollowing(followingData);
  setFeed(feedData);
});
```

Add `refreshing` state for pull-to-refresh. `onRefresh` re-runs the same fetch.

### Layout change

The existing "Activity" section (currently a stub card) is replaced:

**Section title:** "Activity"

**Feed list:** one `FeedCard` per event. Empty state: "Follow people to see their activity here."

**Pull-to-refresh:** `ScrollView` already wraps the tab — add `refreshControl` prop.

### `FeedCard` component (defined inline in social.tsx)

```
[Avatar 40×40] ["{username} {verb} {bookTitle}"]   [timestamp]
               [cover 40×60] [rating stars if present]
               [review snippet, 2 lines, if present]
               [♥ N]  [💬 N]
```

**Verb by event type:**
- `started_book` → "is now reading"
- `finished_book` → "finished"
- `added_to_shelf` → "added to {shelf} list" (`want` → "want to read list", `dnf` → "did not finish list")
- `shared_session` → "read {pages_read} pages of"

**Like button:** filled heart if `likedByMe`, outline if not. Tap calls `likeEvent` or `unlikeEvent` with optimistic update on local feed state.

**Comment button:** tap opens the comments `Modal`.

**Card tap** (anywhere except like/comment buttons): navigate to `app/book/[bookId]`.

### Comments Modal

A standard React Native `Modal` with `animationType="slide"` and `presentationStyle="pageSheet"`.

Contents:
- Title bar: "Comments" + close `×` button
- `ScrollView` of comment rows: initials avatar (32×32), username (bold), body, relative timestamp
- Empty state text: "No comments yet. Be the first."
- Pinned bottom row: `TextInput` + Send `TouchableOpacity`. On Send: calls `addComment`, appends to local comment list optimistically, clears input.

`getComments(eventId)` is called when the modal opens.

---

## Section 3: Session Screen (`app/session/[bookId].tsx`)

### Share toggle on finish phase

When `phase === 'finish'`, the existing end-page input is shown. Add a "Share to feed" row below it:

```typescript
const [shareToFeed, setShareToFeed] = useState(false);
```

```
[Share to feed]   [Switch testID="share-toggle"]
```

Default: off.

### `saveSession` modification

After `createSession(...)` succeeds, if `shareToFeed` is true:

```typescript
await createEvent(userId, 'shared_session', bookId, {
  pages_read: ep - sp,
  duration_seconds: seconds,
});
```

Then `router.back()` as before.

---

## Section 4: Book Detail Screen (`app/book/[bookId].tsx`)

### Share progress button

Add a "Share progress" `TouchableOpacity` button to the existing book detail layout. Only shown when `userBook?.shelf === 'reading'`.

```typescript
const [shareConfirmed, setShareConfirmed] = useState(false);
```

On press:
```typescript
await createEvent(userId, 'shared_session', bookId, {
  pages_read: userBook.current_page,
  duration_seconds: 0,
});
setShareConfirmed(true);
setTimeout(() => setShareConfirmed(false), 2000);
```

Button label: `shareConfirmed ? 'Shared ✓' : 'Share progress'`

`testID="share-progress-btn"`

---

## File Map

```
lib/activity.ts                           CREATE — all activity functions
lib/userBooks.ts                          MODIFY — createEvent calls in moveShelf
app/(tabs)/social.tsx                     MODIFY — replace activity stub with feed + FeedCard + comments modal
app/session/[bookId].tsx                  MODIFY — share toggle in finish phase
app/book/[bookId].tsx                     MODIFY — share progress button
__tests__/lib/activity.test.ts            CREATE — unit tests for all lib functions
__tests__/screens/social.test.tsx         MODIFY — add feed rendering tests
__tests__/screens/session.test.tsx        MODIFY — add share toggle tests
__tests__/screens/bookDetail.test.tsx     MODIFY — add share progress button tests
```

---

## Testing

### `__tests__/lib/activity.test.ts`
- `getFeed`: returns empty array when following no one
- `getFeed`: returns events from followed users, mapped to `ActivityEvent`
- `createEvent`: inserts correct row
- `likeEvent`: inserts into `activity_likes`
- `unlikeEvent`: deletes from `activity_likes`
- `getComments`: returns comments in order
- `addComment`: inserts and returns new comment

### `__tests__/screens/social.test.tsx` (additions)
- Renders "Follow people to see their activity here." when feed is empty
- Renders feed card with correct verb for `started_book`
- Renders feed card with correct verb for `finished_book`
- Renders feed card with rating and review snippet when present
- Like button shows filled heart when `likedByMe` is true
- Tapping like button calls `likeEvent`
- Tapping comment button opens comments modal
- Tapping send in comments modal calls `addComment`

### `__tests__/screens/session.test.tsx` (additions)
- Share toggle is hidden before finish phase
- Share toggle appears in finish phase
- When share toggle is on and session saved, `createEvent` is called with `shared_session`
- When share toggle is off, `createEvent` is not called

### `__tests__/screens/bookDetail.test.tsx` (additions)
- Share progress button is visible when shelf is `reading`
- Share progress button is hidden when shelf is not `reading`
- Tapping share progress button calls `createEvent` with `shared_session`
- Button label changes to "Shared ✓" after tap

---

## Out of Scope

- Real-time feed updates via Supabase subscriptions
- Threaded comments
- Reactions beyond a single like
- Notifications for likes/comments
- Editing or deleting events, likes, or comments
- Feed pagination beyond 50 items
