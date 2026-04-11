# Social — Following Design Spec

**Date:** 2026-04-11
**Status:** Approved

---

## Overview

The first Social subsystem: asymmetric following, user search, a public user profile page, and a follow-request approval flow for private profiles. Replaces the "Coming in Phase 3" placeholder on the Social tab.

This spec covers following only. Activity feed, book clubs, challenges, and DMs are separate future specs.

---

## Architecture

Two new Supabase tables (`follows`, `follow_requests`), one new lib file (`lib/follows.ts`), one new screen (`app/user/[userId].tsx`), modifications to the Social tab and Profile tab.

No new navigation stack — the user profile screen uses Expo Router's dynamic route. The Social tab hosts inline search.

**Tech Stack:** Expo Router, React Native, Supabase, `@expo/vector-icons` (Ionicons), `constants/theme.ts` tokens.

---

## Section 1: Data Layer

### Supabase Migration

Two new tables, created via SQL migration run in the Supabase dashboard:

```sql
-- Accepted follows
CREATE TABLE follows (
  follower_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id)
);

-- Pending requests to private profiles
CREATE TABLE follow_requests (
  requester_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (requester_id, target_id)
);
```

### `lib/follows.ts` — new file

```typescript
export interface UserSearchResult {
  id: string;
  username: string;
  bio: string | null;
  is_private: boolean;
  followStatus: 'following' | 'requested' | 'none';
}

export interface FollowRequest {
  requesterId: string;
  username: string;
  bio: string | null;
}

// Search profiles by username (case-insensitive prefix match)
// Excludes the current user from results
export async function searchUsers(
  query: string,
  currentUserId: string
): Promise<UserSearchResult[]>

// If target is public: insert into follows
// If target is private: insert into follow_requests
export async function followUser(
  followerId: string,
  targetId: string,
  isPrivate: boolean
): Promise<void>

// Remove from follows
export async function unfollowUser(
  followerId: string,
  targetId: string
): Promise<void>

// Remove from follow_requests
export async function cancelFollowRequest(
  requesterId: string,
  targetId: string
): Promise<void>

// List of profiles the given user follows (for Social tab following list)
export async function getFollowing(userId: string): Promise<UserSearchResult[]>

// Incoming pending follow requests for a private profile owner
export async function getFollowRequests(userId: string): Promise<FollowRequest[]>

// Move from follow_requests to follows
export async function approveFollowRequest(
  requesterId: string,
  targetId: string
): Promise<void>

// Delete from follow_requests
export async function declineFollowRequest(
  requesterId: string,
  targetId: string
): Promise<void>

// Returns the follow relationship from followerId's perspective
export async function getFollowStatus(
  followerId: string,
  targetId: string
): Promise<'following' | 'requested' | 'none'>
```

**Implementation notes:**

- `searchUsers`: `SELECT id, username, bio, is_private FROM profiles WHERE username ILIKE $1 AND id != $2 LIMIT 20`, then for each result call `getFollowStatus` in parallel.
- `followUser`: if `isPrivate` is false, insert into `follows`; otherwise insert into `follow_requests`.
- `getFollowing`: join `follows` with `profiles` on `following_id = profiles.id` where `follower_id = userId`. Return with `followStatus: 'following'` for all.
- `getFollowRequests`: join `follow_requests` with `profiles` on `requester_id = profiles.id` where `target_id = userId`.
- `approveFollowRequest`: delete from `follow_requests` where `(requester_id, target_id) = (requesterId, targetId)`, then insert into `follows`.
- `getFollowStatus`: check `follows` first; if not found check `follow_requests`; return appropriate status.

---

## Section 2: Social Tab (`app/(tabs)/social.tsx`)

### Data fetch

On `useFocusEffect`:
```typescript
getFollowing(userId)
```

Search results fetched separately on debounced input change (300ms) via `searchUsers(query, userId)`.

### Layout (top to bottom, inside a `ScrollView`)

**Search bar** — always visible at the top. A `TextInput` styled as a search field with a search icon. On input change (debounced 300ms), calls `searchUsers` and renders results below. Clears to show the Following section when empty.

**Search results** (visible only when query is non-empty) — `FlatList` of `UserRow` components. Each row:
- Initials circle (40×40, `Colors.primary` background)
- Username (bold) + bio snippet (1 line, muted)
- Follow button: state-aware (see Follow Button States below)
- Tap row → navigate to `app/user/[userId]`

**Following section** (visible only when query is empty) — section title "Following" + list of users you follow. Same `UserRow` layout. Empty state: "Search for people to follow." Tap row → navigate to `app/user/[userId]`.

**Activity stub** (visible only when query is empty, rendered below following list) — section title "Activity" + a single muted card with text: "Your friends' activity will appear here."

### Follow Button States

| `followStatus` | Button label | Style | Tap action |
|---|---|---|---|
| `none` | Follow | Filled primary | `followUser` → optimistic update to `requested` or `following` |
| `requested` | Requested | Outlined | `cancelFollowRequest` → optimistic update to `none` |
| `following` | Following | Outlined | `unfollowUser` → optimistic update to `none` |

---

## Section 3: Other User's Profile Page (`app/user/[userId].tsx`)

### Data fetch

On `useFocusEffect`:
```typescript
Promise.all([
  getProfile(userId),
  getFollowStatus(currentUserId, userId),
  // shelf counts only if public or following:
  getShelf(userId, 'reading'),
  getShelf(userId, 'want'),
  getShelf(userId, 'read'),
  getShelf(userId, 'dnf'),
])
```

Single loading spinner while resolving.

### Layout (top to bottom, inside a `ScrollView`)

**Header** — same as own-profile: initials circle (80×80), username (24px bold), bio (14px muted, hidden if null).

**Follow button** — centered below header. State-aware (same three states as Social tab). On follow/unfollow/cancel, update local state optimistically.

**Shelf counts row** — four pills: "Read · N", "Reading · N", "Want · N", "DNF · N". Shown when:
- Profile is public, OR
- Profile is private AND `followStatus === 'following'`

When private and not following: replace with a centered "🔒 Private profile" label instead.

### Navigation

Reachable from:
- Social tab search results (tap a result row)
- Social tab following list (tap a following row)

Back navigation via standard Expo Router header back button.

---

## Section 4: Follow Requests on Own Profile (`app/(tabs)/profile.tsx`)

### Data fetch

`getFollowRequests(userId)` added to the existing `Promise.all` in `useFocusEffect`. Stored in a `followRequests` state slice.

### Layout

A "Follow Requests" card inserted at the very top of the profile `ScrollView`, above the user header. Rendered only when `followRequests.length > 0`.

**Card contents:**
- Title: "Follow Requests" with a count badge (e.g. `2`)
- List of requester rows: initials circle (40×40), username + bio snippet, **Accept** and **Decline** buttons
- Accept → `approveFollowRequest` → remove row from local state optimistically
- Decline → `declineFollowRequest` → remove row from local state optimistically

---

## File Map

```
lib/follows.ts                        CREATE — all follow functions
app/(tabs)/social.tsx                 MODIFY — replace placeholder with search + following + stub
app/user/[userId].tsx                 CREATE — other user's profile page
app/(tabs)/profile.tsx                MODIFY — add follow requests card + getFollowRequests fetch
__tests__/lib/follows.test.ts         CREATE — unit tests for all lib functions
__tests__/screens/social.test.tsx     CREATE — Social tab render tests
__tests__/screens/userProfile.test.tsx  CREATE — user profile screen render tests
__tests__/screens/profile.test.tsx    MODIFY — add follow requests card tests
```

---

## Testing

### `__tests__/lib/follows.test.ts`
- `searchUsers`: returns results excluding current user; includes correct followStatus
- `followUser`: inserts into `follows` for public profile; inserts into `follow_requests` for private
- `unfollowUser`: deletes from `follows`
- `cancelFollowRequest`: deletes from `follow_requests`
- `getFollowing`: returns list of followed profiles
- `getFollowRequests`: returns list of pending requesters
- `approveFollowRequest`: deletes from `follow_requests` and inserts into `follows`
- `declineFollowRequest`: deletes from `follow_requests`
- `getFollowStatus`: returns `'following'`, `'requested'`, or `'none'` correctly

### `__tests__/screens/social.test.tsx`
- Renders search bar and activity stub on load
- Shows following list when query is empty
- Shows search results when query is non-empty
- Follow button shows "Follow" for `none` status
- Follow button shows "Requested" for `requested` status
- Follow button shows "Following" for `following` status

### `__tests__/screens/userProfile.test.tsx`
- Renders username and initials
- Shows Follow button for public profile with status `none`
- Shows shelf counts for public profile
- Shows "🔒 Private profile" for private profile with status `none`
- Shows shelf counts for private profile with status `following`
- Follow button tap calls `followUser`

### `__tests__/screens/profile.test.tsx` (additions)
- Shows follow requests card when requests are pending
- Accept button calls `approveFollowRequest`
- Decline button calls `declineFollowRequest`
- Hides card when no pending requests

---

## Out of Scope

- Followers list / following list drill-down (no counts shown)
- Blocking users
- Muting users
- Push notifications for follow requests or approvals
- Activity feed content (placeholder only in this spec)
