import { createSession } from '@/lib/sessions';
import { supabase } from '@/lib/supabase';

// Track state in a module-scoped object to avoid closure issues
const testState = {
  builderResolve: { data: null as any, error: null as any },
  mockBuilder: null as any,
};

jest.mock('@/lib/supabase', () => {
  const mockBuilder = {
    insert: jest.fn().mockReturnThis(),
    then: (resolve: any, reject: any) =>
      Promise.resolve(testState.builderResolve).then(resolve, reject),
  };
  testState.mockBuilder = mockBuilder;
  return {
    supabase: { from: jest.fn(() => mockBuilder) },
  };
});

// Mock updateCurrentPage so we test createSession in isolation
jest.mock('@/lib/userBooks', () => ({
  updateCurrentPage: jest.fn().mockResolvedValue(undefined),
}));

import { updateCurrentPage } from '@/lib/userBooks';

beforeEach(() => {
  testState.builderResolve = { data: null, error: null };
  jest.clearAllMocks();
  if (testState.mockBuilder) {
    testState.mockBuilder.insert.mockReturnThis();
  }
});

const sessionParams = {
  userId: 'user-1',
  bookId: 'book-1',
  userBookId: 'ub-1',
  startPage: 50,
  endPage: 80,
  durationSeconds: 1800,
  startedAt: new Date('2026-04-10T09:00:00Z'),
};

describe('createSession', () => {
  it('inserts a reading session with correct fields', async () => {
    testState.builderResolve = { data: null, error: null };
    await createSession(sessionParams);
    expect(supabase.from).toHaveBeenCalledWith('reading_sessions');
    expect(testState.mockBuilder.insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      book_id: 'book-1',
      start_page: 50,
      end_page: 80,
      duration_seconds: 1800,
      started_at: '2026-04-10T09:00:00.000Z',
    });
  });

  it('calls updateCurrentPage with endPage', async () => {
    testState.builderResolve = { data: null, error: null };
    await createSession(sessionParams);
    expect(updateCurrentPage).toHaveBeenCalledWith('ub-1', 80);
  });

  it('throws when Supabase returns an error', async () => {
    testState.builderResolve = { data: null, error: { message: 'insert failed' } };
    await expect(createSession(sessionParams)).rejects.toEqual({
      message: 'insert failed',
    });
  });

  it('does not call updateCurrentPage when insert fails', async () => {
    testState.builderResolve = { data: null, error: { message: 'insert failed' } };
    await expect(createSession(sessionParams)).rejects.toBeTruthy();
    expect(updateCurrentPage).not.toHaveBeenCalled();
  });
});
