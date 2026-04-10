# BookApp Design Spec
**Date:** 2026-04-09  
**Status:** Approved

---

## Overview

An iOS reading app that replaces GoodReads, Fable, and Bookly with a single, modern experience. Core pillars: reading session tracking, library management, social features, and book discovery. Built for the App Store with a Fable-quality UI.

**Target user:** Avid readers who currently juggle multiple apps and want one beautiful, fully-featured alternative.

---

## Architecture

| Layer | Technology |
|---|---|
| Frontend | React Native (Expo managed workflow) |
| Backend | Supabase (PostgreSQL, Auth, Realtime, Storage) |
| Book data | Google Books API (primary), Open Library (fallback) |
| Notifications | Expo Push Notifications |
| GoodReads import | CSV export parsing → mapped to user_books schema |

**Why Expo:** Developer is a React frontend engineer with no native mobile experience. Expo provides a native iOS feel while leveraging existing React skills, and handles App Store submission without requiring direct Xcode use.

**Why Supabase:** The app's data is highly relational (sessions → users → books → clubs → challenges). SQL handles this cleanly. Supabase also provides built-in auth (email + Apple Sign-In), real-time subscriptions for the activity feed and DMs, and file storage for covers and avatars.

---

## Navigation

Five-tab bottom navigation:

1. **Home** — daily reading dashboard (primary landing tab)
2. **Library** — book shelves
3. **Discover** — recommendations and browse
4. **Social** — activity feed, book clubs, challenges
5. **Profile** — personal stats, settings

---

## Section 1 — Core Tracking

### Reading Session

The primary interaction. Launched from the Home tab's current-book card.

**Timer-first UI:**
- Big live timer dominates the screen
- User enters their start page before beginning
- Pause/resume support
- On finish: enter end page → session saved automatically

**Manual log (fallback):**
- Available for sessions the user forgot to time
- Enter start page, end page, and time spent manually

**Session data stored:** `start_page`, `end_page`, `duration_seconds`, `started_at`, `book_id`, `user_id`

### Home Dashboard (Card Stack layout)

What the user sees every time they open the app:

- **Greeting + date** (top)
- **Current book hero card:** cover thumbnail, title, author, progress bar, estimated days remaining, tap-to-start timer button
- **Today's stats row:** pages read, time spent, streak (with flame icon)
- **Friends activity strip:** compact feed of recent friend activity

---

## Section 2 — Library

Four shelves:

| Shelf | Description |
|---|---|
| Reading | Currently in progress |
| Want to Read | To-be-read list |
| Read | Finished books |
| Did Not Finish | Abandoned books |

Each book card shows: cover art, title, author, progress bar (Reading shelf), star rating (Read shelf).

### Adding Books

Four entry points, all accessible via a floating `+` button:

1. **Search** — title or author via Google Books API
2. **ISBN scan** — camera barcode lookup
3. **GoodReads import** — parse GoodReads CSV export (available in GoodReads account settings), map shelves to the four above
4. **Manual entry** — type all fields by hand

---

## Section 3 — Stats

All stats computed from `reading_sessions`. No denormalized counters.

| Stat | Source |
|---|---|
| Reading streak | Consecutive days with ≥1 session |
| Pages per day | Sum of (end_page - start_page) grouped by date |
| Time spent | Sum of duration_seconds grouped by date/week |
| Yearly goal | Count of books on Read shelf vs. user's annual target |
| Books finished | Count of Read shelf entries by month/year |
| Reading pace | 7-day rolling pages/day average → estimated finish date for current book |
| Genre breakdown | Genre tags on finished books, visualized as a chart |

Stats are surfaced on the Home dashboard (today's snapshot) and a dedicated Stats screen accessible from Profile (historical charts).

---

## Section 4 — Social

### Profiles
- Public by default, toggleable to private
- Shows: avatar, bio, reading stats summary, yearly goal progress, current shelves, recent activity

### Following
- Asymmetric (Twitter-style): follow anyone with a public profile
- No mutual confirmation required

### Activity Feed (Social tab)
- What people you follow are reading, finishing, and reviewing
- Reading sessions are private by default; user can choose to share individual sessions

### Book Clubs
- Create or join a club
- Set a group reading book
- Threaded discussion posts
- Members see each other's progress on the shared book

### Reading Challenges
- Create a challenge with a goal (e.g. "Read 5 books in May") and a date range
- Invite followers to join
- Live leaderboard tracks each member's progress

### Direct Messages
- 1:1 messaging between mutual followers
- Primarily for sharing books and reactions

---

## Section 5 — Discovery

- **For You:** Personalized recommendations based on reading history, genres, and friend activity
- **Browse:** Curated shelves by genre, mood, and trending (via Google Books API)
- **Friend Activity:** What people you follow are currently reading — the most trusted discovery signal
- **Book Detail Page:** Cover, description, aggregated ratings, reviews from people you follow, one-tap "Add to Library"

---

## Data Model

| Table | Key fields |
|---|---|
| `users` | id, username, avatar_url, is_private, yearly_goal |
| `books` | id, google_books_id, title, author, cover_url, page_count, genres (text[]) |
| `user_books` | user_id, book_id, shelf (reading/want/read/dnf), current_page, rating, review |
| `reading_sessions` | id, user_id, book_id, start_page, end_page, duration_seconds, started_at |
| `follows` | follower_id, following_id |
| `book_clubs` | id, name, owner_id, current_book_id |
| `club_members` | club_id, user_id, role (owner/member) |
| `club_posts` | id, club_id, user_id, body, parent_id (threading) |
| `challenges` | id, creator_id, title, goal, start_date, end_date |
| `challenge_members` | challenge_id, user_id, progress |
| `messages` | id, sender_id, recipient_id, body, sent_at |

---

## Out of Scope (v1)

- Android support (Expo makes this achievable later with minimal extra work)
- Audiobook tracking
- E-reader integrations (Kindle sync, etc.)
- In-app purchases or premium tiers
