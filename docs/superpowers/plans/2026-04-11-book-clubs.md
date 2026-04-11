# Book Clubs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add invite-only book clubs with shared reading, member progress tracking, and discussion threads; fix the activity feed to also show the current user's own events.

**Architecture:** A `lib/clubs.ts` data layer talks to four Supabase tables (`book_clubs`, `club_members`, `club_books`, `club_posts`). Three new screens handle the clubs list, club detail, and post thread. The existing `lib/activity.ts` `getFeed` function gets a one-line fix to include the requesting user's own events alongside followed users' events.

**Tech Stack:** React Native, Expo Router, Supabase JS client, `@testing-library/react-native`, Jest.

---

## File Map

| Action | Path | Purpose |
|---|---|---|
| Modify | `types/database.ts` | Add `club_books` table type |
| Create | `lib/clubs.ts` | All club data-layer functions |
| Create | `__tests__/lib/clubs.test.ts` | Unit tests for `lib/clubs.ts` |
| Modify | `lib/activity.ts` | Include own events in `getFeed` |
| Modify | `__tests__/lib/activity.test.ts` | Test own-events fix |
| Create | `app/clubs.tsx` | Clubs list screen |
| Create | `__tests__/screens/clubs.test.tsx` | Tests for clubs list screen |
| Create | `app/club/[clubId]/index.tsx` | Club detail screen |
| Create | `__tests__/screens/clubDetail.test.tsx` | Tests for club detail screen |
| Create | `app/club/[clubId]/post/[postId].tsx` | Post thread screen |
| Create | `__tests__/screens/clubPost.test.tsx` | Tests for post thread screen |
| Modify | `app/(tabs)/social.tsx` | Add "Clubs" button to header |
| Modify | `__tests__/screens/social.test.tsx` | Test Clubs button |

---

## Task 1: Add `club_books` type + run migration SQL

**Files:**
- Modify: `types/database.ts`

### Context

`types/database.ts` already has `book_clubs`, `club_members`, and `club_posts` tables. It is missing `club_books`. The current `book_clubs.current_book_id` column in the type can remain — we will use `club_books.ended_at IS NULL` to identify the current book instead.

- [ ] **Step 1: Add `club_books` table type**

In `types/database.ts`, after the `club_posts` block (around line 196), insert the `club_books` block. The full updated `Tables` section should include:

```typescript
      club_books: {
        Row: {
          id: string;
          club_id: string;
          book_id: string;
          added_by: string;
          started_at: string;
          ended_at: string | null;
        };
        Insert: {
          id?: string;
          club_id: string;
          book_id: string;
          added_by: string;
          started_at?: string;
          ended_at?: string | null;
        };
        Update: {
          ended_at?: string | null;
        };
      };
```

Place it immediately after the closing brace of the `club_posts` block and before the `challenges` block.

- [ ] **Step 2: Run migration SQL in Supabase**

In the Supabase dashboard SQL Editor, run:

```sql
create table if not exists club_books (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references book_clubs(id) on delete cascade,
  book_id    uuid not null references books(id),
  added_by   uuid not null references profiles(id),
  started_at timestamptz not null default now(),
  ended_at   timestamptz
);

create index if not exists club_books_club_id_idx on club_books(club_id);
create index if not exists club_books_ended_at_idx on club_books(club_id, ended_at);
```

- [ ] **Step 3: Commit**

```bash
git add types/database.ts
git commit -m "feat: add club_books type to database schema"
```

---

## Task 2: `lib/clubs.ts` data layer (TDD)

**Files:**
- Create: `__tests__/lib/clubs.test.ts`
- Create: `lib/clubs.ts`

### Context

Follow the same mockBuilder + testState pattern used in `__tests__/lib/activity.test.ts`. All Supabase queries go through `supabase.from(table)`. Tests intercept at the `from` level by routing to a per-table mock.

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/clubs.test.ts`:

```typescript
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
        // Both current and history queries go to club_books
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          is: jest.fn(() =>
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
    const updateMock = {
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn(() => Promise.resolve({ data: null, error: null })),
    };
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'club_books') {
        return { ...updateMock, insert: insertMock };
      }
      return testState.mockBuilder;
    });
    await setCurrentBook('club-1', 'book-2', 'user-1');
    expect(updateMock.update).toHaveBeenCalledWith(
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
          // First call: parent
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
          // Second call: replies
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest __tests__/lib/clubs.test.ts --no-coverage 2>&1 | tail -10
```

Expected: FAIL — "Cannot find module '@/lib/clubs'"

- [ ] **Step 3: Create `lib/clubs.ts`**

```typescript
import { supabase } from './supabase';

export interface ClubSummary {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  memberCount: number;
  currentBookTitle: string | null;
  currentBookCoverUrl: string | null;
}

export interface ClubMemberProgress {
  userId: string;
  username: string;
  role: 'owner' | 'member';
  currentPage: number;
  pageCount: number | null;
}

export interface ClubBook {
  id: string;
  bookId: string;
  bookTitle: string;
  bookCoverUrl: string | null;
  startedAt: string;
  endedAt: string | null;
}

export interface ClubDetail {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  currentBook: ClubBook | null;
  members: ClubMemberProgress[];
  history: ClubBook[];
}

export interface ClubPost {
  id: string;
  clubId: string;
  userId: string;
  username: string;
  body: string;
  parentId: string | null;
  replyCount: number;
  createdAt: string;
}

export async function getMyClubs(userId: string): Promise<ClubSummary[]> {
  const { data: memberships, error: membershipsError } = await supabase
    .from('club_members')
    .select('club_id, club:book_clubs(id, name, description, owner_id, members:club_members(count))')
    .eq('user_id', userId);
  if (membershipsError) throw membershipsError;

  const clubs = (memberships ?? []).map((m: any) => m.club).filter(Boolean);
  if (clubs.length === 0) return [];

  const clubIds = clubs.map((c: any) => c.id);

  const { data: currentBooks, error: cbError } = await supabase
    .from('club_books')
    .select('club_id, book:books(title, cover_url)')
    .in('club_id', clubIds)
    .is('ended_at', null);
  if (cbError) throw cbError;

  const currentBookMap = new Map(
    (currentBooks ?? []).map((cb: any) => [cb.club_id, cb.book])
  );

  return clubs.map((c: any) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    ownerId: c.owner_id,
    memberCount: c.members?.[0]?.count ?? 0,
    currentBookTitle: currentBookMap.get(c.id)?.title ?? null,
    currentBookCoverUrl: currentBookMap.get(c.id)?.cover_url ?? null,
  }));
}

export async function getClub(clubId: string): Promise<ClubDetail | null> {
  const { data: club, error: clubError } = await supabase
    .from('book_clubs')
    .select('id, name, description, owner_id')
    .eq('id', clubId)
    .maybeSingle();
  if (clubError) throw clubError;
  if (!club) return null;

  const { data: members, error: membersError } = await supabase
    .from('club_members')
    .select('user_id, role, user:profiles!user_id(username)')
    .eq('club_id', clubId);
  if (membersError) throw membersError;

  const { data: currentBookRow, error: cbError } = await supabase
    .from('club_books')
    .select('id, book_id, started_at, ended_at, book:books!book_id(title, cover_url, page_count)')
    .eq('club_id', clubId)
    .is('ended_at', null)
    .maybeSingle();
  if (cbError) throw cbError;

  const { data: historyRows, error: histError } = await supabase
    .from('club_books')
    .select('id, book_id, started_at, ended_at, book:books!book_id(title, cover_url)')
    .eq('club_id', clubId)
    .not('ended_at', 'is', null)
    .order('ended_at', { ascending: false });
  if (histError) throw histError;

  const memberIds = (members ?? []).map((m: any) => m.user_id);
  const progressMap = new Map<string, number>();
  if (currentBookRow && memberIds.length > 0) {
    const { data: userBooks, error: ubError } = await supabase
      .from('user_books')
      .select('user_id, current_page')
      .eq('book_id', (currentBookRow as any).book_id)
      .in('user_id', memberIds);
    if (ubError) throw ubError;
    (userBooks ?? []).forEach((ub: any) => progressMap.set(ub.user_id, ub.current_page));
  }

  const pageCount = (currentBookRow as any)?.book?.page_count ?? null;

  return {
    id: (club as any).id,
    name: (club as any).name,
    description: (club as any).description,
    ownerId: (club as any).owner_id,
    currentBook: currentBookRow
      ? {
          id: (currentBookRow as any).id,
          bookId: (currentBookRow as any).book_id,
          bookTitle: (currentBookRow as any).book.title,
          bookCoverUrl: (currentBookRow as any).book.cover_url,
          startedAt: (currentBookRow as any).started_at,
          endedAt: null,
        }
      : null,
    members: (members ?? []).map((m: any) => ({
      userId: m.user_id,
      username: m.user.username,
      role: m.role as 'owner' | 'member',
      currentPage: progressMap.get(m.user_id) ?? 0,
      pageCount,
    })),
    history: (historyRows ?? []).map((h: any) => ({
      id: h.id,
      bookId: h.book_id,
      bookTitle: h.book.title,
      bookCoverUrl: h.book.cover_url,
      startedAt: h.started_at,
      endedAt: h.ended_at,
    })),
  };
}

export async function createClub(
  userId: string,
  name: string,
  description?: string
): Promise<string> {
  const { data, error } = await supabase
    .from('book_clubs')
    .insert({ owner_id: userId, name, description: description ?? null })
    .select('id')
    .single();
  if (error) throw error;

  await supabase
    .from('club_members')
    .insert({ club_id: (data as any).id, user_id: userId, role: 'owner' });

  return (data as any).id;
}

export async function addMember(clubId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('club_members')
    .insert({ club_id: clubId, user_id: userId, role: 'member' });
  if (error) throw error;
}

export async function removeMember(clubId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('club_members')
    .delete()
    .eq('club_id', clubId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function setCurrentBook(
  clubId: string,
  bookId: string,
  addedBy: string
): Promise<void> {
  await supabase
    .from('club_books')
    .update({ ended_at: new Date().toISOString() })
    .eq('club_id', clubId)
    .is('ended_at', null);

  const { error } = await supabase
    .from('club_books')
    .insert({ club_id: clubId, book_id: bookId, added_by: addedBy });
  if (error) throw error;
}

export async function getPosts(clubId: string): Promise<ClubPost[]> {
  const { data, error } = await supabase
    .from('club_posts')
    .select(
      'id, club_id, user_id, body, parent_id, created_at, user:profiles!user_id(username), replies:club_posts!parent_id(count)'
    )
    .eq('club_id', clubId)
    .is('parent_id', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((p: any) => ({
    id: p.id,
    clubId: p.club_id,
    userId: p.user_id,
    username: p.user.username,
    body: p.body,
    parentId: null,
    replyCount: p.replies?.[0]?.count ?? 0,
    createdAt: p.created_at,
  }));
}

export async function getThread(
  postId: string
): Promise<{ parent: ClubPost; replies: ClubPost[] }> {
  const { data: parent, error: parentError } = await supabase
    .from('club_posts')
    .select('id, club_id, user_id, body, parent_id, created_at, user:profiles!user_id(username)')
    .eq('id', postId)
    .single();
  if (parentError) throw parentError;

  const { data: replies, error: repliesError } = await supabase
    .from('club_posts')
    .select('id, club_id, user_id, body, parent_id, created_at, user:profiles!user_id(username)')
    .eq('parent_id', postId)
    .order('created_at', { ascending: true });
  if (repliesError) throw repliesError;

  const mapPost = (p: any): ClubPost => ({
    id: p.id,
    clubId: p.club_id,
    userId: p.user_id,
    username: p.user.username,
    body: p.body,
    parentId: p.parent_id,
    replyCount: 0,
    createdAt: p.created_at,
  });

  return {
    parent: mapPost(parent),
    replies: (replies ?? []).map(mapPost),
  };
}

export async function addPost(
  clubId: string,
  userId: string,
  body: string,
  parentId?: string
): Promise<ClubPost> {
  const { data, error } = await supabase
    .from('club_posts')
    .insert({ club_id: clubId, user_id: userId, body, parent_id: parentId ?? null })
    .select('id, club_id, user_id, body, parent_id, created_at, user:profiles!user_id(username)')
    .single();
  if (error) throw error;
  return {
    id: (data as any).id,
    clubId: (data as any).club_id,
    userId: (data as any).user_id,
    username: (data as any).user.username,
    body: (data as any).body,
    parentId: (data as any).parent_id,
    replyCount: 0,
    createdAt: (data as any).created_at,
  };
}

export async function deletePost(postId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('club_posts')
    .delete()
    .eq('id', postId)
    .eq('user_id', userId);
  if (error) throw error;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/lib/clubs.test.ts --no-coverage 2>&1 | tail -15
```

Expected: PASS — 12 tests passing, 0 failing

- [ ] **Step 5: Commit**

```bash
git add lib/clubs.ts __tests__/lib/clubs.test.ts
git commit -m "feat: add lib/clubs.ts data layer with tests"
```

---

## Task 3: Fix `getFeed` to include own events

**Files:**
- Modify: `lib/activity.ts` (line 40–41)
- Modify: `__tests__/lib/activity.test.ts`

### Context

`getFeed` currently fetches events only for followed users. If the user follows nobody, it returns early with `[]`. If they do follow people, their own events are not included. The fix: change the early return and the `in` filter to also include `userId`.

- [ ] **Step 1: Add a failing test**

In `__tests__/lib/activity.test.ts`, add a new `describe` block after the existing `getFeed` tests:

```typescript
describe('getFeed includes own events', () => {
  it("includes the requesting user's own events even if they follow nobody", async () => {
    const { supabase } = require('@/lib/supabase');
    const ownEvent = {
      id: 'evt-own',
      event_type: 'started_book',
      book_id: 'book-1',
      metadata: {},
      created_at: '2026-04-11T10:00:00Z',
      actor: { id: 'user-1', username: 'me' },
      book: { id: 'book-1', title: 'Dune', cover_url: null },
      likes: [{ count: 0 }],
      comments: [{ count: 0 }],
    };
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'follows') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn(() => Promise.resolve({ data: [], error: null })),
        };
      }
      if (table === 'activity_events') {
        return {
          select: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn(() => Promise.resolve({ data: [ownEvent], error: null })),
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
    expect(result[0].actorUsername).toBe('me');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/lib/activity.test.ts --no-coverage -t "includes the requesting" 2>&1 | tail -10
```

Expected: FAIL — `getFeed` returns `[]` when followingIds is empty

- [ ] **Step 3: Fix `lib/activity.ts`**

Replace lines 39–41 in `lib/activity.ts`:

```typescript
  // BEFORE:
  const followingIds = (followsData ?? []).map((r: any) => r.following_id);
  if (followingIds.length === 0) return [];
```

```typescript
  // AFTER:
  const followingIds = (followsData ?? []).map((r: any) => r.following_id);
  const actorIds = [...new Set([...followingIds, userId])];
```

Then on line 52, change `.in('actor_id', followingIds)` to `.in('actor_id', actorIds)`.

The updated `getFeed` function body (lines 32–82 approximately) should be:

```typescript
export async function getFeed(userId: string): Promise<ActivityEvent[]> {
  // 1. Get following IDs
  const { data: followsData, error: followsError } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId);
  if (followsError) throw followsError;
  const followingIds = (followsData ?? []).map((r: any) => r.following_id);
  const actorIds = [...new Set([...followingIds, userId])];

  // 2. Get events from followed users + self
  const { data: eventsData, error: eventsError } = await supabase
    .from('activity_events')
    .select(
      `id, event_type, book_id, metadata, created_at,
       actor:profiles!actor_id(id, username),
       book:books!book_id(id, title, cover_url),
       likes:activity_likes(count),
       comments:activity_comments(count)`
    )
    .in('actor_id', actorIds)
    .order('created_at', { ascending: false })
    .limit(50);
  if (eventsError) throw eventsError;
  const events = eventsData ?? [];

  if (events.length === 0) return [];

  // 3. Get liked event IDs for current user
  const eventIds = events.map((e: any) => e.id);
  const { data: likesData, error: likesError } = await supabase
    .from('activity_likes')
    .select('event_id')
    .eq('user_id', userId)
    .in('event_id', eventIds);
  if (likesError) throw likesError;
  const likedSet = new Set((likesData ?? []).map((r: any) => r.event_id));

  return events.map((e: any) => ({
    id: e.id,
    actorId: e.actor.id,
    actorUsername: e.actor.username,
    eventType: e.event_type as EventType,
    bookId: e.book_id,
    bookTitle: e.book.title,
    bookCoverUrl: e.book.cover_url,
    metadata: e.metadata,
    createdAt: e.created_at,
    likeCount: e.likes?.[0]?.count ?? 0,
    commentCount: e.comments?.[0]?.count ?? 0,
    likedByMe: likedSet.has(e.id),
  }));
}
```

- [ ] **Step 4: Run all activity tests**

```bash
npx jest __tests__/lib/activity.test.ts --no-coverage 2>&1 | tail -10
```

Expected: PASS — all tests passing (including the new own-events test)

- [ ] **Step 5: Commit**

```bash
git add lib/activity.ts __tests__/lib/activity.test.ts
git commit -m "fix: include user's own events in getFeed"
```

---

## Task 4: Clubs list screen

**Files:**
- Create: `__tests__/screens/clubs.test.tsx`
- Create: `app/clubs.tsx`

### Context

`app/clubs.tsx` shows a list of the user's clubs and a button to create a new one. On press of a club card, navigate to `/club/${club.id}`. Creating a club shows an inline modal form. Uses `useFocusEffect` to reload on return from club detail. Follows the same screen patterns as `app/(tabs)/social.tsx` and `app/book/[bookId].tsx`.

- [ ] **Step 1: Write failing tests**

Create `__tests__/screens/clubs.test.tsx`:

```typescript
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import ClubsScreen from '@/app/clubs';

jest.mock('@/lib/auth', () => ({
  useAuth: jest.fn(() => ({ session: { user: { id: 'user-1' } } })),
}));

const mockClub = {
  id: 'club-1',
  name: 'Tolkien Fans',
  description: 'We love Tolkien',
  ownerId: 'user-1',
  memberCount: 3,
  currentBookTitle: 'The Hobbit',
  currentBookCoverUrl: null,
};

jest.mock('@/lib/clubs', () => ({
  getMyClubs: jest.fn().mockResolvedValue([]),
  createClub: jest.fn().mockResolvedValue('club-new'),
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
}));

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn((cb) => cb()),
}));

import { getMyClubs, createClub } from '@/lib/clubs';

beforeEach(() => {
  jest.clearAllMocks();
  (getMyClubs as jest.Mock).mockResolvedValue([mockClub]);
  (createClub as jest.Mock).mockResolvedValue('club-new');
});

describe('ClubsScreen', () => {
  it('renders heading', async () => {
    render(<ClubsScreen />);
    await waitFor(() => expect(screen.getByText('My Clubs')).toBeTruthy());
  });

  it('shows empty state when user has no clubs', async () => {
    (getMyClubs as jest.Mock).mockResolvedValue([]);
    render(<ClubsScreen />);
    await waitFor(() =>
      expect(screen.getByText("You're not in any clubs yet.")).toBeTruthy()
    );
  });

  it('renders club card with name and current book', async () => {
    render(<ClubsScreen />);
    await waitFor(() => expect(screen.getByText('Tolkien Fans')).toBeTruthy());
    expect(screen.getByText('The Hobbit')).toBeTruthy();
    expect(screen.getByText('3 members')).toBeTruthy();
  });

  it('tapping a club card navigates to club detail', async () => {
    render(<ClubsScreen />);
    await waitFor(() => screen.getByText('Tolkien Fans'));
    fireEvent.press(screen.getByTestId('club-card-club-1'));
    expect(mockPush).toHaveBeenCalledWith('/club/club-1');
  });

  it('tapping New Club shows create form', async () => {
    render(<ClubsScreen />);
    await waitFor(() => screen.getByText('My Clubs'));
    fireEvent.press(screen.getByTestId('new-club-btn'));
    expect(screen.getByPlaceholderText('Club name')).toBeTruthy();
  });

  it('creating a club calls createClub and reloads list', async () => {
    render(<ClubsScreen />);
    await waitFor(() => screen.getByText('My Clubs'));
    fireEvent.press(screen.getByTestId('new-club-btn'));
    fireEvent.changeText(screen.getByPlaceholderText('Club name'), 'New Club');
    fireEvent.press(screen.getByTestId('create-club-btn'));
    await waitFor(() => expect(createClub).toHaveBeenCalledWith('user-1', 'New Club', ''));
    await waitFor(() => expect(getMyClubs).toHaveBeenCalledTimes(2));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest __tests__/screens/clubs.test.tsx --no-coverage 2>&1 | tail -10
```

Expected: FAIL — "Cannot find module '@/app/clubs'"

- [ ] **Step 3: Create `app/clubs.tsx`**

```typescript
import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@/lib/auth';
import { getMyClubs, createClub, type ClubSummary } from '@/lib/clubs';
import { Colors, Spacing, Radius, Shadow } from '@/constants/theme';

export default function ClubsScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const userId = session?.user.id ?? '';

  const [clubs, setClubs] = useState<ClubSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [clubName, setClubName] = useState('');
  const [clubDesc, setClubDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const loadClubs = useCallback(() => {
    if (!userId) return;
    setLoading(true);
    getMyClubs(userId)
      .then(setClubs)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      loadClubs();
    }, [loadClubs])
  );

  const handleCreate = async () => {
    if (!clubName.trim()) return;
    setCreating(true);
    try {
      await createClub(userId, clubName.trim(), clubDesc.trim());
      setShowCreate(false);
      setClubName('');
      setClubDesc('');
      loadClubs();
    } finally {
      setCreating(false);
    }
  };

  if (!session) return null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Clubs</Text>
        <TouchableOpacity
          style={styles.newBtn}
          onPress={() => setShowCreate(true)}
          testID="new-club-btn"
        >
          <Text style={styles.newBtnText}>+ New Club</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 32 }} />
      ) : clubs.length === 0 ? (
        <Text style={styles.emptyText}>You're not in any clubs yet.</Text>
      ) : (
        <FlatList
          data={clubs}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/club/${item.id}`)}
              testID={`club-card-${item.id}`}
            >
              <Text style={styles.clubName}>{item.name}</Text>
              {item.currentBookTitle ? (
                <Text style={styles.currentBook}>{item.currentBookTitle}</Text>
              ) : (
                <Text style={styles.noBook}>No book selected</Text>
              )}
              <Text style={styles.memberCount}>{item.memberCount} members</Text>
            </TouchableOpacity>
          )}
        />
      )}

      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Club</Text>
            <TouchableOpacity onPress={() => setShowCreate(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Club name"
              placeholderTextColor={Colors.textTertiary}
              value={clubName}
              onChangeText={setClubName}
            />
            <TextInput
              style={[styles.input, styles.descInput]}
              placeholder="Description (optional)"
              placeholderTextColor={Colors.textTertiary}
              value={clubDesc}
              onChangeText={setClubDesc}
              multiline
            />
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={handleCreate}
              disabled={creating}
              testID="create-club-btn"
            >
              <Text style={styles.primaryBtnText}>
                {creating ? 'Creating...' : 'Create Club'}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  title: { fontSize: 24, fontWeight: '700', color: Colors.textPrimary },
  newBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
  },
  newBtnText: { color: Colors.surface, fontWeight: '600', fontSize: 14 },
  list: { padding: Spacing.lg, gap: Spacing.sm },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: 4,
    ...Shadow.card,
  },
  clubName: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  currentBook: { fontSize: 14, color: Colors.primary },
  noBook: { fontSize: 14, color: Colors.textTertiary },
  memberCount: { fontSize: 12, color: Colors.textSecondary },
  emptyText: {
    textAlign: 'center',
    marginTop: 48,
    color: Colors.textSecondary,
    fontSize: 15,
  },
  modal: { flex: 1, backgroundColor: Colors.background },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  cancelText: { color: Colors.primary, fontSize: 16 },
  form: { padding: Spacing.lg, gap: Spacing.sm },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  descInput: { minHeight: 80, textAlignVertical: 'top' },
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  primaryBtnText: { color: Colors.surface, fontSize: 16, fontWeight: '700' },
});
```

- [ ] **Step 4: Run tests**

```bash
npx jest __tests__/screens/clubs.test.tsx --no-coverage 2>&1 | tail -10
```

Expected: PASS — 6 tests passing

- [ ] **Step 5: Commit**

```bash
git add app/clubs.tsx __tests__/screens/clubs.test.tsx
git commit -m "feat: add clubs list screen"
```

---

## Task 5: Club detail screen

**Files:**
- Create: `__tests__/screens/clubDetail.test.tsx`
- Create: `app/club/[clubId]/index.tsx`

### Context

This is the most complex screen. It shows: members with progress %, current book, reading history, and discussion posts — all in a single `ScrollView`. The owner sees "Add member" and "Change book" buttons. Adding a member uses a Modal with username search (calling `searchUsers` from `lib/follows`). Changing the current book uses a Modal with a TextInput + book search via `searchBooks` from `lib/books`. Posting uses an inline Modal. Because `app/club/[clubId]/index.tsx` is in a directory, Expo Router treats it as the index route for `/club/[clubId]`.

- [ ] **Step 1: Write failing tests**

Create `__tests__/screens/clubDetail.test.tsx`:

```typescript
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import ClubDetailScreen from '@/app/club/[clubId]/index';

jest.mock('@/lib/auth', () => ({
  useAuth: jest.fn(() => ({ session: { user: { id: 'user-1' } } })),
}));

const mockClubDetail = {
  id: 'club-1',
  name: 'Tolkien Fans',
  description: 'We love Tolkien',
  ownerId: 'user-1',
  currentBook: {
    id: 'cb-1',
    bookId: 'book-1',
    bookTitle: 'The Hobbit',
    bookCoverUrl: null,
    startedAt: '2026-04-01T00:00:00Z',
    endedAt: null,
  },
  members: [
    { userId: 'user-1', username: 'alice', role: 'owner', currentPage: 50, pageCount: 310 },
    { userId: 'user-2', username: 'bob', role: 'member', currentPage: 100, pageCount: 310 },
  ],
  history: [],
};

const mockPost = {
  id: 'post-1',
  clubId: 'club-1',
  userId: 'user-2',
  username: 'bob',
  body: 'Great chapter!',
  parentId: null,
  replyCount: 1,
  createdAt: '2026-04-11T10:00:00Z',
};

jest.mock('@/lib/clubs', () => ({
  getClub: jest.fn().mockResolvedValue(null),
  addMember: jest.fn().mockResolvedValue(undefined),
  removeMember: jest.fn().mockResolvedValue(undefined),
  setCurrentBook: jest.fn().mockResolvedValue(undefined),
  getPosts: jest.fn().mockResolvedValue([]),
  addPost: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/lib/follows', () => ({
  searchUsers: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/lib/books', () => ({
  searchBooks: jest.fn().mockResolvedValue([]),
}));

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
  useLocalSearchParams: () => ({ clubId: 'club-1' }),
}));

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn((cb) => cb()),
}));

import { getClub, getPosts, addPost } from '@/lib/clubs';

beforeEach(() => {
  jest.clearAllMocks();
  (getClub as jest.Mock).mockResolvedValue(mockClubDetail);
  (getPosts as jest.Mock).mockResolvedValue([mockPost]);
  (addPost as jest.Mock).mockResolvedValue({
    ...mockPost,
    id: 'post-new',
    body: 'My post',
    userId: 'user-1',
    username: 'alice',
  });
});

describe('ClubDetailScreen', () => {
  it('renders club name', async () => {
    render(<ClubDetailScreen />);
    await waitFor(() => expect(screen.getByText('Tolkien Fans')).toBeTruthy());
  });

  it('shows current book title', async () => {
    render(<ClubDetailScreen />);
    await waitFor(() => expect(screen.getByText('The Hobbit')).toBeTruthy());
  });

  it('shows all members with username', async () => {
    render(<ClubDetailScreen />);
    await waitFor(() => {
      expect(screen.getByText('alice')).toBeTruthy();
      expect(screen.getByText('bob')).toBeTruthy();
    });
  });

  it('shows member progress percentage', async () => {
    render(<ClubDetailScreen />);
    await waitFor(() => {
      // alice: 50/310 = 16%
      expect(screen.getByText('16%')).toBeTruthy();
      // bob: 100/310 = 32%
      expect(screen.getByText('32%')).toBeTruthy();
    });
  });

  it('shows posts', async () => {
    render(<ClubDetailScreen />);
    await waitFor(() => expect(screen.getByText('Great chapter!')).toBeTruthy());
  });

  it('owner sees Add member button', async () => {
    render(<ClubDetailScreen />);
    await waitFor(() =>
      expect(screen.getByTestId('add-member-btn')).toBeTruthy()
    );
  });

  it('non-owner does not see Add member button', async () => {
    (getClub as jest.Mock).mockResolvedValue({
      ...mockClubDetail,
      ownerId: 'user-99',
    });
    render(<ClubDetailScreen />);
    await waitFor(() => screen.getByText('Tolkien Fans'));
    expect(screen.queryByTestId('add-member-btn')).toBeNull();
  });

  it('tapping a post navigates to thread', async () => {
    render(<ClubDetailScreen />);
    await waitFor(() => screen.getByText('Great chapter!'));
    fireEvent.press(screen.getByTestId('post-card-post-1'));
    expect(mockPush).toHaveBeenCalledWith('/club/club-1/post/post-1');
  });

  it('tapping New Post opens modal', async () => {
    render(<ClubDetailScreen />);
    await waitFor(() => screen.getByTestId('new-post-btn'));
    fireEvent.press(screen.getByTestId('new-post-btn'));
    expect(screen.getByPlaceholderText('Write a post...')).toBeTruthy();
  });

  it('submitting new post calls addPost and appends to list', async () => {
    render(<ClubDetailScreen />);
    await waitFor(() => screen.getByTestId('new-post-btn'));
    fireEvent.press(screen.getByTestId('new-post-btn'));
    fireEvent.changeText(screen.getByPlaceholderText('Write a post...'), 'My post');
    fireEvent.press(screen.getByTestId('submit-post-btn'));
    await waitFor(() =>
      expect(addPost).toHaveBeenCalledWith('club-1', 'user-1', 'My post', undefined)
    );
    await waitFor(() => expect(screen.getByText('My post')).toBeTruthy());
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest __tests__/screens/clubDetail.test.tsx --no-coverage 2>&1 | tail -10
```

Expected: FAIL — "Cannot find module '@/app/club/[clubId]/index'"

- [ ] **Step 3: Create directory and screen**

First make the directory:

```bash
mkdir -p app/club/\[clubId\]/post
```

Then create `app/club/[clubId]/index.tsx`:

```typescript
import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import {
  getClub,
  addMember,
  setCurrentBook,
  getPosts,
  addPost,
  type ClubDetail,
  type ClubPost,
} from '@/lib/clubs';
import { searchUsers, type UserSearchResult } from '@/lib/follows';
import { searchBooks, type BookSearchResult } from '@/lib/books';
import { Colors, Spacing, Radius, Shadow } from '@/constants/theme';

function pct(current: number, total: number | null): string {
  if (!total) return '—';
  return `${Math.round((current / total) * 100)}%`;
}

export default function ClubDetailScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const { clubId } = useLocalSearchParams<{ clubId: string }>();
  const userId = session?.user.id ?? '';

  const [club, setClub] = useState<ClubDetail | null>(null);
  const [posts, setPosts] = useState<ClubPost[]>([]);
  const [loading, setLoading] = useState(true);

  // New post modal
  const [showPostModal, setShowPostModal] = useState(false);
  const [postBody, setPostBody] = useState('');

  // Add member modal
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberResults, setMemberResults] = useState<UserSearchResult[]>([]);

  // Change book modal
  const [showBookModal, setShowBookModal] = useState(false);
  const [bookSearch, setBookSearch] = useState('');
  const [bookResults, setBookResults] = useState<BookSearchResult[]>([]);

  const loadData = useCallback(() => {
    if (!clubId) return;
    setLoading(true);
    Promise.all([getClub(clubId), getPosts(clubId)])
      .then(([clubData, postsData]) => {
        setClub(clubData);
        setPosts(postsData);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [clubId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleSearchMembers = async (query: string) => {
    setMemberSearch(query);
    if (!query.trim()) { setMemberResults([]); return; }
    const results = await searchUsers(query.trim(), userId);
    setMemberResults(results);
  };

  const handleAddMember = async (user: UserSearchResult) => {
    try {
      await addMember(clubId, user.id);
      setShowMemberModal(false);
      setMemberSearch('');
      setMemberResults([]);
      loadData();
    } catch {
      Alert.alert('Error', 'Could not add member.');
    }
  };

  const handleSearchBooks = async (query: string) => {
    setBookSearch(query);
    if (!query.trim()) { setBookResults([]); return; }
    const results = await searchBooks(query.trim());
    setBookResults(results);
  };

  const handleSetBook = async (book: BookSearchResult) => {
    try {
      await setCurrentBook(clubId, book.google_books_id, userId);
      setShowBookModal(false);
      setBookSearch('');
      setBookResults([]);
      loadData();
    } catch {
      Alert.alert('Error', 'Could not change book.');
    }
  };

  const handleSubmitPost = async () => {
    if (!postBody.trim()) return;
    try {
      const newPost = await addPost(clubId, userId, postBody.trim(), undefined);
      setPosts((prev) => [newPost, ...prev]);
      setPostBody('');
      setShowPostModal(false);
    } catch {
      Alert.alert('Error', 'Could not post.');
    }
  };

  if (!session) return null;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (!club) {
    return (
      <SafeAreaView style={styles.container}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={Colors.primary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <View style={styles.center}>
          <Text style={styles.notFound}>Club not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isOwner = club.ownerId === userId;

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={24} color={Colors.primary} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Club header */}
        <Text style={styles.title}>{club.name}</Text>
        {club.description ? (
          <Text style={styles.description}>{club.description}</Text>
        ) : null}

        {/* Members */}
        <Text style={styles.sectionTitle}>Members</Text>
        {club.members.map((m) => (
          <View key={m.userId} style={styles.memberRow}>
            <View style={styles.memberAvatar}>
              <Text style={styles.memberInitial}>{m.username.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.memberName}>{m.username}</Text>
              <Text style={styles.memberRole}>{m.role}</Text>
            </View>
            <Text style={styles.memberPct}>{pct(m.currentPage, m.pageCount)}</Text>
          </View>
        ))}

        {isOwner && (
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => setShowMemberModal(true)}
            testID="add-member-btn"
          >
            <Text style={styles.secondaryBtnText}>+ Add Member</Text>
          </TouchableOpacity>
        )}

        {/* Current book */}
        <Text style={styles.sectionTitle}>Currently Reading</Text>
        {club.currentBook ? (
          <View style={styles.bookRow}>
            <Text style={styles.bookTitle}>{club.currentBook.bookTitle}</Text>
            {isOwner && (
              <TouchableOpacity
                onPress={() => setShowBookModal(true)}
                testID="change-book-btn"
              >
                <Text style={styles.changeBookText}>Change</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.bookRow}>
            <Text style={styles.noBookText}>No book selected</Text>
            {isOwner && (
              <TouchableOpacity
                onPress={() => setShowBookModal(true)}
                testID="change-book-btn"
              >
                <Text style={styles.changeBookText}>Select book</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* History */}
        {club.history.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Reading History</Text>
            {club.history.map((h) => (
              <Text key={h.id} style={styles.historyItem}>{h.bookTitle}</Text>
            ))}
          </>
        )}

        {/* Discussion */}
        <View style={styles.discussionHeader}>
          <Text style={styles.sectionTitle}>Discussion</Text>
          <TouchableOpacity testID="new-post-btn" onPress={() => setShowPostModal(true)}>
            <Text style={styles.newPostText}>+ New Post</Text>
          </TouchableOpacity>
        </View>

        {posts.length === 0 ? (
          <Text style={styles.emptyText}>No posts yet. Start the conversation!</Text>
        ) : (
          posts.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={styles.postCard}
              testID={`post-card-${p.id}`}
              onPress={() => router.push(`/club/${clubId}/post/${p.id}`)}
            >
              <Text style={styles.postUsername}>{p.username}</Text>
              <Text style={styles.postBody} numberOfLines={3}>{p.body}</Text>
              <Text style={styles.replyCount}>{p.replyCount} replies</Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* New post modal */}
      <Modal visible={showPostModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Post</Text>
            <TouchableOpacity onPress={() => setShowPostModal(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.modalBody}>
            <TextInput
              style={[styles.input, styles.postInput]}
              placeholder="Write a post..."
              placeholderTextColor={Colors.textTertiary}
              value={postBody}
              onChangeText={setPostBody}
              multiline
              autoFocus
            />
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={handleSubmitPost}
              testID="submit-post-btn"
            >
              <Text style={styles.primaryBtnText}>Post</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Add member modal */}
      <Modal visible={showMemberModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Member</Text>
            <TouchableOpacity onPress={() => setShowMemberModal(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.modalBody}>
            <TextInput
              style={styles.input}
              placeholder="Search by username..."
              placeholderTextColor={Colors.textTertiary}
              value={memberSearch}
              onChangeText={handleSearchMembers}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {memberResults.map((u) => (
              <TouchableOpacity
                key={u.id}
                style={styles.searchResult}
                onPress={() => handleAddMember(u)}
                testID={`add-user-${u.id}`}
              >
                <Text style={styles.searchResultText}>{u.username}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </SafeAreaView>
      </Modal>

      {/* Change book modal */}
      <Modal visible={showBookModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Book</Text>
            <TouchableOpacity onPress={() => setShowBookModal(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.modalBody}>
            <TextInput
              style={styles.input}
              placeholder="Search books..."
              placeholderTextColor={Colors.textTertiary}
              value={bookSearch}
              onChangeText={handleSearchBooks}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {bookResults.map((b) => (
              <TouchableOpacity
                key={b.google_books_id}
                style={styles.searchResult}
                onPress={() => handleSetBook(b)}
                testID={`book-result-${b.google_books_id}`}
              >
                <Text style={styles.searchResultText}>{b.title}</Text>
                <Text style={styles.searchResultSub}>{b.author}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    gap: 4,
  },
  backText: { color: Colors.primary, fontSize: 16, fontWeight: '600' },
  scroll: { padding: Spacing.lg, gap: Spacing.md },
  title: { fontSize: 24, fontWeight: '700', color: Colors.textPrimary },
  description: { fontSize: 14, color: Colors.textSecondary },
  notFound: { fontSize: 16, color: Colors.textSecondary },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, marginTop: Spacing.sm },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberInitial: { color: Colors.surface, fontWeight: '700', fontSize: 14 },
  memberName: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  memberRole: { fontSize: 12, color: Colors.textSecondary },
  memberPct: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  secondaryBtn: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryBtnText: { color: Colors.primary, fontWeight: '600', fontSize: 15 },
  bookRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bookTitle: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary, flex: 1 },
  noBookText: { fontSize: 15, color: Colors.textTertiary, flex: 1 },
  changeBookText: { color: Colors.primary, fontSize: 14, fontWeight: '600' },
  historyItem: { fontSize: 14, color: Colors.textSecondary },
  discussionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
  },
  newPostText: { color: Colors.primary, fontWeight: '600', fontSize: 14 },
  emptyText: { fontSize: 14, color: Colors.textSecondary },
  postCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: 4,
    ...Shadow.card,
  },
  postUsername: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  postBody: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  replyCount: { fontSize: 12, color: Colors.textTertiary },
  modal: { flex: 1, backgroundColor: Colors.background },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  cancelText: { color: Colors.primary, fontSize: 16 },
  modalBody: { padding: Spacing.lg, gap: Spacing.sm },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  postInput: { minHeight: 120, textAlignVertical: 'top' },
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { color: Colors.surface, fontSize: 16, fontWeight: '700' },
  searchResult: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchResultText: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  searchResultSub: { fontSize: 13, color: Colors.textSecondary },
});
```

- [ ] **Step 4: Run tests**

```bash
npx jest __tests__/screens/clubDetail.test.tsx --no-coverage 2>&1 | tail -10
```

Expected: PASS — 10 tests passing

- [ ] **Step 5: Commit**

```bash
git add "app/club/[clubId]/index.tsx" __tests__/screens/clubDetail.test.tsx
git commit -m "feat: add club detail screen"
```

---

## Task 6: Post thread screen

**Files:**
- Create: `__tests__/screens/clubPost.test.tsx`
- Create: `app/club/[clubId]/post/[postId].tsx`

### Context

Shows a parent post at the top and its replies below, oldest first. A pinned reply `TextInput` at the bottom calls `addPost` with `parentId` set to the post ID. Params accessed via `useLocalSearchParams<{ clubId: string; postId: string }>()`.

- [ ] **Step 1: Write failing tests**

Create `__tests__/screens/clubPost.test.tsx`:

```typescript
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import ClubPostScreen from '@/app/club/[clubId]/post/[postId]';

jest.mock('@/lib/auth', () => ({
  useAuth: jest.fn(() => ({ session: { user: { id: 'user-1' } } })),
}));

const mockParent = {
  id: 'post-1',
  clubId: 'club-1',
  userId: 'user-2',
  username: 'bob',
  body: 'Top post body',
  parentId: null,
  replyCount: 1,
  createdAt: '2026-04-11T10:00:00Z',
};

const mockReply = {
  id: 'post-2',
  clubId: 'club-1',
  userId: 'user-1',
  username: 'alice',
  body: 'A reply here',
  parentId: 'post-1',
  replyCount: 0,
  createdAt: '2026-04-11T10:05:00Z',
};

jest.mock('@/lib/clubs', () => ({
  getThread: jest.fn().mockResolvedValue({ parent: null, replies: [] }),
  addPost: jest.fn().mockResolvedValue(null),
}));

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
  useLocalSearchParams: () => ({ clubId: 'club-1', postId: 'post-1' }),
}));

import { getThread, addPost } from '@/lib/clubs';

beforeEach(() => {
  jest.clearAllMocks();
  (getThread as jest.Mock).mockResolvedValue({
    parent: mockParent,
    replies: [mockReply],
  });
  (addPost as jest.Mock).mockResolvedValue({
    id: 'post-3',
    clubId: 'club-1',
    userId: 'user-1',
    username: 'alice',
    body: 'New reply',
    parentId: 'post-1',
    replyCount: 0,
    createdAt: '2026-04-11T11:00:00Z',
  });
});

describe('ClubPostScreen', () => {
  it('shows parent post body', async () => {
    render(<ClubPostScreen />);
    await waitFor(() => expect(screen.getByText('Top post body')).toBeTruthy());
  });

  it('shows replies below parent', async () => {
    render(<ClubPostScreen />);
    await waitFor(() => expect(screen.getByText('A reply here')).toBeTruthy());
  });

  it('reply input is visible', async () => {
    render(<ClubPostScreen />);
    await waitFor(() =>
      expect(screen.getByPlaceholderText('Write a reply...')).toBeTruthy()
    );
  });

  it('submitting a reply calls addPost with parentId and appends to list', async () => {
    render(<ClubPostScreen />);
    await waitFor(() => screen.getByPlaceholderText('Write a reply...'));
    fireEvent.changeText(screen.getByPlaceholderText('Write a reply...'), 'New reply');
    fireEvent.press(screen.getByTestId('send-reply-btn'));
    await waitFor(() =>
      expect(addPost).toHaveBeenCalledWith('club-1', 'user-1', 'New reply', 'post-1')
    );
    await waitFor(() => expect(screen.getByText('New reply')).toBeTruthy());
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest __tests__/screens/clubPost.test.tsx --no-coverage 2>&1 | tail -10
```

Expected: FAIL — "Cannot find module '@/app/club/[clubId]/post/[postId]'"

- [ ] **Step 3: Create `app/club/[clubId]/post/[postId].tsx`**

```typescript
import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { getThread, addPost, type ClubPost } from '@/lib/clubs';
import { Colors, Spacing, Radius, Shadow } from '@/constants/theme';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function ClubPostScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const { clubId, postId } = useLocalSearchParams<{ clubId: string; postId: string }>();
  const userId = session?.user.id ?? '';

  const [parent, setParent] = useState<ClubPost | null>(null);
  const [replies, setReplies] = useState<ClubPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');

  useEffect(() => {
    getThread(postId)
      .then(({ parent: p, replies: r }) => {
        setParent(p);
        setReplies(r);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [postId]);

  const handleSendReply = async () => {
    if (!replyText.trim()) return;
    const body = replyText.trim();
    setReplyText('');
    const newReply = await addPost(clubId, userId, body, postId);
    setReplies((prev) => [...prev, newReply]);
  };

  if (!session) return null;

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={24} color={Colors.primary} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
          >
            {/* Parent post */}
            {parent && (
              <View style={styles.parentCard}>
                <Text style={styles.postUsername}>{parent.username}</Text>
                <Text style={styles.parentBody}>{parent.body}</Text>
                <Text style={styles.timestamp}>{timeAgo(parent.createdAt)}</Text>
              </View>
            )}

            {/* Replies */}
            {replies.length === 0 ? (
              <Text style={styles.emptyText}>No replies yet.</Text>
            ) : (
              replies.map((r) => (
                <View key={r.id} style={styles.replyCard}>
                  <Text style={styles.postUsername}>{r.username}</Text>
                  <Text style={styles.replyBody}>{r.body}</Text>
                  <Text style={styles.timestamp}>{timeAgo(r.createdAt)}</Text>
                </View>
              ))
            )}
          </ScrollView>
        )}

        {/* Pinned reply input */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Write a reply..."
            placeholderTextColor={Colors.textTertiary}
            value={replyText}
            onChangeText={setReplyText}
          />
          <TouchableOpacity onPress={handleSendReply} testID="send-reply-btn">
            <Ionicons name="send" size={22} color={Colors.primary} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    gap: 4,
  },
  backText: { color: Colors.primary, fontSize: 16, fontWeight: '600' },
  scroll: { padding: Spacing.lg, gap: Spacing.md },
  parentCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: 6,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
    ...Shadow.card,
  },
  replyCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: 4,
    marginLeft: Spacing.lg,
    ...Shadow.card,
  },
  postUsername: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  parentBody: { fontSize: 16, color: Colors.textPrimary, lineHeight: 22 },
  replyBody: { fontSize: 14, color: Colors.textPrimary, lineHeight: 20 },
  timestamp: { fontSize: 11, color: Colors.textTertiary },
  emptyText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginTop: 24 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
});
```

- [ ] **Step 4: Run tests**

```bash
npx jest __tests__/screens/clubPost.test.tsx --no-coverage 2>&1 | tail -10
```

Expected: PASS — 4 tests passing

- [ ] **Step 5: Commit**

```bash
git add "app/club/[clubId]/post/[postId].tsx" __tests__/screens/clubPost.test.tsx
git commit -m "feat: add club post thread screen"
```

---

## Task 7: Social tab "Clubs" button + full test run

**Files:**
- Modify: `app/(tabs)/social.tsx`
- Modify: `__tests__/screens/social.test.tsx`

### Context

Add a "Clubs" button to the Social screen header that navigates to `/clubs`. The existing header has a `<Text style={styles.title}>Social</Text>` element. Wrap it in a `View` alongside the new button. Then add two tests to the social test file.

- [ ] **Step 1: Add failing tests**

In `__tests__/screens/social.test.tsx`, append a new `describe` block after the last one:

```typescript
describe('Clubs navigation', () => {
  it('Clubs button is visible', async () => {
    render(<SocialScreen />);
    await waitFor(() => expect(screen.getByTestId('clubs-btn')).toBeTruthy());
  });

  it('tapping Clubs button navigates to /clubs', async () => {
    render(<SocialScreen />);
    await waitFor(() => screen.getByTestId('clubs-btn'));
    fireEvent.press(screen.getByTestId('clubs-btn'));
    expect(mockPush).toHaveBeenCalledWith('/clubs');
  });
});
```

Also add `mockPush` to the router mock if it isn't already there. Open `__tests__/screens/social.test.tsx` and check the `expo-router` mock — it should have `push: mockPush`. If only `back` is mocked, update it:

```typescript
const mockPush = jest.fn();
// ...
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush }),
}));
```

- [ ] **Step 2: Run tests to verify new tests fail**

```bash
npx jest __tests__/screens/social.test.tsx --no-coverage -t "Clubs" 2>&1 | tail -10
```

Expected: FAIL — "clubs-btn" not found

- [ ] **Step 3: Modify `app/(tabs)/social.tsx` header**

Find the existing Social title (around line 337 in the current file):

```typescript
        <Text style={styles.title}>Social</Text>
```

Replace it with:

```typescript
        <View style={styles.titleRow}>
          <Text style={styles.title}>Social</Text>
          <TouchableOpacity
            onPress={() => router.push('/clubs')}
            testID="clubs-btn"
          >
            <Text style={styles.clubsLink}>Clubs</Text>
          </TouchableOpacity>
        </View>
```

Then add the new styles to the `StyleSheet.create` call in `social.tsx`:

```typescript
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  clubsLink: {
    color: Colors.primary,
    fontWeight: '600',
    fontSize: 15,
  },
```

Also ensure `router.push` is available — `useRouter` is already imported. Also remove the existing `marginBottom` from `styles.title` if it exists, or keep both; the `titleRow` handles spacing.

- [ ] **Step 4: Run all tests**

```bash
npx jest --no-coverage 2>&1 | tail -20
```

Expected: All test suites passing. The output should show 0 failures across all test files.

- [ ] **Step 5: Commit**

```bash
git add "app/(tabs)/social.tsx" __tests__/screens/social.test.tsx
git commit -m "feat: add Clubs button to Social tab header"
```

---

## Final check

After all tasks are complete, verify the full test suite one more time:

```bash
npx jest --no-coverage 2>&1 | grep -E "Tests:|Test Suites:"
```

Expected output (numbers will vary):
```
Test Suites: N passed, N total
Tests:       N passed, N total
```
