import { getTrending, getRecommended } from '@/lib/discover';
import { type BookSearchResult } from '@/lib/books';

// ── Supabase mock ──────────────────────────────────────────────────────────────
const testState = {
  builderResolve: { data: null as any, error: null },
  mockBuilder: null as any,
};

jest.mock('@/lib/supabase', () => {
  const mockBuilder: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    then: (_resolve: any, _reject: any) =>
      Promise.resolve(testState.builderResolve).then(_resolve, _reject),
  };
  testState.mockBuilder = mockBuilder;
  return {
    supabase: { from: jest.fn(() => mockBuilder) },
  };
});

beforeEach(() => {
  testState.builderResolve = { data: [], error: null };
  jest.clearAllMocks();
  if (testState.mockBuilder) {
    testState.mockBuilder.select.mockReturnThis();
    testState.mockBuilder.eq.mockReturnThis();
    testState.mockBuilder.in.mockReturnThis();
  }
  global.fetch = jest.fn();
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
});

const fakeBook: BookSearchResult = {
  hardcover_id: '1',
  title: 'Dune',
  author: 'Frank Herbert',
  cover_url: null,
  page_count: 412,
  genres: ['Sci-Fi'],
  description: null,
  rating: 4.7,
  users_read_count: 200000,
};

const fakeBook2: BookSearchResult = {
  hardcover_id: '2',
  title: 'Foundation',
  author: 'Isaac Asimov',
  cover_url: null,
  page_count: 244,
  genres: ['Sci-Fi'],
  description: null,
  rating: 4.6,
  users_read_count: 180000,
};

describe('getTrending', () => {
  it('calls Edge Function with action trending and all_time period by default', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [fakeBook],
    });

    const results = await getTrending();

    expect(global.fetch).toHaveBeenCalledWith(
      'https://test.supabase.co/functions/v1/books',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ action: 'trending', period: 'all_time', limit: 20 }),
      })
    );
    expect(results).toEqual([fakeBook]);
  });

  it('passes the period parameter', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    await getTrending('last_month');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ body: JSON.stringify({ action: 'trending', period: 'last_month', limit: 20 }) })
    );
  });

  it('respects custom limit', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    await getTrending('all_time', 5);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ body: JSON.stringify({ action: 'trending', period: 'all_time', limit: 5 }) })
    );
  });
});

describe('getRecommended', () => {
  it('returns non-personalized empty result when user has fewer than 3 read/reading books', async () => {
    testState.builderResolve = {
      data: [
        { books: { hardcover_id: 'a' } },
        { books: { hardcover_id: 'b' } },
      ],
      error: null,
    };

    const result = await getRecommended('user-1');

    expect(result.personalized).toBe(false);
    expect(result.books).toEqual([]);
  });

  it('returns personalized results filtered from trending when user has 3+ books', async () => {
    testState.builderResolve = {
      data: [
        { books: { hardcover_id: '1' } }, // same as fakeBook — should be filtered out
        { books: { hardcover_id: 'x2' } },
        { books: { hardcover_id: 'x3' } },
      ],
      error: null,
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [fakeBook, fakeBook2],
    });

    const result = await getRecommended('user-1');

    expect(result.personalized).toBe(true);
    expect(result.books.find((b) => b.hardcover_id === '1')).toBeUndefined();
    expect(result.books.find((b) => b.hardcover_id === '2')).toBeDefined();
  });
});
