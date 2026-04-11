# Stats Screen + Profile Screen Design Spec

**Date:** 2026-04-10
**Status:** Approved

---

## Overview

Two connected screens that replace the current "Coming in Phase 3" placeholders:

1. **Stats screen** — full reading analytics with charts (streak, pace, yearly goal, reading history, books by month, genre breakdown).
2. **Profile screen** — read-only user header, stats summary, shelf counts, yearly goal control, and settings.

---

## Architecture

No new navigation. Both screens are existing tabs (`app/(tabs)/stats.tsx`, `app/(tabs)/profile.tsx`). Data is fetched on focus via `useFocusEffect`. New library: `react-native-gifted-charts` (uses `react-native-svg`, already in Expo).

**Tech Stack:** Expo Router, React Native, Supabase, `react-native-gifted-charts`, `@expo/vector-icons` (Ionicons), `constants/theme.ts` tokens.

**Installation:** `npx expo install react-native-gifted-charts react-native-linear-gradient` (`react-native-svg` is already in Expo). `react-native-linear-gradient` is a required peer dependency of `react-native-gifted-charts`.

**Test mocking:** `react-native-gifted-charts` uses native SVG rendering and must be mocked in Jest. Add a manual mock at `__mocks__/react-native-gifted-charts.tsx` that returns simple `View` components so chart tests don't crash on SVG.

---

## Section 1: Data Layer

### `lib/stats.ts` — new functions

```typescript
// 30-day reading history for line chart
export interface DailyReading { date: string; pages: number; }
export async function getReadingHistory(userId: string, days: number): Promise<DailyReading[]>

// Books finished per month for bar chart
export interface MonthlyBooks { month: string; count: number; } // month = "Jan", "Feb", etc.
export async function getMonthlyBooks(userId: string, year: number): Promise<MonthlyBooks[]>

// Genre breakdown from Read shelf for pie chart
export interface GenreCount { genre: string; count: number; }
export async function getGenreBreakdown(userId: string): Promise<GenreCount[]>

// 7-day rolling average pages per day
export async function getWeeklyPace(userId: string): Promise<number>

// Yearly goal progress
export interface YearlyGoalProgress { booksRead: number; goal: number; }
export async function getYearlyGoalProgress(userId: string): Promise<YearlyGoalProgress>
```

**Implementation notes:**

- `getReadingHistory`: query `reading_sessions` for last `days` days, group by `started_at.slice(0,10)`, sum `(end_page - start_page)`. Fill missing days with 0.
- `getMonthlyBooks`: query `user_books` where `shelf='read'` and `finished_at` is in the given year, group by month index of `finished_at`. Return all 12 months, missing months as 0.
- `getGenreBreakdown`: query `user_books` join `books` where `shelf='read'`, collect `book.genres` arrays, flatten and count occurrences per genre string. Exclude nulls.
- `getWeeklyPace`: call `getReadingHistory(userId, 7)`, average the pages values.
- `getYearlyGoalProgress`: fetch `profiles.yearly_goal` for userId + count `user_books` where `shelf='read'` and `finished_at` is in current year.

### `lib/profile.ts` — new file

```typescript
export interface UserProfile {
  id: string;
  username: string;
  bio: string | null;
  is_private: boolean;
  yearly_goal: number;
}

export async function getProfile(userId: string): Promise<UserProfile | null>
export async function updateYearlyGoal(userId: string, goal: number): Promise<void>
export async function updatePrivacy(userId: string, isPrivate: boolean): Promise<void>
```

**Implementation notes:**

- `getProfile`: select from `profiles` where `id = userId`.
- `updateYearlyGoal`: update `profiles` set `yearly_goal = goal` where `id = userId`.
- `updatePrivacy`: update `profiles` set `is_private = isPrivate` where `id = userId`.

### Shelf counts (for Profile screen)

Fetched via the existing `getShelf` called four times in parallel (`Promise.all`), counting results — no new function needed.

---

## Section 2: Stats Screen (`app/(tabs)/stats.tsx`)

### Data fetch

All data loaded together on `useFocusEffect`:

```typescript
Promise.all([
  getStreak(userId),
  getWeeklyPace(userId),
  getYearlyGoalProgress(userId),
  getReadingHistory(userId, 30),
  getMonthlyBooks(userId, new Date().getFullYear()),
  getGenreBreakdown(userId),
])
```

Single loading spinner while resolving. No per-section loading states.

### Layout (top to bottom, inside a `ScrollView`)

**1. Streak + pace row**
Two stat cards side by side (same style as Home screen stats row):
- Left: flame icon + streak number + "Day streak" label
- Right: book-outline icon + weekly pace (e.g. "24") + "Pages/day avg" label

**2. Yearly goal**
Card with "2026 Reading Goal" header, "X of Y books" text, and a horizontal progress bar (filled portion = `booksRead / goal`, clamped to 100%). If `goal === 0`, shows "Set a goal in your Profile" instead of the bar.

**3. Reading history (line chart)**
Section title: "Last 30 Days". `LineChart` from `react-native-gifted-charts`:
- Data: 30 `DailyReading` entries
- Color: `Colors.primary`
- `hideDataPoints`: false
- X-axis: show every 7th date label
- Y-axis: pages
- Empty state (all zeros): "Start a reading session to see your history"

**4. Books finished this year (bar chart)**
Section title: "Books Finished". `BarChart` from `react-native-gifted-charts`:
- Data: 12 `MonthlyBooks` entries (Jan–Dec)
- Bar color: `Colors.primary`
- X-axis: month abbreviations
- Y-axis: count (integer)
- Empty state: "No books finished yet this year"

**5. Genre breakdown (pie chart)**
Section title: "Genres". `PieChart` from `react-native-gifted-charts`:
- Data: top 6 genres (sort by count desc, cap at 6 to keep the chart readable)
- Colors: array of 6 palette colors derived from `Colors.primary` (use fixed palette)
- Legend below the chart: genre name + count
- Empty state: "Finish books to see your genre breakdown"

### Pie chart color palette

```typescript
const PIE_COLORS = ['#7C6FCD', '#A599E9', '#5B4FB0', '#C4BCF0', '#3D3580', '#E8E4FA'];
```

---

## Section 3: Profile Screen (`app/(tabs)/profile.tsx`)

### Data fetch

On `useFocusEffect`, fetch in parallel:

```typescript
Promise.all([
  getProfile(userId),
  getStreak(userId),
  getYearlyGoalProgress(userId),
  getShelf(userId, 'reading'),
  getShelf(userId, 'want'),
  getShelf(userId, 'read'),
  getShelf(userId, 'dnf'),
])
```

Single loading spinner while resolving.

### Layout (top to bottom, inside a `ScrollView`)

**1. User header**
Centered column:
- Large circle (80×80, `Colors.primary` background): first character of username, white, 32px bold
- Username below (24px bold, `Colors.textPrimary`)
- Bio below (14px, `Colors.textSecondary`), hidden if null

**2. Stats summary row**
Three stat cards (same style as Home):
- Books Read: count of Read shelf (all time)
- Streak: from `getStreak`
- Pages This Year: sum of pages from `getReadingHistory(userId, 365)`

**3. Yearly goal**
Same progress bar card as Stats screen. "X of Y books in 2026". Tapping the card opens `Alert.prompt` (iOS) to enter a new goal number. Calls `updateYearlyGoal` on confirm.

**4. Shelf counts**
Four pills in a row: "Reading · N", "Want · N", "Read · N", "DNF · N". Tapping a pill calls `router.push('/(tabs)/library')` — the Library tab opens on its default shelf (Reading). Pills use `Colors.primary` border, text `Colors.primary`, background `Colors.surface`.

**5. Settings**
Section title: "Settings". Two rows in a card:
- **Privacy row:** "Public profile" label on left, `Switch` on right. Calls `updatePrivacy` on toggle. Reflects current `is_private` value (inverted: switch ON = public).
- **Sign Out row:** Red "Sign Out" text, calls `signOut` from `useAuth`. Separated by a divider line.

### Yearly goal prompt

```typescript
Alert.prompt(
  'Set Reading Goal',
  'How many books do you want to read in 2026?',
  async (value) => {
    const n = parseInt(value, 10);
    if (!isNaN(n) && n > 0) await updateYearlyGoal(userId, n);
  },
  'plain-text',
  String(profile.yearly_goal || ''),
  'number-pad'
);
```

---

## File Map

```
lib/stats.ts                    MODIFY — add 5 new functions
lib/profile.ts                  CREATE — getProfile, updateYearlyGoal, updatePrivacy
app/(tabs)/stats.tsx            MODIFY — replace placeholder with full stats screen
app/(tabs)/profile.tsx          MODIFY — replace placeholder with full profile screen
__tests__/lib/stats.test.ts     CREATE — tests for new stat functions
__tests__/lib/profile.test.ts   CREATE — tests for profile functions
__tests__/screens/stats.test.tsx    CREATE — stats screen render tests
__tests__/screens/profile.test.tsx  CREATE — profile screen render tests
```

---

## Testing

### `__tests__/lib/stats.test.ts`
- `getReadingHistory`: returns array with correct pages per date; fills missing days with 0
- `getMonthlyBooks`: returns 12 entries; counts books with `finished_at` in correct month
- `getGenreBreakdown`: flattens genres from multiple books; counts correctly; ignores null genres
- `getWeeklyPace`: returns average of last 7 days of reading history
- `getYearlyGoalProgress`: returns correct `booksRead` for current year and `goal` from profile

### `__tests__/lib/profile.test.ts`
- `getProfile`: returns null on no match; returns profile row on match
- `updateYearlyGoal`: calls Supabase update with correct payload
- `updatePrivacy`: calls Supabase update with correct payload

### `__tests__/screens/stats.test.tsx`
- Renders loading spinner then all section titles
- Shows "Set a goal in your Profile" when goal is 0
- Shows "No books finished yet this year" when monthly data is all zeros
- Shows "Finish books to see your genre breakdown" when no genres

### `__tests__/screens/profile.test.tsx`
- Renders username and initials
- Shows streak and books read in stats summary
- Shows "Sign Out" button and calls signOut on press
- Privacy switch reflects `is_private` value

---

## Out of Scope

- Avatar photo upload
- Bio / username editing
- Navigating Library tab to a specific shelf from shelf count pills (opens Library at default shelf)
- Stats for time ranges other than the fixed windows (30 days history, current year)
- Sharing stats
