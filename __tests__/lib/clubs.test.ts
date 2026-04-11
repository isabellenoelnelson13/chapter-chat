import {
  getMyClubs,
  getClub,
  createClub,
  addMember,
  removeMember,
  setCurrentBook,
  getPosts,
  getThread,
  addPost,
  deletePost,
} from '@/lib/clubs';

// ─── mock state ──────────────────────────────────────────────────────────────

const testState = {
  builderResolve: { data: null as any, error: null as any },
  mockBuilder: null as any,
};

jest.mock('@/lib/supabase', () => {
  const mockBuilder = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn(() => Promise.resolve(testState.builderResolve)),
    single: jest.fn(() => Promise.resolve(testState.builderResolve)),
    then: jest.fn((resolve: any, reject: any) =>
      Promise.resolve(testState.builderResolve).then(resolve, reject)
    ),
  };
  testState.mockBuilder = mockBuilder;
  return { supabase: { from: jest.fn(() => mockBuilder) } };
});

function resetMockBuilder() {
  const b = testState.mockBuilder;
  b.select.mockReturnThis();
  b.insert.mockReturnThis();
  b.update.mockReturnThis();
  b.delete.mockReturnThis();
  b.eq.mockReturnThis();
  b.in.mockReturnThis();
  b.is.mockReturnThis();
  b.not.mockReturnThis();
  b.order.mockReturnThis();
  b.limit.mockReturnThis();
  b.maybeSingle.mockImplementation(() =>
    Promise.resolve(testState.builderResolve)
  );
  b.single.mockImplementation(() =>
    Promise.resolve(testState.builderResolve)
  );
  b.then.mockImplementation((resolve: any, reject: any) =>
    Promise.resolve(testState.builderResolve).then(resolve, reject)
  );
}

beforeEach(() => {
  testState.builderResolve = { data: null, error: null };
  jest.clearAllMocks();
  const { supabase } = require('@/lib/supabase');
  (supabase.from as jest.Mock).mockImplementation(() => testState.mockBuilder);
  resetMockBuilder();
});

// ─── getMyClubs ──────────────────────────────────────────────────────────────

describe('getMyClubs', () => {
  it('returns empty array when user is in no clubs', async () => {
    const { supabase } = require('@/lib/supabase');
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'club_members') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn(() => Promise.resolve({ data: [], error: null })),
        };
      }
      return testState.mockBuilder;
    });
    const result = await getMyClubs('user-1');
    expect(result).toEqual([]);
  });

  it('returns mapped ClubSummary array', async () => {
    const { supabase } = require('@/lib/supabase');
    const memberships = [
      {
        club_id: 'club-1',
        club: {
          id: 'club-1',
          name: 'Tolkien Fans',
          description: 'We love Tolkien',
          owner_id: 'user-1',
          members: [{ count: 3 }],
        },
      },
    ];
    const currentBooks = [
      {
        club_id: 'club-1',
        book: { title: 'The Hobbit', cover_url: null },
      },
    ];
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'club_members') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn(() => Promise.resolve({ data: memberships, error: null })),
        };
      }
      if (table === 'club_books') {
        return {
          select: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          is: jest.fn(() => Promise.resolve({ data: currentBooks, error: null })),
        };
      }
      return testState.mockBuilder;
    });
    const result = await getMyClubs('user-1');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Tolkien Fans');
    expect(result[0].memberCount).toBe(3);
    expect(result[0].currentBookTitle).toBe('The Hobbit');
  });
});

// ─── getClub ─────────────────────────────────────────────────────────────────

describe('getClub', () => {
  it('returns null when club does not exist', async () => {
    const { supabase } = require('@/lib/supabase');
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'book_clubs') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn(() =>
            Promise.resolve({ data: null, error: null })
          ),
        };
      }
      return testState.mockBuilder;
    });
    const result = await getClub('club-999');
    expect(result).toBeNull();
  });

  it('returns ClubDetail with members and current book', async () => {
    const { supabase } = require('@/lib/supabase');
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'book_clubs') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn(() =>
            Promise.resolve({
              data: {
                id: 'club-1',
                name: 'Tolkien Fans',
                description: null,
                owner_id: 'user-1',
              },
              error: null,
            })
          ),
        };
      }
      if (table === 'club_members') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn(() =>
            Promise.resolve({
              data: [{ user_id: 'user-1', role: 'owner', user: { username: 'alice' } }],
              error: null,
            })
          ),
        };
      }
      if (table === 'club_books') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          not: jest.fn().mockReturnThis(),
          order: jest.fn(() => Promise.resolve({ data: [], error: null })),
          maybeSingle: jest.fn(() =>
            Promise.resolve({
              data: {
                id: 'cb-1',
                book_id: 'book-1',
                started_at: '2026-04-01T00:00:00Z',
                ended_at: null,
                book: { title: 'The Hobbit', cover_url: null, page_count: 310 },
              },
              error: null,
            })
          ),
        };
      }
      if (table === 'user_books') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          in: jest.fn(() =>
            Promise.resolve({
              data: [{ user_id: 'user-1', current_page: 50 }],
              error: null,
            })
          ),
        };
      }
      return testState.mockBuilder;
    });
    const result = await getClub('club-1');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Tolkien Fans');
    expect(result!.currentBook?.bookTitle).toBe('The Hobbit');
    expect(result!.members).toHaveLength(1);
    expect(result!.members[0].username).toBe('alice');
    expect(result!.members[0].currentPage).toBe(50);
  });
});

// ─── createClub ──────────────────────────────────────────────────────────────

describe('createClub', () => {
  it('inserts club and owner member row, returns club id', async () => {
    const { supabase } = require('@/lib/supabase');
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'book_clubs') {
        return {
          insert: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest.fn(() =>
            Promise.resolve({ data: { id: 'club-new' }, error: null })
          ),
        };
      }
      if (table === 'club_members') {
        return {
          insert: jest.fn(() => Promise.resolve({ data: null, error: null })),
        };
      }
      return testState.mockBuilder;
    });
    const id = await createClub('user-1', 'New Club', 'A description');
    expect(id).toBe('club-new');
  });
});

// ─── addMember / removeMember ─────────────────────────────────────────────────

describe('addMember', () => {
  it('inserts club_members row with role member', async () => {
    testState.builderResolve = { data: null, error: null };
    await addMember('club-1', 'user-2');
    expect(testState.mockBuilder.insert).toHaveBeenCalledWith({
      club_id: 'club-1',
      user_id: 'user-2',
      role: 'member',
    });
  });
});

describe('removeMember', () => {
  it('deletes correct club_members row', async () => {
    testState.builderResolve = { data: null, error: null };
    await removeMember('club-1', 'user-2');
    expect(testState.mockBuilder.delete).toHaveBeenCalled();
    expect(testState.mockBuilder.eq).toHaveBeenCalledWith('club_id', 'club-1');
    expect(testState.mockBuilder.eq).toHaveBeenCalledWith('user_id', 'user-2');
  });
});

// ─── setCurrentBook ──────────────────────────────────────────────────────────

describe('setCurrentBook', () => {
  it('archives old book and inserts new club_books row', async () => {
    const { supabase } = require('@/lib/supabase');
    const insertMock = jest.fn(() => Promise.resolve({ data: null, error: null }));
    const updateBuilder = {
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn(() => Promise.resolve({ data: null, error: null })),
    };
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'club_books') {
        return { ...updateBuilder, insert: insertMock };
      }
      return testState.mockBuilder;
    });
    await setCurrentBook('club-1', 'book-2', 'user-1');
    expect(updateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ ended_at: expect.any(String) })
    );
    expect(insertMock).toHaveBeenCalledWith({
      club_id: 'club-1',
      book_id: 'book-2',
      added_by: 'user-1',
    });
  });
});

// ─── getPosts ────────────────────────────────────────────────────────────────

describe('getPosts', () => {
  it('returns top-level posts (parent_id null) ordered newest first', async () => {
    const { supabase } = require('@/lib/supabase');
    const rawPosts = [
      {
        id: 'post-1',
        club_id: 'club-1',
        user_id: 'user-1',
        body: 'Hello club!',
        parent_id: null,
        created_at: '2026-04-11T10:00:00Z',
        user: { username: 'alice' },
        replies: [{ count: 2 }],
      },
    ];
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'club_posts') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          order: jest.fn(() => Promise.resolve({ data: rawPosts, error: null })),
        };
      }
      return testState.mockBuilder;
    });
    const result = await getPosts('club-1');
    expect(result).toHaveLength(1);
    expect(result[0].body).toBe('Hello club!');
    expect(result[0].username).toBe('alice');
    expect(result[0].replyCount).toBe(2);
    expect(result[0].parentId).toBeNull();
  });
});

// ─── getThread ───────────────────────────────────────────────────────────────

describe('getThread', () => {
  it('returns parent post and replies in ascending order', async () => {
    const { supabase } = require('@/lib/supabase');
    let callCount = 0;
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'club_posts') {
        callCount++;
        if (callCount === 1) {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn(() =>
              Promise.resolve({
                data: {
                  id: 'post-1',
                  club_id: 'club-1',
                  user_id: 'user-1',
                  body: 'Top post',
                  parent_id: null,
                  created_at: '2026-04-11T10:00:00Z',
                  user: { username: 'alice' },
                },
                error: null,
              })
            ),
          };
        } else {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn(() =>
              Promise.resolve({
                data: [
                  {
                    id: 'post-2',
                    club_id: 'club-1',
                    user_id: 'user-2',
                    body: 'A reply',
                    parent_id: 'post-1',
                    created_at: '2026-04-11T10:05:00Z',
                    user: { username: 'bob' },
                  },
                ],
                error: null,
              })
            ),
          };
        }
      }
      return testState.mockBuilder;
    });
    const result = await getThread('post-1');
    expect(result.parent.body).toBe('Top post');
    expect(result.replies).toHaveLength(1);
    expect(result.replies[0].body).toBe('A reply');
    expect(result.replies[0].parentId).toBe('post-1');
  });
});

// ─── addPost ─────────────────────────────────────────────────────────────────

describe('addPost', () => {
  it('inserts top-level post (no parentId) and returns ClubPost', async () => {
    const { supabase } = require('@/lib/supabase');
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'club_posts') {
        return {
          insert: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest.fn(() =>
            Promise.resolve({
              data: {
                id: 'post-new',
                club_id: 'club-1',
                user_id: 'user-1',
                body: 'Great book!',
                parent_id: null,
                created_at: '2026-04-11T12:00:00Z',
                user: { username: 'alice' },
              },
              error: null,
            })
          ),
        };
      }
      return testState.mockBuilder;
    });
    const result = await addPost('club-1', 'user-1', 'Great book!');
    expect(result.id).toBe('post-new');
    expect(result.body).toBe('Great book!');
    expect(result.parentId).toBeNull();
  });

  it('inserts reply with parentId', async () => {
    const { supabase } = require('@/lib/supabase');
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'club_posts') {
        return {
          insert: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest.fn(() =>
            Promise.resolve({
              data: {
                id: 'post-reply',
                club_id: 'club-1',
                user_id: 'user-2',
                body: 'Agreed!',
                parent_id: 'post-1',
                created_at: '2026-04-11T12:05:00Z',
                user: { username: 'bob' },
              },
              error: null,
            })
          ),
        };
      }
      return testState.mockBuilder;
    });
    const result = await addPost('club-1', 'user-2', 'Agreed!', 'post-1');
    expect(result.parentId).toBe('post-1');
  });
});

// ─── deletePost ──────────────────────────────────────────────────────────────

describe('deletePost', () => {
  it('deletes post matching postId and userId', async () => {
    testState.builderResolve = { data: null, error: null };
    await deletePost('post-1', 'user-1');
    expect(testState.mockBuilder.delete).toHaveBeenCalled();
    expect(testState.mockBuilder.eq).toHaveBeenCalledWith('id', 'post-1');
    expect(testState.mockBuilder.eq).toHaveBeenCalledWith('user_id', 'user-1');
  });
});
