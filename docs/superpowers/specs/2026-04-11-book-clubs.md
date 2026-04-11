# Book Clubs + Own Activity Feed Design Spec

## Overview

Add invite-only book clubs to the app, giving small groups a shared space to read together, discuss books, and track each other's progress. Simultaneously fix the activity feed so users see their own activity alongside the people they follow.

---

## 1. Data Layer

### Tables

**`book_clubs`**
```sql
id          uuid primary key default gen_random_uuid()
name        text not null
description text
owner_id    uuid not null references profiles(id)
created_at  timestamptz default now()
```

**`club_members`**
```sql
club_id   uuid not null references book_clubs(id) on delete cascade
user_id   uuid not null references profiles(id) on delete cascade
role      text not null check (role in ('owner', 'member'))
joined_at timestamptz default now()
primary key (club_id, user_id)
```

**`club_books`**
```sql
id         uuid primary key default gen_random_uuid()
club_id    uuid not null references book_clubs(id) on delete cascade
book_id    uuid not null references books(id)
added_by   uuid not null references profiles(id)
started_at timestamptz default now()
ended_at   timestamptz          -- null = currently reading
```

**`club_posts`**
```sql
id         uuid primary key default gen_random_uuid()
club_id    uuid not null references book_clubs(id) on delete cascade
author_id  uuid not null references profiles(id)
parent_id  uuid references club_posts(id) on delete cascade  -- null = top-level
body       text not null
created_at timestamptz default now()
```

Current club book is identified by `ended_at IS NULL`. At most one book per club should have `ended_at IS NULL` at a time (enforced by application logic when archiving).

### `lib/clubs.ts` — exported functions

| Function | Description |
|---|---|
| `getMyClubs(userId)` | All clubs where user is a member, with name, current book title + cover, member count |
| `getClub(clubId, userId)` | Club detail: metadata, current book, member list with current_page + %, reading history |
| `createClub(userId, name, description?)` | Insert club + owner member row |
| `addMember(clubId, userId)` | Insert member row (owner calls this; no acceptance step) |
| `removeMember(clubId, memberId)` | Delete member row; if last member, delete club |
| `setCurrentBook(clubId, bookId, addedBy)` | Archive current book (set ended_at = now()) then insert new club_books row |
| `archiveCurrentBook(clubId)` | Set ended_at = now() on the active club_books row |
| `getPosts(clubId)` | Top-level posts for a club, ordered newest first, with author username + reply count |
| `getThread(postId)` | Parent post + all direct replies ordered oldest first |
| `addPost(clubId, authorId, body, parentId?)` | Insert a club_post |
| `deletePost(postId, userId)` | Delete if userId === author_id |

---

## 2. Navigation & Screens

### New files

**`app/clubs.tsx`** — Clubs list screen
- Header: "My Clubs" + "New Club" button (opens a modal / inline form)
- FlatList of club cards: club name, current book cover + title, member count
- Empty state: "You're not in any clubs yet."
- Tapping a card navigates to `app/club/[clubId].tsx`

**`app/club/[clubId].tsx`** — Club detail screen
- Single scrollable screen
- Top section: club name, description, member avatars/names with current page and % progress
- Current book section: cover, title, "Change book" button (owner only)
- Reading history: list of past books (ended_at not null), ordered newest first
- Discussion section: top-level posts list, "New post" button
- Tapping a post navigates to `app/club/[clubId]/post/[postId].tsx`
- Owner sees "Add member" and "Remove member" controls

**`app/club/[clubId]/post/[postId].tsx`** — Post thread screen
- Shows parent post at top
- Replies listed oldest-first below
- Pinned reply input at bottom

### Modified files

**`app/(tabs)/social.tsx`**
- Add a "Clubs" button in the header (top-right area) that navigates to `app/clubs.tsx`

**`lib/activity.ts` — `getFeed` fix**
- Change `.in('actor_id', followingIds)` to `.in('actor_id', [...followingIds, userId])`
- This ensures the current user's own events appear on their feed

---

## 3. Testing

### `__tests__/lib/clubs.test.ts`
Unit tests for all 11 `lib/clubs.ts` functions using the testState + mockBuilder pattern. Key cases:
- `getMyClubs` returns [] when user has no clubs
- `getMyClubs` maps current book correctly when club has an active book
- `createClub` inserts club row and owner member row
- `addMember` inserts member row
- `setCurrentBook` archives old book and inserts new one
- `getPosts` returns top-level posts only (parent_id null)
- `getThread` returns parent + replies in order
- `addPost` with parentId = null creates top-level post
- `addPost` with parentId creates reply
- `deletePost` only deletes when userId matches author_id

### `__tests__/screens/clubs.test.tsx`
- Clubs list renders "My Clubs" heading
- Shows empty state when no clubs
- Renders club cards with name and current book title
- Tapping a card navigates to club detail

### `__tests__/screens/clubDetail.test.tsx`
- Shows club name and description
- Shows current book title and cover
- Shows member list with username and progress %
- Shows top-level posts
- Owner sees "Add member" button; non-owner does not
- Tapping a post navigates to thread
- "New post" button creates a post and it appears in the list

### `__tests__/screens/clubPost.test.tsx`
- Shows parent post body and author
- Shows replies oldest-first
- Reply input is pinned at bottom
- Submitting reply calls `addPost` and appends reply to list

### `__tests__/lib/activity.test.ts` (addition)
- `getFeed` includes the requesting user's own events (actor_id === userId)

### `__tests__/screens/social.test.tsx` (addition)
- "Clubs" button is visible in the header
- Tapping "Clubs" navigates to `/clubs`

---

## Design Decisions

- **No join requests**: Owner adds members directly. Keeps the feature simple for small, trusted groups.
- **One-level threading**: `parent_id` on `club_posts` is nullable. Replies point to a top-level post; replies cannot have their own replies. This avoids deep nesting complexity.
- **Current book via `ended_at IS NULL`**: Avoids a `current_book_id` column and the synchronization issues that come with it. Application logic archives the old book when setting a new one.
- **Member progress displayed from `user_books`**: Progress % for each member is read from the existing `user_books.current_page` / `books.page_count` — no separate progress tracking needed.
- **Own activity in feed**: A one-line fix (`[...followingIds, userId]`) so users see their own posts without a separate "your activity" section.
