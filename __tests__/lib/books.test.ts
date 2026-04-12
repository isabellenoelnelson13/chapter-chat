import { searchBooks, upsertBook, type BookSearchResult } from '@/lib/books';

const testState = {
  builderResolve: { data: null as any, error: null },
  mockBuilder: null as any,
};

jest.mock('@/lib/supabase', () => {
  const mockBuilder = {
    select: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(() => Promise.resolve(testState.builderResolve)),
    then: (resolve: any, reject: any) =>
      Promise.resolve(testState.builderResolve).then(resolve, reject),
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
    testState.mockBuilder.upsert.mockReturnThis();
    testState.mockBuilder.update.mockReturnThis();
    testState.mockBuilder.eq.mockReturnThis();
    testState.mockBuilder.single.mockImplementation(() =>
      Promise.resolve(testState.builderResolve)
    );
  }
  global.fetch = jest.fn();
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
});

const fakeBook: BookSearchResult = {
  hardcover_id: '12345',
  title: 'The Hobbit',
  author: 'J.R.R. Tolkien',
  cover_url: 'https://hardcover.app/cover.jpg',
  page_count: 310,
  genres: ['Fantasy'],
  description: 'A hobbit goes on an adventure.',
  rating: 4.5,
  users_read_count: 95000,
};

describe('searchBooks', () => {
  it('calls the Edge Function with action search and returns results', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [fakeBook],
    });

    const results = await searchBooks('hobbit');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://test.supabase.co/functions/v1/books',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ action: 'search', query: 'hobbit' }),
      })
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(fakeBook);
  });

  it('returns empty array when Edge Function returns empty array', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });
    const results = await searchBooks('xyz');
    expect(results).toEqual([]);
  });

  it('throws when Edge Function returns non-ok status', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 502 });
    await expect(searchBooks('error')).rejects.toThrow('Books function error: 502');
  });
});

describe('upsertBook', () => {
  it('upserts to Supabase with hardcover_id and returns the book id', async () => {
    testState.builderResolve = { data: { id: 'supabase-uuid' }, error: null };

    const id = await upsertBook(fakeBook);

    expect(id).toBe('supabase-uuid');
    expect(testState.mockBuilder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ hardcover_id: '12345', title: 'The Hobbit' }),
      { onConflict: 'hardcover_id' }
    );
  });

  it('throws when Supabase returns an error', async () => {
    testState.builderResolve = { data: null, error: { message: 'DB error' } };
    await expect(upsertBook(fakeBook)).rejects.toEqual({ message: 'DB error' });
  });
});
