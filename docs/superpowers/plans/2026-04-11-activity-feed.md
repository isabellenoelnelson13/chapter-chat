# Activity Feed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a friends' activity feed to the Social tab with milestone auto-events, shared sessions, likes, and comments.

**Architecture:** Pull-on-demand via three new Supabase tables (`activity_events`, `activity_likes`, `activity_comments`). A new `lib/activity.ts` handles all data access. Auto-events fire from `app/book/[bookId].tsx` after `moveShelf`; shared sessions fire from the session finish phase and book detail screen.

**Tech Stack:** Expo Router, React Native, Supabase, `@expo/vector-icons` (Ionicons), `constants/theme.ts` tokens.

---

### Task 1: `lib/activity.ts` and unit tests

**Files:**
- Create: `lib/activity.ts`
- Create: `__tests__/lib/activity.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/activity.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest __tests__/lib/activity.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '@/lib/activity'`

- [ ] **Step 3: Implement `lib/activity.ts`**

Create `lib/activity.ts`:

```typescript
import { supabase } from './supabase';

export type EventType =
  | 'started_book'
  | 'finished_book'
  | 'added_to_shelf'
  | 'shared_session';

export interface ActivityEvent {
  id: string;
  actorId: string;
  actorUsername: string;
  eventType: EventType;
  bookId: string;
  bookTitle: string;
  bookCoverUrl: string | null;
  metadata: Record<string, any>;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
}

export interface ActivityComment {
  id: string;
  userId: string;
  username: string;
  body: string;
  createdAt: string;
}

export async function getFeed(userId: string): Promise<ActivityEvent[]> {
  // 1. Get following IDs
  const { data: followsData, error: followsError } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId);
  if (followsError) throw followsError;
  const followingIds = (followsData ?? []).map((r: any) => r.following_id);
  if (followingIds.length === 0) return [];

  // 2. Get events from followed users
  const { data: eventsData, error: eventsError } = await supabase
    .from('activity_events')
    .select(
      `id, event_type, book_id, metadata, created_at,
       actor:profiles!actor_id(id, username),
       book:books!book_id(id, title, cover_url),
       likes:activity_likes(count),
       comments:activity_comments(count)`
    )
    .in('actor_id', followingIds)
    .order('created_at', { ascending: false })
    .limit(50);
  if (eventsError) throw eventsError;
  const events = eventsData ?? [];

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

export async function createEvent(
  actorId: string,
  eventType: EventType,
  bookId: string,
  metadata: Record<string, any>
): Promise<void> {
  const { error } = await supabase
    .from('activity_events')
    .insert({ actor_id: actorId, event_type: eventType, book_id: bookId, metadata });
  if (error) throw error;
}

export async function likeEvent(userId: string, eventId: string): Promise<void> {
  const { error } = await supabase
    .from('activity_likes')
    .insert({ event_id: eventId, user_id: userId });
  if (error) throw error;
}

export async function unlikeEvent(userId: string, eventId: string): Promise<void> {
  const { error } = await supabase
    .from('activity_likes')
    .delete()
    .eq('event_id', eventId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function getComments(eventId: string): Promise<ActivityComment[]> {
  const { data, error } = await supabase
    .from('activity_comments')
    .select('id, user_id, body, created_at, user:profiles!user_id(username)')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    userId: r.user_id,
    username: r.user.username,
    body: r.body,
    createdAt: r.created_at,
  }));
}

export async function addComment(
  userId: string,
  eventId: string,
  body: string
): Promise<ActivityComment> {
  const { data, error } = await supabase
    .from('activity_comments')
    .insert({ event_id: eventId, user_id: userId, body })
    .select('id, user_id, body, created_at, user:profiles!user_id(username)')
    .single();
  if (error) throw error;
  return {
    id: data.id,
    userId: data.user_id,
    username: data.user.username,
    body: data.body,
    createdAt: data.created_at,
  };
}
```

- [ ] **Step 4: Run tests and confirm they pass**

```bash
npx jest __tests__/lib/activity.test.ts --no-coverage
```

Expected: 7 tests pass, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add lib/activity.ts __tests__/lib/activity.test.ts
git commit -m "feat: add lib/activity.ts with getFeed, createEvent, like/unlike, getComments, addComment"
```

---

### Task 2: Social tab — feed, FeedCard, comments modal

**Files:**
- Modify: `app/(tabs)/social.tsx`
- Modify: `__tests__/screens/social.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add these tests to `__tests__/screens/social.test.tsx`. The file already has its mock setup; add a new `jest.mock('@/lib/activity', ...)` block and the new `describe` block.

At the top of the file, after the existing `jest.mock('@/lib/follows', ...)` block, add:

```typescript
jest.mock('@/lib/activity', () => ({
  getFeed: jest.fn().mockResolvedValue([]),
  likeEvent: jest.fn().mockResolvedValue(undefined),
  unlikeEvent: jest.fn().mockResolvedValue(undefined),
  getComments: jest.fn().mockResolvedValue([]),
  addComment: jest.fn().mockResolvedValue({
    id: 'c-1', userId: 'user-2', username: 'alice', body: 'Nice!', createdAt: '2026-04-11T10:00:00Z',
  }),
}));
```

Add to the imports at the top:
```typescript
import { getFeed, likeEvent, unlikeEvent } from '@/lib/activity';
```

Add to `beforeEach`:
```typescript
(getFeed as jest.Mock).mockResolvedValue([]);
```

Then add this `describe` block at the bottom of the file:

```typescript
const mockEvent = {
  id: 'evt-1',
  actorId: 'user-2',
  actorUsername: 'alice',
  eventType: 'started_book' as const,
  bookId: 'book-1',
  bookTitle: 'The Hobbit',
  bookCoverUrl: null,
  metadata: {},
  createdAt: '2026-04-11T10:00:00Z',
  likeCount: 0,
  commentCount: 0,
  likedByMe: false,
};

describe('Activity Feed', () => {
  it('renders empty state when feed is empty', async () => {
    render(<SocialScreen />);
    await waitFor(() => {
      expect(screen.getByText('Follow people to see their activity here.')).toBeTruthy();
    });
  });

  it('renders feed card with correct verb for started_book', async () => {
    (getFeed as jest.Mock).mockResolvedValue([mockEvent]);
    render(<SocialScreen />);
    await waitFor(() => {
      expect(screen.getByText(/is now reading/)).toBeTruthy();
      expect(screen.getByText(/The Hobbit/)).toBeTruthy();
    });
  });

  it('renders feed card with correct verb for finished_book', async () => {
    (getFeed as jest.Mock).mockResolvedValue([{
      ...mockEvent,
      id: 'evt-2',
      eventType: 'finished_book',
      metadata: { rating: 4, review_snippet: 'Loved it' },
    }]);
    render(<SocialScreen />);
    await waitFor(() => {
      expect(screen.getByText(/finished/)).toBeTruthy();
      expect(screen.getByText(/Loved it/)).toBeTruthy();
    });
  });

  it('like button shows filled heart when likedByMe is true', async () => {
    (getFeed as jest.Mock).mockResolvedValue([{ ...mockEvent, likedByMe: true, likeCount: 1 }]);
    render(<SocialScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('like-btn-evt-1')).toBeTruthy();
      // heart-sharp = filled heart
      expect(screen.getByTestId('like-btn-evt-1').props.accessibilityLabel).toBe('liked');
    });
  });

  it('tapping like button calls likeEvent', async () => {
    (getFeed as jest.Mock).mockResolvedValue([mockEvent]);
    render(<SocialScreen />);
    await waitFor(() => screen.getByTestId('like-btn-evt-1'));
    fireEvent.press(screen.getByTestId('like-btn-evt-1'));
    await waitFor(() => {
      expect(likeEvent).toHaveBeenCalledWith('user-1', 'evt-1');
    });
  });

  it('tapping comment button opens comments modal', async () => {
    (getFeed as jest.Mock).mockResolvedValue([mockEvent]);
    render(<SocialScreen />);
    await waitFor(() => screen.getByTestId('comment-btn-evt-1'));
    fireEvent.press(screen.getByTestId('comment-btn-evt-1'));
    await waitFor(() => {
      expect(screen.getByText('Comments')).toBeTruthy();
    });
  });

  it('tapping send in comments modal calls addComment', async () => {
    const { addComment } = require('@/lib/activity');
    (getFeed as jest.Mock).mockResolvedValue([mockEvent]);
    render(<SocialScreen />);
    await waitFor(() => screen.getByTestId('comment-btn-evt-1'));
    fireEvent.press(screen.getByTestId('comment-btn-evt-1'));
    await waitFor(() => screen.getByTestId('comment-input'));
    fireEvent.changeText(screen.getByTestId('comment-input'), 'Great book!');
    fireEvent.press(screen.getByTestId('send-comment-btn'));
    await waitFor(() => {
      expect(addComment).toHaveBeenCalledWith('user-1', 'evt-1', 'Great book!');
    });
  });
});
```

- [ ] **Step 2: Run tests to confirm new ones fail**

```bash
npx jest __tests__/screens/social.test.tsx --no-coverage
```

Expected: existing 8 pass, new 7 fail with missing elements/mocks.

- [ ] **Step 3: Rewrite `app/(tabs)/social.tsx`**

```typescript
import { useCallback, useState, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import {
  getFollowing,
  searchUsers,
  followUser,
  unfollowUser,
  cancelFollowRequest,
  type UserSearchResult,
} from '@/lib/follows';
import {
  getFeed,
  likeEvent,
  unlikeEvent,
  getComments,
  addComment,
  type ActivityEvent,
  type ActivityComment,
} from '@/lib/activity';
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

function eventVerb(event: ActivityEvent): string {
  switch (event.eventType) {
    case 'started_book': return 'is now reading';
    case 'finished_book': return 'finished';
    case 'added_to_shelf':
      return event.metadata.shelf === 'want'
        ? 'added to want to read list'
        : 'added to did not finish list';
    case 'shared_session':
      return `read ${event.metadata.pages_read} pages of`;
  }
}

interface CommentsModalProps {
  event: ActivityEvent | null;
  userId: string;
  onClose: () => void;
}

function CommentsModal({ event, userId, onClose }: CommentsModalProps) {
  const [comments, setComments] = useState<ActivityComment[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!event) return;
      setLoading(true);
      getComments(event.id).then((data) => {
        setComments(data);
        setLoading(false);
      });
    }, [event?.id])
  );

  const handleSend = async () => {
    if (!event || !input.trim()) return;
    const body = input.trim();
    setInput('');
    const newComment = await addComment(userId, event.id, body);
    setComments((prev) => [...prev, newComment]);
  };

  return (
    <Modal visible={!!event} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={modalStyles.container}>
        <View style={modalStyles.titleBar}>
          <Text style={modalStyles.title}>Comments</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <ScrollView style={modalStyles.list} contentContainerStyle={modalStyles.listContent}>
          {loading ? (
            <ActivityIndicator color={Colors.primary} />
          ) : comments.length === 0 ? (
            <Text style={modalStyles.empty}>No comments yet. Be the first.</Text>
          ) : (
            comments.map((c) => (
              <View key={c.id} style={modalStyles.commentRow}>
                <View style={modalStyles.commentAvatar}>
                  <Text style={modalStyles.commentInitial}>
                    {c.username.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={modalStyles.commentUsername}>{c.username}</Text>
                  <Text style={modalStyles.commentBody}>{c.body}</Text>
                  <Text style={modalStyles.commentTime}>{timeAgo(c.createdAt)}</Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
        <View style={modalStyles.inputRow}>
          <TextInput
            style={modalStyles.input}
            placeholder="Add a comment..."
            placeholderTextColor={Colors.textTertiary}
            value={input}
            onChangeText={setInput}
            testID="comment-input"
          />
          <TouchableOpacity onPress={handleSend} testID="send-comment-btn">
            <Ionicons name="send" size={22} color={Colors.primary} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function FeedCard({
  event,
  userId,
  onLike,
  onComment,
}: {
  event: ActivityEvent;
  userId: string;
  onLike: () => void;
  onComment: () => void;
}) {
  const router = useRouter();
  const verb = eventVerb(event);

  return (
    <TouchableOpacity
      style={feedStyles.card}
      onPress={() => router.push(`/book/${event.bookId}`)}
      activeOpacity={0.8}
    >
      <View style={feedStyles.topRow}>
        <View style={feedStyles.avatar}>
          <Text style={feedStyles.avatarInitial}>
            {event.actorUsername.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={feedStyles.headline} numberOfLines={2}>
            <Text style={feedStyles.username}>{event.actorUsername}</Text>
            {' '}{verb}{' '}
            <Text style={feedStyles.bookTitle}>{event.bookTitle}</Text>
          </Text>
        </View>
        <Text style={feedStyles.timestamp}>{timeAgo(event.createdAt)}</Text>
      </View>

      {event.eventType === 'finished_book' && event.metadata.review_snippet ? (
        <Text style={feedStyles.snippet} numberOfLines={2}>
          {event.metadata.review_snippet}
        </Text>
      ) : null}

      <View style={feedStyles.actions}>
        <TouchableOpacity
          style={feedStyles.actionBtn}
          onPress={(e) => { e.stopPropagation(); onLike(); }}
          testID={`like-btn-${event.id}`}
          accessibilityLabel={event.likedByMe ? 'liked' : 'not liked'}
        >
          <Ionicons
            name={event.likedByMe ? 'heart-sharp' : 'heart-outline'}
            size={18}
            color={event.likedByMe ? Colors.error : Colors.textSecondary}
          />
          <Text style={feedStyles.actionCount}>{event.likeCount}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={feedStyles.actionBtn}
          onPress={(e) => { e.stopPropagation(); onComment(); }}
          testID={`comment-btn-${event.id}`}
        >
          <Ionicons name="chatbubble-outline" size={18} color={Colors.textSecondary} />
          <Text style={feedStyles.actionCount}>{event.commentCount}</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

export default function SocialScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const userId = session?.user.id ?? '';

  const [following, setFollowing] = useState<UserSearchResult[]>([]);
  const [feed, setFeed] = useState<ActivityEvent[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeCommentEvent, setActiveCommentEvent] = useState<ActivityEvent | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadFeed = useCallback(() => {
    if (!userId) return;
    Promise.all([getFollowing(userId), getFeed(userId)])
      .then(([followingData, feedData]) => {
        setFollowing(followingData);
        setFeed(feedData);
      })
      .catch(() => {});
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      loadFeed();
    }, [loadFeed])
  );

  const onRefresh = () => {
    setRefreshing(true);
    Promise.all([getFollowing(userId), getFeed(userId)])
      .then(([followingData, feedData]) => {
        setFollowing(followingData);
        setFeed(feedData);
      })
      .finally(() => setRefreshing(false));
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchUsers(text.trim(), userId);
        setSearchResults(results);
      } finally {
        setSearching(false);
      }
    }, 300);
  };

  const handleFollow = async (user: UserSearchResult, list: 'search' | 'following') => {
    const next =
      user.followStatus === 'none'
        ? (user.is_private ? 'requested' : 'following')
        : 'none';
    const update = (prev: UserSearchResult[]) =>
      prev.map(u => u.id === user.id ? { ...u, followStatus: next as UserSearchResult['followStatus'] } : u);
    if (list === 'search') setSearchResults(update);
    else setFollowing(update);
    if (user.followStatus === 'none') {
      await followUser(userId, user.id, user.is_private);
    } else if (user.followStatus === 'requested') {
      await cancelFollowRequest(userId, user.id);
    } else {
      await unfollowUser(userId, user.id);
    }
  };

  const handleLike = async (event: ActivityEvent) => {
    const wasLiked = event.likedByMe;
    setFeed(prev =>
      prev.map(e =>
        e.id === event.id
          ? { ...e, likedByMe: !wasLiked, likeCount: e.likeCount + (wasLiked ? -1 : 1) }
          : e
      )
    );
    if (wasLiked) {
      await unlikeEvent(userId, event.id);
    } else {
      await likeEvent(userId, event.id);
    }
  };

  const followLabel = (status: UserSearchResult['followStatus']) =>
    status === 'following' ? 'Following' : status === 'requested' ? 'Requested' : 'Follow';

  const renderUserRow = (user: UserSearchResult, list: 'search' | 'following') => (
    <TouchableOpacity
      key={user.id}
      style={styles.userRow}
      onPress={() => router.push(`/user/${user.id}`)}
    >
      <View style={styles.userAvatar}>
        <Text style={styles.userInitial}>{user.username.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{user.username}</Text>
        {user.bio ? <Text style={styles.userBio} numberOfLines={1}>{user.bio}</Text> : null}
      </View>
      <TouchableOpacity
        style={[styles.followBtn, user.followStatus !== 'none' && styles.followBtnOutlined]}
        onPress={() => handleFollow(user, list)}
        testID={`follow-btn-${user.id}`}
      >
        <Text style={[styles.followBtnText, user.followStatus !== 'none' && styles.followBtnTextOutlined]}>
          {followLabel(user.followStatus)}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const isSearchActive = searchQuery.trim().length > 0;

  if (!session) return null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.title}>Social</Text>

        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search people..."
            placeholderTextColor={Colors.textTertiary}
            value={searchQuery}
            onChangeText={handleSearchChange}
            autoCapitalize="none"
            autoCorrect={false}
            testID="search-input"
          />
        </View>

        {isSearchActive ? (
          searching ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: 16 }} />
          ) : searchResults.length === 0 ? (
            <Text style={styles.emptyText}>No users found</Text>
          ) : (
            searchResults.map(u => renderUserRow(u, 'search'))
          )
        ) : (
          <>
            <Text style={styles.sectionTitle}>Following</Text>
            {following.length === 0 ? (
              <Text style={styles.emptyText}>Search for people to follow.</Text>
            ) : (
              following.map(u => renderUserRow(u, 'following'))
            )}

            <Text style={styles.sectionTitle}>Activity</Text>
            {feed.length === 0 ? (
              <Text style={styles.emptyText}>Follow people to see their activity here.</Text>
            ) : (
              feed.map(event => (
                <FeedCard
                  key={event.id}
                  event={event}
                  userId={userId}
                  onLike={() => handleLike(event)}
                  onComment={() => setActiveCommentEvent(event)}
                />
              ))
            )}
          </>
        )}
      </ScrollView>

      <CommentsModal
        event={activeCommentEvent}
        userId={userId}
        onClose={() => setActiveCommentEvent(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.lg, gap: Spacing.lg },
  title: { fontSize: 32, fontWeight: '700', color: Colors.primary },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    ...Shadow.card,
  },
  searchInput: { flex: 1, fontSize: 15, color: Colors.textPrimary },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  emptyText: { fontSize: 14, color: Colors.textSecondary },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    ...Shadow.card,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInitial: { fontSize: 16, fontWeight: '700', color: Colors.surface },
  userInfo: { flex: 1 },
  userName: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  userBio: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  followBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.xl,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  followBtnOutlined: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  followBtnText: { color: Colors.surface, fontWeight: '700', fontSize: 13 },
  followBtnTextOutlined: { color: Colors.primary },
});

const feedStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
    ...Shadow.card,
  },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: { fontSize: 16, fontWeight: '700', color: Colors.surface },
  headline: { fontSize: 14, color: Colors.textPrimary, lineHeight: 20 },
  username: { fontWeight: '700' },
  bookTitle: { fontWeight: '600', color: Colors.primary },
  timestamp: { fontSize: 12, color: Colors.textTertiary },
  snippet: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: Spacing.md, paddingTop: 4 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionCount: { fontSize: 13, color: Colors.textSecondary },
});

const modalStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  titleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  list: { flex: 1 },
  listContent: { padding: Spacing.lg, gap: Spacing.md },
  empty: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginTop: 24 },
  commentRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentInitial: { fontSize: 12, fontWeight: '700', color: Colors.surface },
  commentUsername: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  commentBody: { fontSize: 14, color: Colors.textPrimary, marginTop: 2 },
  commentTime: { fontSize: 11, color: Colors.textTertiary, marginTop: 2 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
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

- [ ] **Step 4: Run all social tests**

```bash
npx jest __tests__/screens/social.test.tsx --no-coverage
```

Expected: 15 tests pass (8 existing + 7 new), 0 failures.

- [ ] **Step 5: Commit**

```bash
git add app/(tabs)/social.tsx __tests__/screens/social.test.tsx
git commit -m "feat: add activity feed with FeedCard and comments modal to social tab"
```

---

### Task 3: Book detail — auto-events on moveShelf + share progress button

**Files:**
- Modify: `app/book/[bookId].tsx`
- Modify: `__tests__/screens/bookDetail.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add to `__tests__/screens/bookDetail.test.tsx`. After the existing `jest.mock('@/lib/userBooks', ...)` block add:

```typescript
jest.mock('@/lib/activity', () => ({
  createEvent: jest.fn().mockResolvedValue(undefined),
}));
```

Add to imports:
```typescript
import { createEvent } from '@/lib/activity';
```

Add to `beforeEach`:
```typescript
(createEvent as jest.Mock).mockResolvedValue(undefined);
```

Add this `describe` block at the bottom:

```typescript
describe('Activity events', () => {
  it('share progress button is visible when shelf is reading', async () => {
    (getUserBook as jest.Mock).mockResolvedValue(mockReadingBook);
    render(<BookDetailScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('share-progress-btn')).toBeTruthy();
    });
  });

  it('share progress button is hidden when shelf is not reading', async () => {
    (getUserBook as jest.Mock).mockResolvedValue(mockReadBook);
    render(<BookDetailScreen />);
    await waitFor(() => screen.getByText('The Hobbit'));
    expect(screen.queryByTestId('share-progress-btn')).toBeNull();
  });

  it('tapping share progress button calls createEvent with shared_session', async () => {
    (getUserBook as jest.Mock).mockResolvedValue(mockReadingBook);
    render(<BookDetailScreen />);
    await waitFor(() => screen.getByTestId('share-progress-btn'));
    fireEvent.press(screen.getByTestId('share-progress-btn'));
    await waitFor(() => {
      expect(createEvent).toHaveBeenCalledWith('user-1', 'shared_session', 'book-1', {
        pages_read: 50,
        duration_seconds: 0,
      });
    });
  });

  it('button label changes to Shared ✓ after tap', async () => {
    (getUserBook as jest.Mock).mockResolvedValue(mockReadingBook);
    render(<BookDetailScreen />);
    await waitFor(() => screen.getByTestId('share-progress-btn'));
    fireEvent.press(screen.getByTestId('share-progress-btn'));
    await waitFor(() => {
      expect(screen.getByText('Shared ✓')).toBeTruthy();
    });
  });

  it('tapping Move to shelf to reading calls createEvent with started_book', async () => {
    jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation(
      (_opts: any, callback: (index: number) => void) => { callback(1); } // 1 = "Reading"
    );
    (getUserBook as jest.Mock).mockResolvedValue(mockReadingBook);
    render(<BookDetailScreen />);
    await waitFor(() => screen.getByTestId('move-shelf-btn'));
    fireEvent.press(screen.getByTestId('move-shelf-btn'));
    await waitFor(() => {
      expect(createEvent).toHaveBeenCalledWith('user-1', 'started_book', 'book-1', {});
    });
  });

  it('tapping Move to shelf to read calls createEvent with finished_book', async () => {
    jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation(
      (_opts: any, callback: (index: number) => void) => { callback(3); } // 3 = "Read"
    );
    (getUserBook as jest.Mock)
      .mockResolvedValueOnce(mockReadingBook) // initial load
      .mockResolvedValue({ ...mockReadingBook, shelf: 'read', rating: 4, review: 'Great' }); // refetch after moveShelf
    render(<BookDetailScreen />);
    await waitFor(() => screen.getByTestId('move-shelf-btn'));
    fireEvent.press(screen.getByTestId('move-shelf-btn'));
    await waitFor(() => {
      expect(createEvent).toHaveBeenCalledWith('user-1', 'finished_book', 'book-1', {
        rating: 4,
        review_snippet: 'Great',
      });
    });
  });

  it('tapping Move to shelf to want calls createEvent with added_to_shelf', async () => {
    jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation(
      (_opts: any, callback: (index: number) => void) => { callback(2); } // 2 = "Want to Read"
    );
    (getUserBook as jest.Mock).mockResolvedValue(mockReadingBook);
    render(<BookDetailScreen />);
    await waitFor(() => screen.getByTestId('move-shelf-btn'));
    fireEvent.press(screen.getByTestId('move-shelf-btn'));
    await waitFor(() => {
      expect(createEvent).toHaveBeenCalledWith('user-1', 'added_to_shelf', 'book-1', { shelf: 'want' });
    });
  });
});
```

- [ ] **Step 2: Run tests to confirm new ones fail**

```bash
npx jest __tests__/screens/bookDetail.test.tsx --no-coverage
```

Expected: 8 existing pass, 7 new fail.

- [ ] **Step 3: Modify `app/book/[bookId].tsx`**

Add `createEvent` import and `shareConfirmed` state, update `handleMoveShelf`, add share progress button.

Change the import line for `@/lib/userBooks`:
```typescript
import { getUserBook, moveShelf, rateBook, type UserBookWithBook } from '@/lib/userBooks';
```
to also add the activity import below it:
```typescript
import { createEvent } from '@/lib/activity';
```

Add `shareConfirmed` state inside `BookDetailScreen` after the existing state declarations:
```typescript
const [shareConfirmed, setShareConfirmed] = useState(false);
```

Replace the existing `handleMoveShelf` function:
```typescript
const handleMoveShelf = () => {
  ActionSheetIOS.showActionSheetWithOptions(
    { options: [...SHELF_OPTIONS], cancelButtonIndex: 0, title: `Move "${book.title}" to...` },
    async (buttonIndex) => {
      const newShelf = SHELF_KEYS[buttonIndex];
      if (newShelf) {
        await moveShelf(userBook.id, newShelf);
        if (newShelf === 'reading') {
          await createEvent(userId, 'started_book', bookId, {});
        } else if (newShelf === 'read') {
          const ub = await getUserBook(userId, bookId);
          await createEvent(userId, 'finished_book', bookId, {
            rating: ub?.rating ?? null,
            review_snippet: ub?.review ? ub.review.slice(0, 200) : null,
          });
        } else if (newShelf === 'want' || newShelf === 'dnf') {
          await createEvent(userId, 'added_to_shelf', bookId, { shelf: newShelf });
        }
        router.back();
      }
    }
  );
};
```

Add a `handleShareProgress` function after `handleRate`:
```typescript
const handleShareProgress = async () => {
  await createEvent(userId, 'shared_session', bookId, {
    pages_read: userBook.current_page,
    duration_seconds: 0,
  });
  setShareConfirmed(true);
  setTimeout(() => setShareConfirmed(false), 2000);
};
```

Inside the `{/* Action bar */}` section, after the existing `shelf === 'reading'` block for Start Session and before the Move to shelf button, add:

```tsx
{shelf === 'reading' && (
  <TouchableOpacity
    style={styles.secondaryBtn}
    onPress={handleShareProgress}
    testID="share-progress-btn"
  >
    <Text style={styles.secondaryBtnText}>
      {shareConfirmed ? 'Shared ✓' : 'Share progress'}
    </Text>
  </TouchableOpacity>
)}
```

- [ ] **Step 4: Run tests**

```bash
npx jest __tests__/screens/bookDetail.test.tsx --no-coverage
```

Expected: 15 tests pass, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add app/book/[bookId].tsx __tests__/screens/bookDetail.test.tsx
git commit -m "feat: emit activity events on shelf moves and add share progress button to book detail"
```

---

### Task 4: Session screen — share to feed toggle

**Files:**
- Modify: `app/session/[bookId].tsx`
- Modify: `__tests__/screens/session.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add to `__tests__/screens/session.test.tsx`. After the existing `jest.mock('@/lib/sessions', ...)` block add:

```typescript
jest.mock('@/lib/activity', () => ({
  createEvent: jest.fn().mockResolvedValue(undefined),
}));
```

Add to imports:
```typescript
import { createEvent } from '@/lib/activity';
```

Add to `beforeEach`:
```typescript
(createEvent as jest.Mock).mockResolvedValue(undefined);
```

Add this `describe` block at the bottom:

```typescript
describe('Share to feed', () => {
  it('share toggle is hidden before finish phase', async () => {
    render(<SessionScreen />);
    await waitFor(() => screen.getByText('Start Reading'));
    expect(screen.queryByTestId('share-toggle')).toBeNull();
  });

  it('share toggle appears in finish phase', async () => {
    render(<SessionScreen />);
    await waitFor(() => screen.getByText('Start Reading'));
    fireEvent.changeText(screen.getByPlaceholderText('Starting page'), '50');
    fireEvent.press(screen.getByText('Start Reading'));
    act(() => { jest.advanceTimersByTime(5000); });
    fireEvent.press(screen.getByText('Finish'));
    await waitFor(() => {
      expect(screen.getByTestId('share-toggle')).toBeTruthy();
    });
  });

  it('when share toggle is on and session saved, createEvent is called with shared_session', async () => {
    render(<SessionScreen />);
    await waitFor(() => screen.getByText('Start Reading'));
    fireEvent.changeText(screen.getByPlaceholderText('Starting page'), '50');
    fireEvent.press(screen.getByText('Start Reading'));
    act(() => { jest.advanceTimersByTime(1800000); });
    fireEvent.press(screen.getByText('Finish'));
    await waitFor(() => screen.getByTestId('share-toggle'));
    fireEvent(screen.getByTestId('share-toggle'), 'valueChange', true);
    fireEvent.changeText(screen.getByPlaceholderText('Ending page'), '80');
    fireEvent.press(screen.getByText('Save Session'));
    await waitFor(() => {
      expect(createEvent).toHaveBeenCalledWith('user-1', 'shared_session', 'book-1', {
        pages_read: 30,
        duration_seconds: 1800,
      });
    });
  });

  it('when share toggle is off, createEvent is not called', async () => {
    render(<SessionScreen />);
    await waitFor(() => screen.getByText('Start Reading'));
    fireEvent.changeText(screen.getByPlaceholderText('Starting page'), '50');
    fireEvent.press(screen.getByText('Start Reading'));
    act(() => { jest.advanceTimersByTime(1800000); });
    fireEvent.press(screen.getByText('Finish'));
    await waitFor(() => screen.getByPlaceholderText('Ending page'));
    fireEvent.changeText(screen.getByPlaceholderText('Ending page'), '80');
    fireEvent.press(screen.getByText('Save Session'));
    await waitFor(() => expect(createSession).toHaveBeenCalled());
    expect(createEvent).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to confirm new ones fail**

```bash
npx jest __tests__/screens/session.test.tsx --no-coverage
```

Expected: 5 existing pass, 4 new fail.

- [ ] **Step 3: Modify `app/session/[bookId].tsx`**

Add import after the existing imports:
```typescript
import { createEvent } from '@/lib/activity';
import { Switch } from 'react-native';
```

(Also add `Switch` to the existing `react-native` import destructuring.)

Add `shareToFeed` state inside `SessionScreen` after the existing state declarations:
```typescript
const [shareToFeed, setShareToFeed] = useState(false);
```

Replace the existing `saveSession` function:
```typescript
const saveSession = async () => {
  const sp = parseInt(startPage, 10);
  const ep = parseInt(endPage, 10);
  const pageCount = userBook?.book.page_count;
  setSaveError('');

  if (
    isNaN(sp) || isNaN(ep) ||
    sp < 0 || ep <= sp ||
    (pageCount !== null && pageCount !== undefined && ep > pageCount) ||
    !userBook
  ) {
    setSaveError('Check your page numbers');
    return;
  }
  if (seconds === 0) {
    setSaveError('Read at least a moment before saving');
    return;
  }

  try {
    await createSession({
      userId,
      bookId,
      userBookId: userBook.id,
      startPage: sp,
      endPage: ep,
      durationSeconds: seconds,
      startedAt: startedAtRef.current!,
    });
    if (shareToFeed) {
      await createEvent(userId, 'shared_session', bookId, {
        pages_read: ep - sp,
        duration_seconds: seconds,
      });
    }
    router.back();
  } catch {
    Alert.alert('Error', 'Could not save session. Please try again.');
  }
};
```

In the `phase === 'finish'` JSX block, add the share toggle row between the error text and the Save Session button:

```tsx
{phase === 'finish' && (
  <View style={styles.controls}>
    <TextInput
      style={styles.input}
      placeholder="Ending page"
      placeholderTextColor={Colors.textTertiary}
      value={endPage}
      onChangeText={setEndPage}
      keyboardType="number-pad"
    />
    {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}
    <View style={styles.shareRow}>
      <Text style={styles.shareLabel}>Share to feed</Text>
      <Switch
        testID="share-toggle"
        value={shareToFeed}
        onValueChange={setShareToFeed}
        trackColor={{ true: Colors.primary, false: Colors.border }}
        thumbColor={Colors.surface}
      />
    </View>
    <TouchableOpacity style={styles.primaryBtn} onPress={saveSession}>
      <Text style={styles.primaryBtnText}>Save Session</Text>
    </TouchableOpacity>
  </View>
)}
```

Add to `StyleSheet.create`:
```typescript
shareRow: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  backgroundColor: Colors.surface,
  borderRadius: Radius.md,
  paddingHorizontal: Spacing.md,
  paddingVertical: 14,
  borderWidth: 1,
  borderColor: Colors.border,
},
shareLabel: { fontSize: 15, color: Colors.textPrimary },
```

- [ ] **Step 4: Run tests**

```bash
npx jest __tests__/screens/session.test.tsx --no-coverage
```

Expected: 9 tests pass, 0 failures.

- [ ] **Step 5: Run full test suite**

```bash
npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add app/session/[bookId].tsx __tests__/screens/session.test.tsx
git commit -m "feat: add share to feed toggle to session screen finish phase"
```
