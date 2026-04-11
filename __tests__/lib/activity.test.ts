import {
  getFeed,
  createEvent,
  likeEvent,
  unlikeEvent,
  getComments,
  addComment,
} from '@/lib/activity';

// ─── mock state ──────────────────────────────────────────────────────────────

const testState = {
  builderResolve: { data: null as any, error: null as any },
  mockBuilder: null as any,
};

jest.mock('@/lib/supabase', () => {
  const mockBuilder = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn(() => Promise.resolve(testState.builderResolve)),
    then: jest.fn((resolve: any, reject: any) =>
      Promise.resolve(testState.builderResolve).then(resolve, reject)
    ),
  };
  testState.mockBuilder = mockBuilder;
  return { supabase: { from: jest.fn(() => mockBuilder) } };
});

beforeEach(() => {
  testState.builderResolve = { data: null, error: null };
  jest.clearAllMocks();
  const { supabase } = require('@/lib/supabase');
  (supabase.from as jest.Mock).mockImplementation(() => testState.mockBuilder);
  const b = testState.mockBuilder;
  b.select.mockReturnThis();
  b.insert.mockReturnThis();
  b.delete.mockReturnThis();
  b.eq.mockReturnThis();
  b.in.mockReturnThis();
  b.order.mockReturnThis();
  b.limit.mockReturnThis();
  b.single.mockImplementation(() => Promise.resolve(testState.builderResolve));
  b.then.mockImplementation((resolve: any, reject: any) =>
    Promise.resolve(testState.builderResolve).then(resolve, reject)
  );
});

// ─── getFeed ─────────────────────────────────────────────────────────────────

describe('getFeed', () => {
  it('returns empty array when following no one', async () => {
    const { supabase } = require('@/lib/supabase');
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'follows') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn(() => Promise.resolve({ data: [], error: null })),
        };
      }
      return testState.mockBuilder;
    });
    const result = await getFeed('user-1');
    expect(result).toEqual([]);
  });

  it('returns mapped ActivityEvent array for followed users', async () => {
    const { supabase } = require('@/lib/supabase');
    const rawEvents = [
      {
        id: 'evt-1',
        event_type: 'started_book',
        book_id: 'book-1',
        metadata: {},
        created_at: '2026-04-11T10:00:00Z',
        actor: { id: 'user-2', username: 'alice' },
        book: { id: 'book-1', title: 'The Hobbit', cover_url: null },
        likes: [{ count: 2 }],
        comments: [{ count: 0 }],
      },
    ];
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'follows') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn(() =>
            Promise.resolve({ data: [{ following_id: 'user-2' }], error: null })
          ),
        };
      }
      if (table === 'activity_events') {
        return {
          select: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn(() => Promise.resolve({ data: rawEvents, error: null })),
        };
      }
      if (table === 'activity_likes') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          in: jest.fn(() => Promise.resolve({ data: [], error: null })),
        };
      }
      return testState.mockBuilder;
    });
    const result = await getFeed('user-1');
    expect(result).toHaveLength(1);
    expect(result[0].actorUsername).toBe('alice');
    expect(result[0].bookTitle).toBe('The Hobbit');
    expect(result[0].eventType).toBe('started_book');
    expect(result[0].likeCount).toBe(2);
    expect(result[0].commentCount).toBe(0);
    expect(result[0].likedByMe).toBe(false);
  });
});

// ─── createEvent ─────────────────────────────────────────────────────────────

describe('createEvent', () => {
  it('inserts correct row into activity_events', async () => {
    testState.builderResolve = { data: null, error: null };
    await createEvent('user-1', 'started_book', 'book-1', {});
    expect(testState.mockBuilder.insert).toHaveBeenCalledWith({
      actor_id: 'user-1',
      event_type: 'started_book',
      book_id: 'book-1',
      metadata: {},
    });
  });
});

// ─── likeEvent / unlikeEvent ─────────────────────────────────────────────────

describe('likeEvent', () => {
  it('inserts into activity_likes', async () => {
    testState.builderResolve = { data: null, error: null };
    await likeEvent('user-1', 'evt-1');
    expect(testState.mockBuilder.insert).toHaveBeenCalledWith({
      event_id: 'evt-1',
      user_id: 'user-1',
    });
  });
});

describe('unlikeEvent', () => {
  it('deletes from activity_likes', async () => {
    testState.builderResolve = { data: null, error: null };
    await unlikeEvent('user-1', 'evt-1');
    expect(testState.mockBuilder.delete).toHaveBeenCalled();
    expect(testState.mockBuilder.eq).toHaveBeenCalledWith('event_id', 'evt-1');
    expect(testState.mockBuilder.eq).toHaveBeenCalledWith('user_id', 'user-1');
  });
});

// ─── getComments ─────────────────────────────────────────────────────────────

describe('getComments', () => {
  it('returns comments in ascending order', async () => {
    const { supabase } = require('@/lib/supabase');
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'activity_comments') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn(() =>
            Promise.resolve({
              data: [
                {
                  id: 'c-1',
                  user_id: 'user-2',
                  body: 'Great read!',
                  created_at: '2026-04-11T11:00:00Z',
                  user: { username: 'alice' },
                },
              ],
              error: null,
            })
          ),
        };
      }
      return testState.mockBuilder;
    });
    const result = await getComments('evt-1');
    expect(result).toHaveLength(1);
    expect(result[0].body).toBe('Great read!');
    expect(result[0].username).toBe('alice');
  });
});

// ─── addComment ──────────────────────────────────────────────────────────────

describe('addComment', () => {
  it('inserts and returns new comment', async () => {
    const { supabase } = require('@/lib/supabase');
    const newRow = {
      id: 'c-2',
      user_id: 'user-1',
      body: 'Nice!',
      created_at: '2026-04-11T12:00:00Z',
      user: { username: 'me' },
    };
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'activity_comments') {
        return {
          insert: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest.fn(() => Promise.resolve({ data: newRow, error: null })),
        };
      }
      return testState.mockBuilder;
    });
    const result = await addComment('user-1', 'evt-1', 'Nice!');
    expect(result.id).toBe('c-2');
    expect(result.body).toBe('Nice!');
    expect(result.username).toBe('me');
  });
});
