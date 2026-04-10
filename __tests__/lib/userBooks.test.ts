import {
  addToShelf,
  moveShelf,
  updateCurrentPage,
  rateBook,
  getShelf,
  getCurrentBook,
  getUserBook,
  type UserBookWithBook,
} from '@/lib/userBooks';
import { supabase } from '@/lib/supabase';

// Track state in a module-scoped object to avoid closure issues
const testState = {
  builderResolve: { data: null as any, error: null },
  mockBuilder: null as any,
};

jest.mock('@/lib/supabase', () => {
  const mockBuilder = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn(() => Promise.resolve(testState.builderResolve)),
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
    testState.mockBuilder.eq.mockReturnThis();
    testState.mockBuilder.order.mockReturnThis();
    testState.mockBuilder.limit.mockReturnThis();
    testState.mockBuilder.insert.mockReturnThis();
    testState.mockBuilder.update.mockReturnThis();
    testState.mockBuilder.maybeSingle.mockImplementation(() => Promise.resolve(testState.builderResolve));
    testState.mockBuilder.single.mockImplementation(() => Promise.resolve(testState.builderResolve));
  }
});

const mockUserBook: UserBookWithBook = {
  id: 'ub-1',
  user_id: 'user-1',
  book_id: 'book-1',
  shelf: 'reading',
  current_page: 50,
  rating: null,
  review: null,
  added_at: '2026-04-01T00:00:00Z',
  finished_at: null,
  book: {
    id: 'book-1',
    title: 'The Hobbit',
    author: 'Tolkien',
    cover_url: null,
    page_count: 310,
  },
};

describe('addToShelf', () => {
  it('inserts a user_book and returns its id', async () => {
    testState.builderResolve = { data: { id: 'ub-1' }, error: null };
    const id = await addToShelf('user-1', 'book-1', 'reading');
    expect(id).toBe('ub-1');
    expect(testState.mockBuilder.insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      book_id: 'book-1',
      shelf: 'reading',
      current_page: 0,
    });
  });

  it('throws on Supabase error', async () => {
    testState.builderResolve = { data: null, error: { message: 'unique violation' } };
    await expect(addToShelf('user-1', 'book-1', 'reading')).rejects.toEqual({
      message: 'unique violation',
    });
  });
});

describe('moveShelf', () => {
  it('updates the shelf', async () => {
    testState.builderResolve = { data: null, error: null };
    await moveShelf('ub-1', 'want');
    expect(testState.mockBuilder.update).toHaveBeenCalledWith(expect.objectContaining({ shelf: 'want' }));
    expect(testState.mockBuilder.eq).toHaveBeenCalledWith('id', 'ub-1');
    const updateCall = testState.mockBuilder.update.mock.calls[0][0];
    expect(updateCall.finished_at).toBeUndefined();
  });

  it('sets finished_at when moving to read shelf', async () => {
    testState.builderResolve = { data: null, error: null };
    await moveShelf('ub-1', 'read');
    const updateCall = testState.mockBuilder.update.mock.calls[0][0];
    expect(updateCall.finished_at).toBeTruthy();
  });
});

describe('updateCurrentPage', () => {
  it('updates current_page', async () => {
    testState.builderResolve = { data: null, error: null };
    await updateCurrentPage('ub-1', 120);
    expect(testState.mockBuilder.update).toHaveBeenCalledWith({ current_page: 120 });
    expect(testState.mockBuilder.eq).toHaveBeenCalledWith('id', 'ub-1');
  });

  it('throws on Supabase error', async () => {
    testState.builderResolve = { data: null, error: { message: 'update failed' } };
    await expect(updateCurrentPage('ub-1', 120)).rejects.toEqual({ message: 'update failed' });
  });
});

describe('rateBook', () => {
  it('updates rating and review', async () => {
    testState.builderResolve = { data: null, error: null };
    await rateBook('ub-1', 5, 'Excellent');
    expect(testState.mockBuilder.update).toHaveBeenCalledWith({ rating: 5, review: 'Excellent' });
  });

  it('sets review to null when not provided', async () => {
    testState.builderResolve = { data: null, error: null };
    await rateBook('ub-1', 4);
    expect(testState.mockBuilder.update).toHaveBeenCalledWith({ rating: 4, review: null });
  });
});

describe('getShelf', () => {
  it('returns books on the specified shelf', async () => {
    testState.builderResolve = { data: [mockUserBook], error: null };
    const result = await getShelf('user-1', 'reading');
    expect(result).toHaveLength(1);
    expect(result[0].shelf).toBe('reading');
    expect(testState.mockBuilder.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(testState.mockBuilder.eq).toHaveBeenCalledWith('shelf', 'reading');
  });

  it('returns empty array when shelf is empty', async () => {
    testState.builderResolve = { data: [], error: null };
    const result = await getShelf('user-1', 'want');
    expect(result).toEqual([]);
  });
});

describe('getCurrentBook', () => {
  it('returns the most recent reading book', async () => {
    testState.builderResolve = { data: mockUserBook, error: null };
    const result = await getCurrentBook('user-1');
    expect(result?.shelf).toBe('reading');
    expect(testState.mockBuilder.maybeSingle).toHaveBeenCalled();
  });

  it('returns null when no book is being read', async () => {
    testState.builderResolve = { data: null, error: null };
    const result = await getCurrentBook('user-1');
    expect(result).toBeNull();
  });
});

describe('getUserBook', () => {
  it('returns the user_book for a given bookId', async () => {
    testState.builderResolve = { data: mockUserBook, error: null };
    const result = await getUserBook('user-1', 'book-1');
    expect(result?.book_id).toBe('book-1');
    expect(testState.mockBuilder.eq).toHaveBeenCalledWith('book_id', 'book-1');
    expect(testState.mockBuilder.maybeSingle).toHaveBeenCalled();
  });

  it('returns null when book not in library', async () => {
    testState.builderResolve = { data: null, error: null };
    const result = await getUserBook('user-1', 'not-in-library');
    expect(result).toBeNull();
  });
});
