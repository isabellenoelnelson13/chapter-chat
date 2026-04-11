import {
  getTodayStats, getStreak, estimateDaysRemaining,
  getReadingHistory, getMonthlyBooks, getGenreBreakdown,
  getWeeklyPace, getYearlyGoalProgress,
} from '@/lib/stats';

// Track state in a module-scoped object to avoid closure issues
const testState = {
  builderResolve: { data: null as any, error: null as any },
  mockBuilder: null as any,
};

jest.mock('@/lib/supabase', () => {
  const mockBuilder = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    single: jest.fn(() => Promise.resolve(testState.builderResolve)),
    then: jest.fn((resolve: any, reject: any) =>
      Promise.resolve(testState.builderResolve).then(resolve, reject)
    ),
  };
  testState.mockBuilder = mockBuilder;
  return {
    supabase: { from: jest.fn(() => mockBuilder) },
  };
});

beforeEach(() => {
  testState.builderResolve = { data: null, error: null };
  jest.clearAllMocks();
  if (testState.mockBuilder) {
    testState.mockBuilder.select.mockReturnThis();
    testState.mockBuilder.eq.mockReturnThis();
    testState.mockBuilder.order.mockReturnThis();
    testState.mockBuilder.gte.mockReturnThis();
    testState.mockBuilder.lt.mockReturnThis();
    testState.mockBuilder.then.mockImplementation((resolve: any, reject: any) =>
      Promise.resolve(testState.builderResolve).then(resolve, reject)
    );
    testState.mockBuilder.single.mockImplementation(() => Promise.resolve(testState.builderResolve));
  }
});

describe('getTodayStats', () => {
  it('sums pages and time from today sessions', async () => {
    testState.builderResolve = {
      data: [
        { start_page: 0, end_page: 30, duration_seconds: 1200, started_at: new Date().toISOString() },
        { start_page: 30, end_page: 60, duration_seconds: 1800, started_at: new Date().toISOString() },
      ],
      error: null,
    };
    const stats = await getTodayStats('user-1');
    expect(stats.pagesRead).toBe(60);
    expect(stats.timeSeconds).toBe(3000);
    expect(stats.streak).toBeGreaterThanOrEqual(0);
  });

  it('returns zeros when no sessions today', async () => {
    // First call (today sessions): empty. Second call (all sessions for streak): empty.
    testState.mockBuilder.then.mockImplementation((resolve: any, reject: any) => {
      return Promise.resolve({ data: [], error: null }).then(resolve, reject);
    });
    const stats = await getTodayStats('user-1');
    expect(stats.pagesRead).toBe(0);
    expect(stats.timeSeconds).toBe(0);
    expect(stats.streak).toBe(0);
  });
});

describe('getStreak', () => {
  it('returns 0 when there are no sessions', async () => {
    testState.builderResolve = { data: [], error: null };
    const streak = await getStreak('user-1');
    expect(streak).toBe(0);
  });

  it('returns 1 for a session only today', async () => {
    const today = new Date().toISOString();
    testState.builderResolve = { data: [{ started_at: today }], error: null };
    const streak = await getStreak('user-1');
    expect(streak).toBe(1);
  });

  it('counts consecutive days', async () => {
    const days = [0, 1, 2].map(offset => {
      const d = new Date();
      d.setDate(d.getDate() - offset);
      return { started_at: d.toISOString() };
    });
    testState.builderResolve = { data: days, error: null };
    const streak = await getStreak('user-1');
    expect(streak).toBe(3);
  });

  it('stops at a gap', async () => {
    const days = [0, 1, 3].map(offset => { // gap at day 2
      const d = new Date();
      d.setDate(d.getDate() - offset);
      return { started_at: d.toISOString() };
    });
    testState.builderResolve = { data: days, error: null };
    const streak = await getStreak('user-1');
    expect(streak).toBe(2);
  });
});

describe('estimateDaysRemaining', () => {
  it('returns null when pagesPerDay is 0', () => {
    expect(estimateDaysRemaining(0, 50, 300)).toBeNull();
  });

  it('returns 0 when already at or past the end', () => {
    expect(estimateDaysRemaining(10, 300, 300)).toBe(0);
  });

  it('calculates remaining days correctly', () => {
    // 300 - 100 = 200 pages remaining, 20 pages/day = 10 days
    expect(estimateDaysRemaining(20, 100, 300)).toBe(10);
  });

  it('rounds up partial days', () => {
    // 300 - 100 = 200 pages remaining, 30 pages/day = 6.67 → ceil → 7
    expect(estimateDaysRemaining(30, 100, 300)).toBe(7);
  });
});

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
