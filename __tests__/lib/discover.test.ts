import { getTrending, getBooksByGenre, getRecommended } from '@/lib/discover';
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
  it('calls Edge Function with action trending and default limit', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [fakeBook],
    });

    const results = await getTrending();

    expect(global.fetch).toHaveBeenCalledWith(
      'https://test.supabase.co/functions/v1/books',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ action: 'trending', limit: 20 }),
      })
    );
    expect(results).toEqual([fakeBook]);
  });

  it('respects custom limit', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    await getTrending(5);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ body: JSON.stringify({ action: 'trending', limit: 5 }) })
    );
  });
});

describe('getBooksByGenre', () => {
  it('calls Edge Function with action by_genre and genre string', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [fakeBook],
    });

    const results = await getBooksByGenre('fantasy');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://test.supabase.co/functions/v1/books',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ action: 'by_genre', genre: 'fantasy', limit: 20 }),
      })
    );
    expect(results).toEqual([fakeBook]);
  });
});

describe('getRecommended', () => {
  it('falls back to trending when user has fewer than 3 read/reading books', async () => {
    testState.builderResolve = {
      data: [
        { books: { genres: ['Fantasy'], hardcover_id: 'a' } },
        { books: { genres: ['Fantasy'], hardcover_id: 'b' } },
      ],
      error: null,
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [fakeBook],
    });

    const result = await getRecommended('user-1');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ body: JSON.stringify({ action: 'trending', limit: 20 }) })
    );
    expect(result.personalized).toBe(false);
    expect(result.books).toEqual([fakeBook]);
  });

  it('returns personalized results based on top genres when user has 3+ books', async () => {
    testState.builderResolve = {
      data: [
        { books: { genres: ['Sci-Fi'], hardcover_id: 'x1' } },
        { books: { genres: ['Sci-Fi'], hardcover_id: 'x2' } },
        { books: { genres: ['Fantasy'], hardcover_id: 'x3' } },
      ],
      error: null,
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => [fakeBook] })
      .mockResolvedValueOnce({ ok: true, json: async () => [fakeBook2] });

    const result = await getRecommended('user-1');

    expect(result.personalized).toBe(true);
    expect(result.books.map((b) => b.hardcover_id)).toEqual(['1', '2']);
  });

  it('deduplicates books that appear in multiple genre results', async () => {
    testState.builderResolve = {
      data: [
        { books: { genres: ['Sci-Fi'], hardcover_id: 'x1' } },
        { books: { genres: ['Sci-Fi'], hardcover_id: 'x2' } },
        { books: { genres: ['Fantasy'], hardcover_id: 'x3' } },
      ],
      error: null,
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => [fakeBook] })
      .mockResolvedValueOnce({ ok: true, json: async () => [fakeBook] });

    const result = await getRecommended('user-1');

    expect(result.books.filter((b) => b.hardcover_id === '1')).toHaveLength(1);
  });

  it('filters out books already on the user shelves', async () => {
    testState.builderResolve = {
      data: [
        { books: { genres: ['Sci-Fi'], hardcover_id: '1' } }, // same as fakeBook
        { books: { genres: ['Sci-Fi'], hardcover_id: 'x2' } },
        { books: { genres: ['Sci-Fi'], hardcover_id: 'x3' } },
      ],
      error: null,
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [fakeBook, fakeBook2],
    });

    const result = await getRecommended('user-1');

    expect(result.books.find((b) => b.hardcover_id === '1')).toBeUndefined();
    expect(result.books.find((b) => b.hardcover_id === '2')).toBeDefined();
  });
});
