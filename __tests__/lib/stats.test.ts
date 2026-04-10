import { getTodayStats, getStreak, estimateDaysRemaining } from '@/lib/stats';

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
