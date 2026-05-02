# Stats + Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "Coming in Phase 3" placeholders on the Stats and Profile tabs with a full reading analytics screen (charts via `react-native-gifted-charts`) and a read-only profile screen with settings.

**Architecture:** Five tasks in dependency order — library setup first, then the two data libs, then the two screens. All new data functions follow the existing Supabase mock pattern in `__tests__/lib/`. Chart components are mocked via `moduleNameMapper` so tests never touch native SVG.

**Tech Stack:** Expo Router, React Native, Supabase, `react-native-gifted-charts`, `react-native-linear-gradient`, `react-native-svg` (already in Expo), `@expo/vector-icons`, `constants/theme.ts`.

---

## File Map

```
package.json                          MODIFY — add moduleNameMapper entries for chart libs
__mocks__/react-native-gifted-charts.js   CREATE — Jest mock returning plain Views
__mocks__/react-native-linear-gradient.js CREATE — Jest mock for peer dep
lib/stats.ts                          MODIFY — add 5 new exported functions + 3 interfaces
lib/profile.ts                        CREATE — getProfile, updateYearlyGoal, updatePrivacy
__tests__/lib/stats.test.ts           MODIFY — add .single() to mock, add 5 new describe blocks
__tests__/lib/profile.test.ts         CREATE — tests for profile lib functions
app/(tabs)/stats.tsx                  MODIFY — replace placeholder with full stats screen
app/(tabs)/profile.tsx                MODIFY — replace placeholder with full profile screen
__tests__/screens/stats.test.tsx      CREATE — stats screen render tests
__tests__/screens/profile.test.tsx    CREATE — profile screen render tests
```

---

## Task 1: Library Setup — Install + Mock Chart Dependencies

**Files:**
- Modify: `package.json` (jest config)
- Create: `__mocks__/react-native-gifted-charts.js`
- Create: `__mocks__/react-native-linear-gradient.js`

- [ ] **Step 1: Install the libraries**

```bash
npx expo install react-native-gifted-charts react-native-linear-gradient
```

Expected: both packages added to `node_modules` and `package.json` dependencies.

- [ ] **Step 2: Create the gifted-charts Jest mock**

Create `__mocks__/react-native-gifted-charts.js`:

```javascript
const React = require('react');
const { View } = require('react-native');

const LineChart = () => React.createElement(View, { testID: 'line-chart' });
const BarChart = () => React.createElement(View, { testID: 'bar-chart' });
const PieChart = () => React.createElement(View, { testID: 'pie-chart' });

module.exports = { LineChart, BarChart, PieChart };
```

- [ ] **Step 3: Create the linear-gradient Jest mock**

Create `__mocks__/react-native-linear-gradient.js`:

```javascript
const React = require('react');
const { View } = require('react-native');

const LinearGradient = ({ children, ...props }) =>
  React.createElement(View, props, children);

module.exports = { default: LinearGradient, LinearGradient };
```

- [ ] **Step 4: Register both mocks in jest config**

In `package.json`, update the `"jest"` block's `"moduleNameMapper"` to add two new entries:

```json
"moduleNameMapper": {
  "^react-native-safe-area-context$": "<rootDir>/__mocks__/react-native-safe-area-context.js",
  "^react-native-gifted-charts$": "<rootDir>/__mocks__/react-native-gifted-charts.js",
  "^react-native-linear-gradient$": "<rootDir>/__mocks__/react-native-linear-gradient.js"
}
```

- [ ] **Step 5: Verify existing tests still pass**

```bash
npx jest --no-coverage
```

Expected: same pass count as before (92 tests passing), no new failures.

- [ ] **Step 6: Commit**

```bash
git add package.json "__mocks__/react-native-gifted-charts.js" "__mocks__/react-native-linear-gradient.js"
git commit -m "chore: install react-native-gifted-charts and add Jest mocks"
```

---

## Task 2: New Stats Functions

**Files:**
- Modify: `lib/stats.ts`
- Modify: `__tests__/lib/stats.test.ts`

- [ ] **Step 1: Write the failing tests**

Open `__tests__/lib/stats.test.ts`. First, add `.single` to the existing `mockBuilder` inside `jest.mock` and to the `beforeEach` reset block:

```typescript
// Inside jest.mock factory, add to mockBuilder:
single: jest.fn(() => Promise.resolve(testState.builderResolve)),

// Inside beforeEach, add:
testState.mockBuilder.single.mockImplementation(() => Promise.resolve(testState.builderResolve));
```

Then add these five `describe` blocks at the end of the file (before the closing):

```typescript
import {
  getTodayStats, getStreak, estimateDaysRemaining,
  getReadingHistory, getMonthlyBooks, getGenreBreakdown,
  getWeeklyPace, getYearlyGoalProgress,
} from '@/lib/stats';

describe('getReadingHistory', () => {
  it('groups pages by date and fills missing days with 0', async () => {
    const today = new Date().toISOString().slice(0, 10);
    testState.builderResolve = {
      data: [
        { start_page: 0, end_page: 30, started_at: `${today}T10:00:00.000Z` },
        { start_page: 30, end_page: 50, started_at: `${today}T14:00:00.000Z` },
      ],
      error: null,
    };
    const result = await getReadingHistory('user-1', 3);
    expect(result).toHaveLength(3);
    const todayEntry = result.find(d => d.date === today);
    expect(todayEntry?.pages).toBe(50); // (30-0) + (50-30)
    // All entries have non-negative pages
    result.forEach(d => expect(d.pages).toBeGreaterThanOrEqual(0));
  });

  it('returns empty days with 0 pages when no sessions', async () => {
    testState.builderResolve = { data: [], error: null };
    const result = await getReadingHistory('user-1', 7);
    expect(result).toHaveLength(7);
    result.forEach(d => expect(d.pages).toBe(0));
  });
});

describe('getMonthlyBooks', () => {
  it('returns 12 months with correct counts', async () => {
    testState.builderResolve = {
      data: [
        { finished_at: '2026-01-15T00:00:00.000Z' },
        { finished_at: '2026-01-20T00:00:00.000Z' },
        { finished_at: '2026-03-05T00:00:00.000Z' },
      ],
      error: null,
    };
    const result = await getMonthlyBooks('user-1', 2026);
    expect(result).toHaveLength(12);
    expect(result[0]).toEqual({ month: 'Jan', count: 2 });
    expect(result[1]).toEqual({ month: 'Feb', count: 0 });
    expect(result[2]).toEqual({ month: 'Mar', count: 1 });
  });

  it('returns all zeros when no books finished', async () => {
    testState.builderResolve = { data: [], error: null };
    const result = await getMonthlyBooks('user-1', 2026);
    expect(result).toHaveLength(12);
    result.forEach(m => expect(m.count).toBe(0));
  });
});

describe('getGenreBreakdown', () => {
  it('flattens and counts genres, sorted by count descending', async () => {
    testState.builderResolve = {
      data: [
        { book: { genres: ['Fantasy', 'Adventure'] } },
        { book: { genres: ['Fantasy'] } },
        { book: { genres: null } },
      ],
      error: null,
    };
    const result = await getGenreBreakdown('user-1');
    expect(result[0]).toEqual({ genre: 'Fantasy', count: 2 });
    expect(result[1]).toEqual({ genre: 'Adventure', count: 1 });
  });

  it('returns empty array when no read books', async () => {
    testState.builderResolve = { data: [], error: null };
    const result = await getGenreBreakdown('user-1');
    expect(result).toEqual([]);
  });
});

describe('getWeeklyPace', () => {
  it('returns average pages per day over 7 days', async () => {
    // 70 pages total / 7 days = 10
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 3);
    testState.builderResolve = {
      data: [
        { start_page: 0, end_page: 40, started_at: d.toISOString() },
        { start_page: 0, end_page: 30, started_at: new Date().toISOString() },
      ],
      error: null,
    };
    const pace = await getWeeklyPace('user-1');
    expect(pace).toBe(10);
  });

  it('returns 0 when no sessions in last 7 days', async () => {
    testState.builderResolve = { data: [], error: null };
    const pace = await getWeeklyPace('user-1');
    expect(pace).toBe(0);
  });
});

describe('getYearlyGoalProgress', () => {
  it('returns books read this year and yearly goal from profile', async () => {
    const { supabase } = require('@/lib/supabase');
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'user_books') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lt: jest.fn().mockReturnThis(),
          then: (resolve: any) =>
            Promise.resolve({ data: [{ id: 'ub-1' }, { id: 'ub-2' }], error: null }).then(resolve),
        };
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: () => Promise.resolve({ data: { yearly_goal: 12 }, error: null }),
      };
    });
    const result = await getYearlyGoalProgress('user-1');
    expect(result.booksRead).toBe(2);
    expect(result.goal).toBe(12);
  });

  it('returns 0 for both when no data', async () => {
    const { supabase } = require('@/lib/supabase');
    (supabase.from as jest.Mock).mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      single: () => Promise.resolve({ data: { yearly_goal: 0 }, error: null }),
      then: (resolve: any) =>
        Promise.resolve({ data: [], error: null }).then(resolve),
    }));
    const result = await getYearlyGoalProgress('user-1');
    expect(result.booksRead).toBe(0);
    expect(result.goal).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest __tests__/lib/stats.test.ts --no-coverage
```

Expected: new tests FAIL — `getReadingHistory`, `getMonthlyBooks`, etc. not exported from `@/lib/stats`.

- [ ] **Step 3: Add new functions to `lib/stats.ts`**

Append to the end of `lib/stats.ts`:

```typescript
export interface DailyReading {
  date: string;
  pages: number;
}

export async function getReadingHistory(userId: string, days: number): Promise<DailyReading[]> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days + 1);
  since.setUTCHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('reading_sessions')
    .select('start_page, end_page, started_at')
    .eq('user_id', userId)
    .gte('started_at', since.toISOString())
    .order('started_at', { ascending: true });
  if (error) throw error;

  const map: Record<string, number> = {};
  for (const session of data ?? []) {
    const date = session.started_at.slice(0, 10);
    map[date] = (map[date] ?? 0) + (session.end_page - session.start_page);
  }

  const result: DailyReading[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setUTCDate(d.getUTCDate() + i);
    const date = d.toISOString().slice(0, 10);
    result.push({ date, pages: map[date] ?? 0 });
  }
  return result;
}

export interface MonthlyBooks {
  month: string;
  count: number;
}

export async function getMonthlyBooks(userId: string, year: number): Promise<MonthlyBooks[]> {
  const yearStart = `${year}-01-01T00:00:00.000Z`;
  const yearEnd = `${year + 1}-01-01T00:00:00.000Z`;

  const { data, error } = await supabase
    .from('user_books')
    .select('finished_at')
    .eq('user_id', userId)
    .eq('shelf', 'read')
    .gte('finished_at', yearStart)
    .lt('finished_at', yearEnd);
  if (error) throw error;

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const counts: number[] = new Array(12).fill(0);
  for (const row of data ?? []) {
    if (row.finished_at) {
      counts[new Date(row.finished_at).getUTCMonth()]++;
    }
  }
  return MONTHS.map((month, i) => ({ month, count: counts[i] }));
}

export interface GenreCount {
  genre: string;
  count: number;
}

export async function getGenreBreakdown(userId: string): Promise<GenreCount[]> {
  const { data, error } = await supabase
    .from('user_books')
    .select('book:books(genres)')
    .eq('user_id', userId)
    .eq('shelf', 'read');
  if (error) throw error;

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    for (const genre of (row.book as any)?.genres ?? []) {
      if (genre) counts[genre] = (counts[genre] ?? 0) + 1;
    }
  }
  return Object.entries(counts)
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count);
}

export async function getWeeklyPace(userId: string): Promise<number> {
  const history = await getReadingHistory(userId, 7);
  const total = history.reduce((sum, d) => sum + d.pages, 0);
  return Math.round(total / 7);
}

export interface YearlyGoalProgress {
  booksRead: number;
  goal: number;
}

export async function getYearlyGoalProgress(userId: string): Promise<YearlyGoalProgress> {
  const year = new Date().getFullYear();
  const yearStart = `${year}-01-01T00:00:00.000Z`;
  const yearEnd = `${year + 1}-01-01T00:00:00.000Z`;

  const { data: books, error: booksError } = await supabase
    .from('user_books')
    .select('id')
    .eq('user_id', userId)
    .eq('shelf', 'read')
    .gte('finished_at', yearStart)
    .lt('finished_at', yearEnd);
  if (booksError) throw booksError;

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('yearly_goal')
    .eq('id', userId)
    .single();
  if (profileError) throw profileError;

  return {
    booksRead: books?.length ?? 0,
    goal: profile?.yearly_goal ?? 0,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/lib/stats.test.ts --no-coverage
```

Expected: all tests PASS (existing + 9 new).

- [ ] **Step 5: Commit**

```bash
git add lib/stats.ts __tests__/lib/stats.test.ts
git commit -m "feat: add reading history, monthly books, genre breakdown, pace, yearly goal functions"
```

---

## Task 3: Profile Library

**Files:**
- Create: `lib/profile.ts`
- Create: `__tests__/lib/profile.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/profile.test.ts`:

```typescript
import { getProfile, updateYearlyGoal, updatePrivacy } from '@/lib/profile';

const testState = {
  builderResolve: { data: null as any, error: null as any },
  mockBuilder: null as any,
};

jest.mock('@/lib/supabase', () => {
  const mockBuilder = {
    select: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn(() => Promise.resolve(testState.builderResolve)),
    then: (resolve: any, reject: any) =>
      Promise.resolve(testState.builderResolve).then(resolve, reject),
  };
  testState.mockBuilder = mockBuilder;
  return { supabase: { from: jest.fn(() => mockBuilder) } };
});

beforeEach(() => {
  testState.builderResolve = { data: null, error: null };
  jest.clearAllMocks();
  if (testState.mockBuilder) {
    testState.mockBuilder.select.mockReturnThis();
    testState.mockBuilder.update.mockReturnThis();
    testState.mockBuilder.eq.mockReturnThis();
    testState.mockBuilder.maybeSingle.mockImplementation(() =>
      Promise.resolve(testState.builderResolve)
    );
    testState.mockBuilder.then.mockImplementation((resolve: any, reject: any) =>
      Promise.resolve(testState.builderResolve).then(resolve, reject)
    );
  }
});

describe('getProfile', () => {
  it('returns profile when found', async () => {
    testState.builderResolve = {
      data: {
        id: 'user-1',
        username: 'isabelle',
        bio: 'I love books',
        is_private: false,
        yearly_goal: 24,
      },
      error: null,
    };
    const profile = await getProfile('user-1');
    expect(profile?.username).toBe('isabelle');
    expect(profile?.yearly_goal).toBe(24);
    expect(profile?.is_private).toBe(false);
  });

  it('returns null when not found', async () => {
    testState.builderResolve = { data: null, error: null };
    const profile = await getProfile('user-1');
    expect(profile).toBeNull();
  });
});

describe('updateYearlyGoal', () => {
  it('calls supabase update with correct payload', async () => {
    testState.builderResolve = { data: null, error: null };
    await updateYearlyGoal('user-1', 20);
    expect(testState.mockBuilder.update).toHaveBeenCalledWith({ yearly_goal: 20 });
    expect(testState.mockBuilder.eq).toHaveBeenCalledWith('id', 'user-1');
  });
});

describe('updatePrivacy', () => {
  it('calls supabase update with is_private=true', async () => {
    testState.builderResolve = { data: null, error: null };
    await updatePrivacy('user-1', true);
    expect(testState.mockBuilder.update).toHaveBeenCalledWith({ is_private: true });
  });

  it('calls supabase update with is_private=false', async () => {
    testState.builderResolve = { data: null, error: null };
    await updatePrivacy('user-1', false);
    expect(testState.mockBuilder.update).toHaveBeenCalledWith({ is_private: false });
  });
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
npx jest __tests__/lib/profile.test.ts --no-coverage
```

Expected: FAIL — module `@/lib/profile` not found.

- [ ] **Step 3: Create `lib/profile.ts`**

```typescript
import { supabase } from './supabase';

export interface UserProfile {
  id: string;
  username: string;
  bio: string | null;
  is_private: boolean;
  yearly_goal: number;
}

export async function getProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, bio, is_private, yearly_goal')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data as UserProfile | null;
}

export async function updateYearlyGoal(userId: string, goal: number): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ yearly_goal: goal })
    .eq('id', userId);
  if (error) throw error;
}

export async function updatePrivacy(userId: string, isPrivate: boolean): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ is_private: isPrivate })
    .eq('id', userId);
  if (error) throw error;
}
```

- [ ] **Step 4: Run to verify they pass**

```bash
npx jest __tests__/lib/profile.test.ts --no-coverage
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/profile.ts __tests__/lib/profile.test.ts
git commit -m "feat: add profile lib (getProfile, updateYearlyGoal, updatePrivacy)"
```

---

## Task 4: Stats Screen

**Files:**
- Modify: `app/(tabs)/stats.tsx`
- Create: `__tests__/screens/stats.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/screens/stats.test.tsx`:

```typescript
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import StatsScreen from '@/app/(tabs)/stats';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(() => { cb(); }, []);
  },
}));

jest.mock('@/lib/auth', () => ({
  useAuth: jest.fn(() => ({ session: { user: { id: 'user-1' } } })),
}));

const EMPTY_MONTHLY = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  .map(month => ({ month, count: 0 }));

jest.mock('@/lib/stats', () => ({
  getStreak: jest.fn().mockResolvedValue(3),
  getWeeklyPace: jest.fn().mockResolvedValue(15),
  getYearlyGoalProgress: jest.fn().mockResolvedValue({ booksRead: 4, goal: 12 }),
  getReadingHistory: jest.fn().mockResolvedValue([]),
  getMonthlyBooks: jest.fn().mockResolvedValue(
    ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
      .map(month => ({ month, count: 0 }))
  ),
  getGenreBreakdown: jest.fn().mockResolvedValue([]),
}));

import { getYearlyGoalProgress, getMonthlyBooks, getGenreBreakdown } from '@/lib/stats';

beforeEach(() => {
  jest.clearAllMocks();
  (getYearlyGoalProgress as jest.Mock).mockResolvedValue({ booksRead: 4, goal: 12 });
  (getMonthlyBooks as jest.Mock).mockResolvedValue(EMPTY_MONTHLY);
  (getGenreBreakdown as jest.Mock).mockResolvedValue([]);
});

describe('StatsScreen', () => {
  it('renders section titles after loading', async () => {
    render(<StatsScreen />);
    await waitFor(() => {
      expect(screen.getByText('Last 30 Days')).toBeTruthy();
      expect(screen.getByText('Books Finished')).toBeTruthy();
      expect(screen.getByText('Genres')).toBeTruthy();
    });
  });

  it('shows yearly goal progress when goal > 0', async () => {
    render(<StatsScreen />);
    await waitFor(() => {
      expect(screen.getByText(/4 of 12 books/)).toBeTruthy();
    });
  });

  it('shows set goal prompt when goal is 0', async () => {
    (getYearlyGoalProgress as jest.Mock).mockResolvedValue({ booksRead: 0, goal: 0 });
    render(<StatsScreen />);
    await waitFor(() => {
      expect(screen.getByText('Set a goal in your Profile')).toBeTruthy();
    });
  });

  it('shows no books finished empty state', async () => {
    render(<StatsScreen />);
    await waitFor(() => {
      expect(screen.getByText('No books finished yet this year')).toBeTruthy();
    });
  });

  it('shows genre empty state when no genres', async () => {
    render(<StatsScreen />);
    await waitFor(() => {
      expect(screen.getByText('Finish books to see your genre breakdown')).toBeTruthy();
    });
  });

  it('renders chart placeholders when data is present', async () => {
    (getGenreBreakdown as jest.Mock).mockResolvedValue([
      { genre: 'Fantasy', count: 3 },
    ]);
    (getMonthlyBooks as jest.Mock).mockResolvedValue(
      EMPTY_MONTHLY.map((m, i) => i === 0 ? { ...m, count: 2 } : m)
    );
    render(<StatsScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('line-chart')).toBeTruthy();
      expect(screen.getByTestId('bar-chart')).toBeTruthy();
      expect(screen.getByTestId('pie-chart')).toBeTruthy();
    });
  });
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
npx jest __tests__/screens/stats.test.tsx --no-coverage
```

Expected: FAIL — `StatsScreen` is a placeholder, doesn't have the right content.

- [ ] **Step 3: Implement `app/(tabs)/stats.tsx`**

Replace the entire file:

```typescript
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LineChart, BarChart, PieChart } from 'react-native-gifted-charts';
import { useAuth } from '@/lib/auth';
import {
  getStreak,
  getWeeklyPace,
  getYearlyGoalProgress,
  getReadingHistory,
  getMonthlyBooks,
  getGenreBreakdown,
  type DailyReading,
  type MonthlyBooks,
  type GenreCount,
  type YearlyGoalProgress,
} from '@/lib/stats';
import { Colors, Spacing, Radius, Shadow } from '@/constants/theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - 2 * Spacing.lg - 32;
const PIE_COLORS = ['#7C6FCD', '#A599E9', '#5B4FB0', '#C4BCF0', '#3D3580', '#E8E4FA'];

export default function StatsScreen() {
  const { session } = useAuth();
  const userId = session?.user.id ?? '';

  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const [pace, setPace] = useState(0);
  const [yearlyGoal, setYearlyGoal] = useState<YearlyGoalProgress>({ booksRead: 0, goal: 0 });
  const [history, setHistory] = useState<DailyReading[]>([]);
  const [monthly, setMonthly] = useState<MonthlyBooks[]>([]);
  const [genres, setGenres] = useState<GenreCount[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      setLoading(true);
      Promise.all([
        getStreak(userId),
        getWeeklyPace(userId),
        getYearlyGoalProgress(userId),
        getReadingHistory(userId, 30),
        getMonthlyBooks(userId, new Date().getFullYear()),
        getGenreBreakdown(userId),
      ])
        .then(([s, p, yg, h, m, g]) => {
          setStreak(s);
          setPace(p);
          setYearlyGoal(yg);
          setHistory(h);
          setMonthly(m);
          setGenres(g);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }, [userId])
  );

  if (!session) return null;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  const lineData = history.map(d => ({
    value: d.pages,
    label: d.date.slice(5).replace('-', '/'),
  }));

  const barData = monthly.map(m => ({
    value: m.count,
    label: m.month,
    frontColor: Colors.primary,
  }));

  const topGenres = genres.slice(0, 6);
  const pieData = topGenres.map((g, i) => ({
    value: g.count,
    color: PIE_COLORS[i],
    text: g.genre,
  }));

  const hasBarData = monthly.some(m => m.count > 0);
  const hasPieData = topGenres.length > 0;
  const goalPct = yearlyGoal.goal > 0
    ? Math.min(1, yearlyGoal.booksRead / yearlyGoal.goal)
    : 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Stats</Text>

        {/* Streak + pace row */}
        <View style={styles.row}>
          <View style={styles.statCard}>
            <Ionicons name="flame" size={20} color={Colors.orange} />
            <Text style={styles.statValue}>{streak}</Text>
            <Text style={styles.statLabel}>Day streak</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="book-outline" size={20} color={Colors.primary} />
            <Text style={styles.statValue}>{pace}</Text>
            <Text style={styles.statLabel}>Pages/day avg</Text>
          </View>
        </View>

        {/* Yearly goal */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{new Date().getFullYear()} Reading Goal</Text>
          {yearlyGoal.goal === 0 ? (
            <Text style={styles.emptyText}>Set a goal in your Profile</Text>
          ) : (
            <>
              <Text style={styles.goalText}>
                {yearlyGoal.booksRead} of {yearlyGoal.goal} books
              </Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.round(goalPct * 100)}%` }]} />
              </View>
            </>
          )}
        </View>

        {/* Reading history line chart */}
        <Text style={styles.sectionTitle}>Last 30 Days</Text>
        <View style={styles.card}>
          {history.every(d => d.pages === 0) ? (
            <Text style={styles.emptyText}>Start a reading session to see your history</Text>
          ) : (
            <LineChart
              data={lineData}
              width={CHART_WIDTH}
              height={180}
              color={Colors.primary}
              dataPointsColor={Colors.primary}
              spacing={Math.floor(CHART_WIDTH / 32)}
              initialSpacing={0}
              noOfSections={4}
              xAxisThickness={0}
              yAxisThickness={0}
              hideDataPoints={false}
              yAxisTextStyle={styles.axisLabel}
              xAxisLabelTextStyle={styles.axisLabel}
            />
          )}
        </View>

        {/* Books finished bar chart */}
        <Text style={styles.sectionTitle}>Books Finished</Text>
        <View style={styles.card}>
          {!hasBarData ? (
            <Text style={styles.emptyText}>No books finished yet this year</Text>
          ) : (
            <BarChart
              data={barData}
              width={CHART_WIDTH}
              height={160}
              barWidth={20}
              spacing={8}
              roundedTop
              noOfSections={3}
              xAxisThickness={0}
              yAxisThickness={0}
              yAxisTextStyle={styles.axisLabel}
              xAxisLabelTextStyle={styles.axisLabel}
            />
          )}
        </View>

        {/* Genre breakdown pie chart */}
        <Text style={styles.sectionTitle}>Genres</Text>
        <View style={styles.card}>
          {!hasPieData ? (
            <Text style={styles.emptyText}>Finish books to see your genre breakdown</Text>
          ) : (
            <>
              <PieChart
                data={pieData}
                donut
                radius={80}
                innerRadius={50}
              />
              <View style={styles.legend}>
                {topGenres.map((g, i) => (
                  <View key={g.genre} style={styles.legendRow}>
                    <View style={[styles.legendDot, { backgroundColor: PIE_COLORS[i] }]} />
                    <Text style={styles.legendText}>{g.genre} ({g.count})</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: Spacing.lg, gap: Spacing.lg },
  title: { fontSize: 32, fontWeight: '700', color: Colors.primary },

  row: { flexDirection: 'row', gap: Spacing.sm },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 6,
    ...Shadow.card,
  },
  statValue: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary },
  statLabel: { fontSize: 12, color: Colors.textSecondary },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    ...Shadow.card,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  goalText: { fontSize: 14, color: Colors.textSecondary, marginBottom: 8 },
  progressTrack: {
    height: 8,
    backgroundColor: Colors.progressTrack,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: { height: 8, backgroundColor: Colors.primary, borderRadius: 4 },

  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  emptyText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', paddingVertical: 12 },
  axisLabel: { color: Colors.textTertiary, fontSize: 9 },

  legend: { marginTop: Spacing.md, gap: 6 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 13, color: Colors.textSecondary },
});
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/screens/stats.test.tsx --no-coverage
```

Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add "app/(tabs)/stats.tsx" __tests__/screens/stats.test.tsx
git commit -m "feat: stats screen with charts (streak, pace, yearly goal, history, genres)"
```

---

## Task 5: Profile Screen

**Files:**
- Modify: `app/(tabs)/profile.tsx`
- Create: `__tests__/screens/profile.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/screens/profile.test.tsx`:

```typescript
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import ProfileScreen from '@/app/(tabs)/profile';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(() => { cb(); }, []);
  },
}));

const mockSignOut = jest.fn();
jest.mock('@/lib/auth', () => ({
  useAuth: jest.fn(() => ({
    session: { user: { id: 'user-1' } },
    signOut: mockSignOut,
  })),
}));

jest.mock('@/lib/stats', () => ({
  getStreak: jest.fn().mockResolvedValue(5),
  getYearlyGoalProgress: jest.fn().mockResolvedValue({ booksRead: 3, goal: 12 }),
  getReadingHistory: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/lib/profile', () => ({
  getProfile: jest.fn().mockResolvedValue({
    id: 'user-1',
    username: 'isabelle',
    bio: 'I love books',
    is_private: false,
    yearly_goal: 12,
  }),
  updateYearlyGoal: jest.fn().mockResolvedValue(undefined),
  updatePrivacy: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/userBooks', () => ({
  getShelf: jest.fn().mockResolvedValue([]),
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

import { updatePrivacy } from '@/lib/profile';

beforeEach(() => {
  jest.clearAllMocks();
  mockSignOut.mockResolvedValue(undefined);
});

describe('ProfileScreen', () => {
  it('renders username and initials', async () => {
    render(<ProfileScreen />);
    await waitFor(() => {
      expect(screen.getByText('isabelle')).toBeTruthy();
      expect(screen.getByText('I')).toBeTruthy(); // initial
    });
  });

  it('renders bio when present', async () => {
    render(<ProfileScreen />);
    await waitFor(() => {
      expect(screen.getByText('I love books')).toBeTruthy();
    });
  });

  it('shows streak in stats summary', async () => {
    render(<ProfileScreen />);
    await waitFor(() => {
      expect(screen.getByText('5')).toBeTruthy();
    });
  });

  it('shows yearly goal progress', async () => {
    render(<ProfileScreen />);
    await waitFor(() => {
      expect(screen.getByText(/3 of 12 books/)).toBeTruthy();
    });
  });

  it('shows Sign Out button and calls signOut on press', async () => {
    render(<ProfileScreen />);
    await waitFor(() => screen.getByText('Sign Out'));
    fireEvent.press(screen.getByText('Sign Out'));
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('privacy switch reflects is_private=false (switch ON = public)', async () => {
    render(<ProfileScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('privacy-switch')).toBeTruthy();
    });
  });

  it('toggling privacy switch calls updatePrivacy', async () => {
    render(<ProfileScreen />);
    await waitFor(() => screen.getByTestId('privacy-switch'));
    fireEvent(screen.getByTestId('privacy-switch'), 'valueChange', false);
    await waitFor(() => {
      expect(updatePrivacy).toHaveBeenCalledWith('user-1', true);
    });
  });
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
npx jest __tests__/screens/profile.test.tsx --no-coverage
```

Expected: FAIL — `ProfileScreen` is a placeholder without the expected content.

- [ ] **Step 3: Implement `app/(tabs)/profile.tsx`**

Replace the entire file:

```typescript
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { getShelf, type UserBookWithBook } from '@/lib/userBooks';
import {
  getStreak,
  getYearlyGoalProgress,
  getReadingHistory,
  type YearlyGoalProgress,
} from '@/lib/stats';
import {
  getProfile,
  updateYearlyGoal,
  updatePrivacy,
  type UserProfile,
} from '@/lib/profile';
import { Colors, Spacing, Radius, Shadow } from '@/constants/theme';

export default function ProfileScreen() {
  const { session, signOut } = useAuth();
  const router = useRouter();
  const userId = session?.user.id ?? '';

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [streak, setStreak] = useState(0);
  const [yearlyGoal, setYearlyGoal] = useState<YearlyGoalProgress>({ booksRead: 0, goal: 0 });
  const [pagesThisYear, setPagesThisYear] = useState(0);
  const [shelfCounts, setShelfCounts] = useState({ reading: 0, want: 0, read: 0, dnf: 0 });

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      setLoading(true);
      Promise.all([
        getProfile(userId),
        getStreak(userId),
        getYearlyGoalProgress(userId),
        getReadingHistory(userId, 365),
        getShelf(userId, 'reading'),
        getShelf(userId, 'want'),
        getShelf(userId, 'read'),
        getShelf(userId, 'dnf'),
      ])
        .then(([p, s, yg, history, reading, want, read, dnf]) => {
          setProfile(p);
          setStreak(s);
          setYearlyGoal(yg);
          setPagesThisYear(history.reduce((sum, d) => sum + d.pages, 0));
          setShelfCounts({
            reading: reading.length,
            want: want.length,
            read: read.length,
            dnf: dnf.length,
          });
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }, [userId])
  );

  if (!session) return null;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  const initial = profile?.username.charAt(0).toUpperCase() ?? '?';
  const goalPct = yearlyGoal.goal > 0
    ? Math.min(1, yearlyGoal.booksRead / yearlyGoal.goal)
    : 0;

  const handleSetGoal = () => {
    Alert.prompt(
      'Set Reading Goal',
      `How many books do you want to read in ${new Date().getFullYear()}?`,
      async (value) => {
        const n = parseInt(value, 10);
        if (!isNaN(n) && n > 0) {
          await updateYearlyGoal(userId, n);
          setYearlyGoal({ ...yearlyGoal, goal: n });
        }
      },
      'plain-text',
      String(yearlyGoal.goal || ''),
      'number-pad'
    );
  };

  const handlePrivacyToggle = async (isPublic: boolean) => {
    const isPrivate = !isPublic;
    setProfile(prev => prev ? { ...prev, is_private: isPrivate } : prev);
    await updatePrivacy(userId, isPrivate);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* User header */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.initial}>{initial}</Text>
          </View>
          <Text style={styles.username}>{profile?.username ?? ''}</Text>
          {profile?.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
        </View>

        {/* Stats summary */}
        <View style={styles.row}>
          <View style={styles.statCard}>
            <Ionicons name="book" size={18} color={Colors.primary} />
            <Text style={styles.statValue}>{shelfCounts.read}</Text>
            <Text style={styles.statLabel}>Books Read</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="flame" size={18} color={Colors.orange} />
            <Text style={styles.statValue}>{streak}</Text>
            <Text style={styles.statLabel}>Streak</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="document-text-outline" size={18} color={Colors.primary} />
            <Text style={styles.statValue}>{pagesThisYear}</Text>
            <Text style={styles.statLabel}>Pages This Year</Text>
          </View>
        </View>

        {/* Yearly goal */}
        <TouchableOpacity style={styles.card} onPress={handleSetGoal}>
          <Text style={styles.cardTitle}>{new Date().getFullYear()} Reading Goal</Text>
          {yearlyGoal.goal === 0 ? (
            <Text style={styles.goalEmpty}>Tap to set a goal</Text>
          ) : (
            <>
              <Text style={styles.goalText}>
                {yearlyGoal.booksRead} of {yearlyGoal.goal} books
              </Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.round(goalPct * 100)}%` }]} />
              </View>
            </>
          )}
        </TouchableOpacity>

        {/* Shelf counts */}
        <View style={styles.pillRow}>
          {[
            { label: 'Reading', count: shelfCounts.reading, shelf: 'reading' },
            { label: 'Want', count: shelfCounts.want, shelf: 'want' },
            { label: 'Read', count: shelfCounts.read, shelf: 'read' },
            { label: 'DNF', count: shelfCounts.dnf, shelf: 'dnf' },
          ].map(({ label, count }) => (
            <TouchableOpacity
              key={label}
              style={styles.pill}
              onPress={() => router.push('/(tabs)/library')}
            >
              <Text style={styles.pillText}>{label} · {count}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Settings */}
        <Text style={styles.sectionTitle}>Settings</Text>
        <View style={styles.settingsCard}>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Public profile</Text>
            <Switch
              testID="privacy-switch"
              value={!(profile?.is_private ?? false)}
              onValueChange={handlePrivacyToggle}
              trackColor={{ true: Colors.primary, false: Colors.border }}
              thumbColor={Colors.surface}
            />
          </View>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.settingRow} onPress={signOut}>
            <Text style={styles.signOut}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: Spacing.lg, gap: Spacing.lg },

  header: { alignItems: 'center', gap: 8 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initial: { fontSize: 32, fontWeight: '700', color: Colors.surface },
  username: { fontSize: 24, fontWeight: '700', color: Colors.textPrimary },
  bio: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },

  row: { flexDirection: 'row', gap: Spacing.sm },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 4,
    ...Shadow.card,
  },
  statValue: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary },
  statLabel: { fontSize: 11, color: Colors.textSecondary, textAlign: 'center' },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: 8,
    ...Shadow.card,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  goalText: { fontSize: 14, color: Colors.textSecondary },
  goalEmpty: { fontSize: 14, color: Colors.textTertiary },
  progressTrack: {
    height: 8,
    backgroundColor: Colors.progressTrack,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: { height: 8, backgroundColor: Colors.primary, borderRadius: 4 },

  pillRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  pill: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: Radius.xl,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.surface,
  },
  pillText: { color: Colors.primary, fontSize: 13, fontWeight: '600' },

  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  settingsCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    ...Shadow.card,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
  },
  settingLabel: { fontSize: 15, color: Colors.textPrimary },
  divider: { height: 1, backgroundColor: Colors.border },
  signOut: { fontSize: 15, color: Colors.error, fontWeight: '600' },
});
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/screens/profile.test.tsx --no-coverage
```

Expected: all 7 tests PASS.

- [ ] **Step 5: Run full test suite**

```bash
npx jest --no-coverage
```

Expected: all tests PASS (92 existing + ~21 new = ~113 total).

- [ ] **Step 6: Commit**

```bash
git add "app/(tabs)/profile.tsx" __tests__/screens/profile.test.tsx
git commit -m "feat: profile screen with stats summary, yearly goal, shelf counts, settings"
```

---

## Self-Review

**Spec coverage:**
- ✅ `react-native-gifted-charts` installed + mocked (Task 1)
- ✅ `getReadingHistory`, `getMonthlyBooks`, `getGenreBreakdown`, `getWeeklyPace`, `getYearlyGoalProgress` (Task 2)
- ✅ `getProfile`, `updateYearlyGoal`, `updatePrivacy` (Task 3)
- ✅ Streak + pace row, yearly goal card, line chart (30-day history), bar chart (monthly books), pie chart + legend (genres) (Task 4)
- ✅ Empty states for goal=0, no monthly books, no genres (Task 4)
- ✅ User header with initials avatar + username + bio (Task 5)
- ✅ Stats summary: books read, streak, pages this year (Task 5)
- ✅ Yearly goal progress bar + tap-to-edit with `Alert.prompt` (Task 5)
- ✅ Shelf count pills navigating to Library tab (Task 5)
- ✅ Privacy toggle (`Switch`) calling `updatePrivacy` (Task 5)
- ✅ Sign Out button (Task 5)

**Type consistency:**
- `YearlyGoalProgress { booksRead, goal }` defined in Task 2, imported in Tasks 4 and 5 ✓
- `DailyReading`, `MonthlyBooks`, `GenreCount` defined in Task 2, imported in Task 4 ✓
- `UserProfile` defined in Task 3, imported in Task 5 ✓
- `getProfile`, `updateYearlyGoal`, `updatePrivacy` defined in Task 3, imported and mocked in Task 5 ✓

**No placeholders found.**
