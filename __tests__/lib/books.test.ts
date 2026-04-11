import { searchBooks, fetchBookByGoogleId, upsertBook, type BookSearchResult } from '@/lib/books';

// Track state in a module-scoped object to avoid closure issues
const testState = {
  builderResolve: { data: null as any, error: null },
  mockBuilder: null as any,
};

jest.mock('@/lib/supabase', () => {
  const mockBuilder = {
    select: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
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
    testState.mockBuilder.single.mockImplementation(() => Promise.resolve(testState.builderResolve));
  }
  global.fetch = jest.fn();
});

const fakeVolume = {
  id: 'gbk123',
  volumeInfo: {
    title: 'The Hobbit',
    authors: ['J.R.R. Tolkien'],
    imageLinks: { thumbnail: 'http://books.google.com/cover.jpg' },
    pageCount: 310,
    categories: ['Fantasy'],
    // no description field → will map to null
  },
};

describe('searchBooks', () => {
  it('returns mapped results from Google Books API', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [fakeVolume] }),
    });

    const results = await searchBooks('hobbit');

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      google_books_id: 'gbk123',
      title: 'The Hobbit',
      author: 'J.R.R. Tolkien',
      cover_url: 'https://books.google.com/cover.jpg',
      page_count: 310,
      genres: ['Fantasy'],
      description: null,
    });
  });

  it('upgrades http cover URLs to https', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [fakeVolume] }),
    });
    const results = await searchBooks('hobbit');
    expect(results[0].cover_url).toMatch(/^https:/);
  });

  it('returns empty array when items is missing', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });
    const results = await searchBooks('xyz');
    expect(results).toEqual([]);
  });

  it('handles missing authors and imageLinks gracefully', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [{ id: 'abc', volumeInfo: { title: 'No Author Book' } }],
      }),
    });
    const results = await searchBooks('no author');
    expect(results[0].author).toBe('Unknown Author');
    expect(results[0].cover_url).toBeNull();
    expect(results[0].page_count).toBeNull();
    expect(results[0].genres).toBeNull();
  });

  it('throws when the API returns a non-ok status', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 500 });
    await expect(searchBooks('error')).rejects.toThrow('Google Books API error: 500');
  });
});

describe('fetchBookByGoogleId', () => {
  it('returns null when API returns non-ok', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 404 });
    const result = await fetchBookByGoogleId('bad-id');
    expect(result).toBeNull();
  });

  it('returns mapped book on success', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => fakeVolume,
    });
    const result = await fetchBookByGoogleId('gbk123');
    expect(result).toEqual({
      google_books_id: 'gbk123',
      title: 'The Hobbit',
      author: 'J.R.R. Tolkien',
      cover_url: 'https://books.google.com/cover.jpg',
      page_count: 310,
      genres: ['Fantasy'],
      description: null,
    });
  });
});

describe('upsertBook', () => {
  it('upserts to Supabase and returns the book id', async () => {
    testState.builderResolve = { data: { id: 'supabase-uuid' }, error: null };
    const book: BookSearchResult = {
      google_books_id: 'gbk123',
      title: 'The Hobbit',
      author: 'J.R.R. Tolkien',
      cover_url: 'https://books.google.com/cover.jpg',
      page_count: 310,
      genres: ['Fantasy'],
      description: null,
    };
    const id = await upsertBook(book);
    expect(id).toBe('supabase-uuid');
    expect(testState.mockBuilder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ google_books_id: 'gbk123', title: 'The Hobbit' }),
      { onConflict: 'google_books_id' }
    );
  });

  it('throws when Supabase returns an error', async () => {
    testState.builderResolve = { data: null, error: { message: 'DB error' } };
    await expect(upsertBook({ google_books_id: 'x', title: 'X', author: 'A', cover_url: null, page_count: null, genres: null, description: null }))
      .rejects.toEqual({ message: 'DB error' });
  });
});
