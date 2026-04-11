import {
  searchUsers, followUser, unfollowUser, cancelFollowRequest,
  getFollowing, getFollowRequests, approveFollowRequest,
  declineFollowRequest, getFollowStatus,
} from '@/lib/follows';

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
    neq: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn(() => Promise.resolve(testState.builderResolve)),
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
  if (testState.mockBuilder) {
    testState.mockBuilder.select.mockReturnThis();
    testState.mockBuilder.insert.mockReturnThis();
    testState.mockBuilder.delete.mockReturnThis();
    testState.mockBuilder.eq.mockReturnThis();
    testState.mockBuilder.neq.mockReturnThis();
    testState.mockBuilder.ilike.mockReturnThis();
    testState.mockBuilder.limit.mockReturnThis();
    testState.mockBuilder.maybeSingle.mockImplementation(() =>
      Promise.resolve(testState.builderResolve)
    );
    testState.mockBuilder.then.mockImplementation((resolve: any, reject: any) =>
      Promise.resolve(testState.builderResolve).then(resolve, reject)
    );
  }
});

describe('getFollowStatus', () => {
  it('returns following when found in follows table', async () => {
    const { supabase } = require('@/lib/supabase');
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'follows') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn(() =>
            Promise.resolve({ data: { follower_id: 'user-1' }, error: null })
          ),
        };
      }
      return testState.mockBuilder;
    });
    const status = await getFollowStatus('user-1', 'user-2');
    expect(status).toBe('following');
  });

  it('returns requested when in follow_requests but not follows', async () => {
    const { supabase } = require('@/lib/supabase');
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'follows') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null })),
        };
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn(() =>
          Promise.resolve({ data: { requester_id: 'user-1' }, error: null })
        ),
      };
    });
    const status = await getFollowStatus('user-1', 'user-2');
    expect(status).toBe('requested');
  });

  it('returns none when not in either table', async () => {
    testState.builderResolve = { data: null, error: null };
    const status = await getFollowStatus('user-1', 'user-2');
    expect(status).toBe('none');
  });
});

describe('followUser', () => {
  it('inserts into follows when target is public', async () => {
    testState.builderResolve = { data: null, error: null };
    await followUser('user-1', 'user-2', false);
    expect(testState.mockBuilder.insert).toHaveBeenCalledWith({
      follower_id: 'user-1',
      following_id: 'user-2',
    });
  });

  it('inserts into follow_requests when target is private', async () => {
    testState.builderResolve = { data: null, error: null };
    await followUser('user-1', 'user-2', true);
    expect(testState.mockBuilder.insert).toHaveBeenCalledWith({
      requester_id: 'user-1',
      target_id: 'user-2',
    });
  });
});

describe('unfollowUser', () => {
  it('deletes from follows with correct user ids', async () => {
    testState.builderResolve = { data: null, error: null };
    await unfollowUser('user-1', 'user-2');
    expect(testState.mockBuilder.delete).toHaveBeenCalled();
    expect(testState.mockBuilder.eq).toHaveBeenCalledWith('follower_id', 'user-1');
    expect(testState.mockBuilder.eq).toHaveBeenCalledWith('following_id', 'user-2');
  });
});

describe('cancelFollowRequest', () => {
  it('deletes from follow_requests with correct ids', async () => {
    testState.builderResolve = { data: null, error: null };
    await cancelFollowRequest('user-1', 'user-2');
    expect(testState.mockBuilder.delete).toHaveBeenCalled();
    expect(testState.mockBuilder.eq).toHaveBeenCalledWith('requester_id', 'user-1');
    expect(testState.mockBuilder.eq).toHaveBeenCalledWith('target_id', 'user-2');
  });
});

describe('getFollowing', () => {
  it('returns list of followed profiles with followStatus following', async () => {
    testState.builderResolve = {
      data: [
        { profile: { id: 'user-2', username: 'alice', bio: null, is_private: false } },
      ],
      error: null,
    };
    const result = await getFollowing('user-1');
    expect(result).toHaveLength(1);
    expect(result[0].username).toBe('alice');
    expect(result[0].followStatus).toBe('following');
  });

  it('returns empty array when following no one', async () => {
    testState.builderResolve = { data: [], error: null };
    const result = await getFollowing('user-1');
    expect(result).toEqual([]);
  });
});

describe('getFollowRequests', () => {
  it('returns list of pending requesters', async () => {
    testState.builderResolve = {
      data: [
        { profile: { id: 'user-3', username: 'bob', bio: 'hi' } },
      ],
      error: null,
    };
    const result = await getFollowRequests('user-1');
    expect(result).toHaveLength(1);
    expect(result[0].requesterId).toBe('user-3');
    expect(result[0].username).toBe('bob');
  });

  it('returns empty array when no pending requests', async () => {
    testState.builderResolve = { data: [], error: null };
    const result = await getFollowRequests('user-1');
    expect(result).toEqual([]);
  });
});

describe('approveFollowRequest', () => {
  it('deletes from follow_requests and inserts into follows', async () => {
    testState.builderResolve = { data: null, error: null };
    await approveFollowRequest('user-3', 'user-1');
    expect(testState.mockBuilder.delete).toHaveBeenCalled();
    expect(testState.mockBuilder.insert).toHaveBeenCalledWith({
      follower_id: 'user-3',
      following_id: 'user-1',
    });
  });
});

describe('declineFollowRequest', () => {
  it('deletes from follow_requests', async () => {
    testState.builderResolve = { data: null, error: null };
    await declineFollowRequest('user-3', 'user-1');
    expect(testState.mockBuilder.delete).toHaveBeenCalled();
    expect(testState.mockBuilder.eq).toHaveBeenCalledWith('requester_id', 'user-3');
    expect(testState.mockBuilder.eq).toHaveBeenCalledWith('target_id', 'user-1');
  });
});

describe('searchUsers', () => {
  it('returns matching profiles with followStatus none when not following', async () => {
    const { supabase } = require('@/lib/supabase');
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: jest.fn().mockReturnThis(),
          ilike: jest.fn().mockReturnThis(),
          neq: jest.fn().mockReturnThis(),
          limit: jest.fn(() =>
            Promise.resolve({
              data: [{ id: 'user-2', username: 'alice', bio: null, is_private: false }],
              error: null,
            })
          ),
        };
      }
      // follows and follow_requests return null → status is none
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null })),
      };
    });
    const results = await searchUsers('ali', 'user-1');
    expect(results).toHaveLength(1);
    expect(results[0].username).toBe('alice');
    expect(results[0].followStatus).toBe('none');
  });

  it('returns empty array when no matches', async () => {
    const { supabase } = require('@/lib/supabase');
    (supabase.from as jest.Mock).mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      limit: jest.fn(() => Promise.resolve({ data: [], error: null })),
    }));
    const results = await searchUsers('xyz', 'user-1');
    expect(results).toEqual([]);
  });
});
