# Chapter Chat

A full-featured social book tracking app built with React Native and Expo. Track your reading, log sessions, analyze your habits, and share your literary life with friends.

## Features

### Reading Tracker
- **Smart home dashboard** — greets you by time of day, shows your current reads with progress bars, and surfaces today's page count, reading time, and streak
- **Multi-book carousel** — track several books at once and swipe between them from the home screen
- **Timed & manual sessions** — log reading sessions with a built-in timer or manually enter pages and duration; sessions feed directly into your stats
- **Book detail** — shelf management, star rating, inline review editor, reading session history, friend reviews, and cover/genre editing

### Library
- **Four shelves**: Reading, Want to Read, Read, and DNF
- Sort by recent or alphabetical, search by title or author

### Stats & Analytics
- Weekly and monthly page-count bar charts with tap-to-inspect tooltips
- GitHub-style reading calendar heatmap with month navigation
- Genre breakdown pie chart
- Pages-by-day-of-week bar chart
- Rating distribution histogram
- Yearly goal progress, reading streak, weekly pace, and cumulative totals (pages, hours, sessions)

### Social
- **Activity feed** — see when friends start or finish books, log sessions, or add to shelves
- **Likes & comments** on activity events
- Follow / unfollow with follow-request support for private accounts
- Public user profiles with their reading stats and recent activity

### Book Clubs
- Create and join book clubs with a name and description
- Club discussion posts with member management

### Discovery & Search
- Search books, authors, and series
- Author detail pages with bibliography
- Series pages grouping related books

### Notifications
- Configurable daily reading reminders
- Streak protection alerts so you never break your chain
- In-app notification inbox with unread badge

### iOS Widget
- Native iOS home-screen widget showing current reading progress via a custom Expo native module and Live Activity

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Native 0.81 + Expo SDK 54 |
| Language | TypeScript |
| Navigation | Expo Router (file-based, typed routes) |
| Backend | Supabase (PostgreSQL + Auth + Storage) |
| Auth | Email/password + Apple Sign In |
| Charts | react-native-gifted-charts |
| Animations | react-native-reanimated |
| Notifications | expo-notifications |
| iOS Widget | Custom Expo native module |
| Testing | Jest + React Native Testing Library |

## Project Structure

```
app/
  (auth)/         # Login and sign-up screens
  (tabs)/         # Bottom tab screens: Home, Library, Stats, Social, Clubs
  book/[bookId]   # Book detail
  club/[clubId]   # Club detail and posts
  user/[userId]   # User profile
  session/        # Timed and manual reading session screens
  activity/       # Activity event detail
  search, add-book, discover, quick-log, notifications-inbox, ...

lib/              # Supabase query functions (auth, books, stats, activity, clubs, follows, ...)
components/       # Shared UI (StarRating, RatingModal, ...)
constants/        # Design tokens: fonts, spacing, radii, shadows, colors
types/            # Generated Supabase database types
modules/          # reading-live-activity native Expo module (iOS widget)
supabase/functions/ # Edge functions: book data enrichment, push notifications
__tests__/        # Unit and screen-level tests
```

## Getting Started

### Prerequisites
- Node.js 18+
- Expo CLI (`npm install -g expo`)
- A Supabase project with the schema applied

### Environment Variables

Create a `.env` file in the project root:

```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Install & Run

```bash
npm install

# Start the development server
npx expo start

# Run on iOS simulator
npx expo run:ios

# Run on Android emulator
npx expo run:android
```

### Tests

```bash
npx jest
```

## Architecture Notes

- **File-based routing** via Expo Router keeps screen navigation declarative and co-located with the UI code.
- **Typed Supabase client** — `types/database.ts` is generated from the database schema, so all query results are fully typed end-to-end.
- **Theme system** — `lib/theme.tsx` provides a React context with light/dark color tokens; `constants/theme.ts` holds static design tokens (fonts, spacing, radii, shadows). Every screen consumes `useTheme()` so the UI responds to system appearance changes.
- **Optimistic UI** — social actions (likes, follows) update local state immediately and reconcile with the server in the background.
- **Session storage** — auth tokens are stored in iOS/Android secure storage (not AsyncStorage) via `expo-secure-store`.
