# Social — Following Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Social tab placeholder with user search, a following list, a stub activity section, an other-user profile page, and a follow-request approval flow on the own-profile screen.

**Architecture:** Four tasks in dependency order — data lib first, then Social tab, then user profile page, then profile tab additions. All Supabase tables are created manually in the dashboard before Task 1. The existing Supabase mock pattern (`testState` + `mockBuilder`) is extended with per-table `mockImplementation` overrides for multi-table queries.

**Tech Stack:** Expo Router, React Native, Supabase, `@expo/vector-icons` (Ionicons), `constants/theme.ts` tokens.

---

## File Map

```
lib/follows.ts                          CREATE — 9 follow functions + 2 interfaces
__tests__/lib/follows.test.ts           CREATE — unit tests for all lib functions
app/(tabs)/social.tsx                   MODIFY — replace placeholder with search + following + stub
__tests__/screens/social.test.tsx       CREATE — Social tab render tests
app/user/[userId].tsx                   CREATE — other user's profile page
__tests__/screens/userProfile.test.tsx  CREATE — user profile screen render tests
app/(tabs)/profile.tsx                  MODIFY — add follow requests card + fetch
__tests__/screens/profile.test.tsx      MODIFY — add follow requests tests
```

---

## Pre-Task: Run Supabase Migration

Before any code, create the two new tables in the Supabase dashboard (SQL editor):

```sql
CREATE TABLE follows (
  follower_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id)
);

CREATE TABLE follow_requests (
  requester_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (requester_id, target_id)
);
```

---

## Task 1: Follow Library

**Files:**
- Create: `lib/follows.ts`
- Create: `__tests__/lib/follows.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/follows.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest __tests__/lib/follows.test.ts --no-coverage
```

Expected: FAIL — module `@/lib/follows` not found.

- [ ] **Step 3: Create `lib/follows.ts`**

```typescript
import { supabase } from './supabase';

export interface UserSearchResult {
  id: string;
  username: string;
  bio: string | null;
  is_private: boolean;
  followStatus: 'following' | 'requested' | 'none';
}

export interface FollowRequest {
  requesterId: string;
  username: string;
  bio: string | null;
}

export async function getFollowStatus(
  followerId: string,
  targetId: string
): Promise<'following' | 'requested' | 'none'> {
  const { data: followData } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('follower_id', followerId)
    .eq('following_id', targetId)
    .maybeSingle();
  if (followData) return 'following';

  const { data: requestData } = await supabase
    .from('follow_requests')
    .select('requester_id')
    .eq('requester_id', followerId)
    .eq('target_id', targetId)
    .maybeSingle();
  if (requestData) return 'requested';

  return 'none';
}

export async function searchUsers(
  query: string,
  currentUserId: string
): Promise<UserSearchResult[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, bio, is_private')
    .ilike('username', `${query}%`)
    .neq('id', currentUserId)
    .limit(20);
  if (error) throw error;

  const results = await Promise.all(
    (data ?? []).map(async (profile: any) => ({
      id: profile.id,
      username: profile.username,
      bio: profile.bio,
      is_private: profile.is_private,
      followStatus: await getFollowStatus(currentUserId, profile.id),
    }))
  );
  return results;
}

export async function followUser(
  followerId: string,
  targetId: string,
  isPrivate: boolean
): Promise<void> {
  if (isPrivate) {
    const { error } = await supabase
      .from('follow_requests')
      .insert({ requester_id: followerId, target_id: targetId });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('follows')
      .insert({ follower_id: followerId, following_id: targetId });
    if (error) throw error;
  }
}

export async function unfollowUser(
  followerId: string,
  targetId: string
): Promise<void> {
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', targetId);
  if (error) throw error;
}

export async function cancelFollowRequest(
  requesterId: string,
  targetId: string
): Promise<void> {
  const { error } = await supabase
    .from('follow_requests')
    .delete()
    .eq('requester_id', requesterId)
    .eq('target_id', targetId);
  if (error) throw error;
}

export async function getFollowing(userId: string): Promise<UserSearchResult[]> {
  const { data, error } = await supabase
    .from('follows')
    .select('profile:profiles!following_id(id, username, bio, is_private)')
    .eq('follower_id', userId);
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    ...row.profile,
    followStatus: 'following' as const,
  }));
}

export async function getFollowRequests(userId: string): Promise<FollowRequest[]> {
  const { data, error } = await supabase
    .from('follow_requests')
    .select('profile:profiles!requester_id(id, username, bio)')
    .eq('target_id', userId);
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    requesterId: row.profile.id,
    username: row.profile.username,
    bio: row.profile.bio,
  }));
}

export async function approveFollowRequest(
  requesterId: string,
  targetId: string
): Promise<void> {
  const { error: deleteError } = await supabase
    .from('follow_requests')
    .delete()
    .eq('requester_id', requesterId)
    .eq('target_id', targetId);
  if (deleteError) throw deleteError;

  const { error: insertError } = await supabase
    .from('follows')
    .insert({ follower_id: requesterId, following_id: targetId });
  if (insertError) throw insertError;
}

export async function declineFollowRequest(
  requesterId: string,
  targetId: string
): Promise<void> {
  const { error } = await supabase
    .from('follow_requests')
    .delete()
    .eq('requester_id', requesterId)
    .eq('target_id', targetId);
  if (error) throw error;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/lib/follows.test.ts --no-coverage
```

Expected: all 14 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/follows.ts __tests__/lib/follows.test.ts
git commit -m "feat: add follows library (follow, unfollow, search, requests)"
```

---

## Task 2: Social Tab

**Files:**
- Modify: `app/(tabs)/social.tsx`
- Create: `__tests__/screens/social.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/screens/social.test.tsx`:

```typescript
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import SocialScreen from '@/app/(tabs)/social';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(() => { cb(); }, []);
  },
}));

jest.mock('@/lib/auth', () => ({
  useAuth: jest.fn(() => ({ session: { user: { id: 'user-1' } } })),
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/lib/follows', () => ({
  getFollowing: jest.fn().mockResolvedValue([]),
  searchUsers: jest.fn().mockResolvedValue([]),
  followUser: jest.fn().mockResolvedValue(undefined),
  unfollowUser: jest.fn().mockResolvedValue(undefined),
  cancelFollowRequest: jest.fn().mockResolvedValue(undefined),
}));

import { getFollowing, searchUsers } from '@/lib/follows';

beforeEach(() => {
  jest.clearAllMocks();
  (getFollowing as jest.Mock).mockResolvedValue([]);
  (searchUsers as jest.Mock).mockResolvedValue([]);
});

describe('SocialScreen', () => {
  it('renders search bar and activity stub on load', async () => {
    render(<SocialScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('search-input')).toBeTruthy();
      expect(screen.getByText("Your friends' activity will appear here.")).toBeTruthy();
    });
  });

  it('shows empty following state when following no one', async () => {
    render(<SocialScreen />);
    await waitFor(() => {
      expect(screen.getByText('Search for people to follow.')).toBeTruthy();
    });
  });

  it('shows following list when user follows someone', async () => {
    (getFollowing as jest.Mock).mockResolvedValue([
      { id: 'user-2', username: 'alice', bio: null, is_private: false, followStatus: 'following' },
    ]);
    render(<SocialScreen />);
    await waitFor(() => {
      expect(screen.getByText('alice')).toBeTruthy();
    });
  });

  it('hides following list and activity stub when search is active', async () => {
    (getFollowing as jest.Mock).mockResolvedValue([
      { id: 'user-2', username: 'alice', bio: null, is_private: false, followStatus: 'following' },
    ]);
    render(<SocialScreen />);
    await waitFor(() => screen.getByTestId('search-input'));
    fireEvent.changeText(screen.getByTestId('search-input'), 'bob');
    await waitFor(() => {
      expect(screen.queryByText("Your friends' activity will appear here.")).toBeNull();
    });
  });

  it('shows search results when query is non-empty', async () => {
    (searchUsers as jest.Mock).mockResolvedValue([
      { id: 'user-3', username: 'bob', bio: null, is_private: false, followStatus: 'none' },
    ]);
    render(<SocialScreen />);
    await waitFor(() => screen.getByTestId('search-input'));
    fireEvent.changeText(screen.getByTestId('search-input'), 'bob');
    await waitFor(() => {
      expect(screen.getByText('bob')).toBeTruthy();
    });
  });

  it('shows Follow button for user with followStatus none', async () => {
    (getFollowing as jest.Mock).mockResolvedValue([
      { id: 'user-2', username: 'alice', bio: null, is_private: false, followStatus: 'none' },
    ]);
    render(<SocialScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('follow-btn-user-2')).toBeTruthy();
      expect(screen.getByText('Follow')).toBeTruthy();
    });
  });

  it('shows Following button for user with followStatus following', async () => {
    (getFollowing as jest.Mock).mockResolvedValue([
      { id: 'user-2', username: 'alice', bio: null, is_private: false, followStatus: 'following' },
    ]);
    render(<SocialScreen />);
    await waitFor(() => {
      expect(screen.getByText('Following')).toBeTruthy();
    });
  });

  it('shows Requested button for user with followStatus requested', async () => {
    (getFollowing as jest.Mock).mockResolvedValue([
      { id: 'user-2', username: 'alice', bio: null, is_private: true, followStatus: 'requested' },
    ]);
    render(<SocialScreen />);
    await waitFor(() => {
      expect(screen.getByText('Requested')).toBeTruthy();
    });
  });
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
npx jest __tests__/screens/social.test.tsx --no-coverage
```

Expected: FAIL — SocialScreen is a placeholder without the expected content.

- [ ] **Step 3: Implement `app/(tabs)/social.tsx`**

Replace the entire file:

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
import { Colors, Spacing, Radius, Shadow } from '@/constants/theme';

export default function SocialScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const userId = session?.user.id ?? '';

  const [following, setFollowing] = useState<UserSearchResult[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      getFollowing(userId).then(setFollowing).catch(() => {});
    }, [userId])
  );

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
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Social</Text>

        {/* Search bar */}
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
            <View style={styles.stubCard}>
              <Text style={styles.stubText}>Your friends' activity will appear here.</Text>
            </View>
          </>
        )}
      </ScrollView>
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

  stubCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    ...Shadow.card,
  },
  stubText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
});
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/screens/social.test.tsx --no-coverage
```

Expected: all 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add "app/(tabs)/social.tsx" __tests__/screens/social.test.tsx
git commit -m "feat: social tab with user search, following list, activity stub"
```

---

## Task 3: User Profile Page

**Files:**
- Create: `app/user/[userId].tsx`
- Create: `__tests__/screens/userProfile.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/screens/userProfile.test.tsx`:

```typescript
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import UserProfileScreen from '@/app/user/[userId]';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(() => { cb(); }, []);
  },
}));

jest.mock('@/lib/auth', () => ({
  useAuth: jest.fn(() => ({ session: { user: { id: 'user-1' } } })),
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => ({ userId: 'user-2' }),
}));

jest.mock('@/lib/profile', () => ({
  getProfile: jest.fn().mockResolvedValue({
    id: 'user-2',
    username: 'alice',
    bio: 'book lover',
    is_private: false,
    yearly_goal: 10,
  }),
}));

jest.mock('@/lib/userBooks', () => ({
  getShelf: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/lib/follows', () => ({
  getFollowStatus: jest.fn().mockResolvedValue('none'),
  followUser: jest.fn().mockResolvedValue(undefined),
  unfollowUser: jest.fn().mockResolvedValue(undefined),
  cancelFollowRequest: jest.fn().mockResolvedValue(undefined),
}));

import { getProfile } from '@/lib/profile';
import { getFollowStatus, followUser } from '@/lib/follows';

beforeEach(() => {
  jest.clearAllMocks();
  (getProfile as jest.Mock).mockResolvedValue({
    id: 'user-2',
    username: 'alice',
    bio: 'book lover',
    is_private: false,
    yearly_goal: 10,
  });
  (getFollowStatus as jest.Mock).mockResolvedValue('none');
});

describe('UserProfileScreen', () => {
  it('renders username and initials', async () => {
    render(<UserProfileScreen />);
    await waitFor(() => {
      expect(screen.getByText('alice')).toBeTruthy();
      expect(screen.getByText('A')).toBeTruthy();
    });
  });

  it('renders bio when present', async () => {
    render(<UserProfileScreen />);
    await waitFor(() => {
      expect(screen.getByText('book lover')).toBeTruthy();
    });
  });

  it('shows Follow button for public profile with status none', async () => {
    render(<UserProfileScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('follow-btn')).toBeTruthy();
      expect(screen.getByText('Follow')).toBeTruthy();
    });
  });

  it('shows shelf counts for public profile', async () => {
    render(<UserProfileScreen />);
    await waitFor(() => {
      expect(screen.getByText(/Read · /)).toBeTruthy();
      expect(screen.getByText(/Reading · /)).toBeTruthy();
    });
  });

  it('shows Private profile label for private profile with status none', async () => {
    (getProfile as jest.Mock).mockResolvedValue({
      id: 'user-2',
      username: 'alice',
      bio: null,
      is_private: true,
      yearly_goal: 0,
    });
    (getFollowStatus as jest.Mock).mockResolvedValue('none');
    render(<UserProfileScreen />);
    await waitFor(() => {
      expect(screen.getByText('🔒 Private profile')).toBeTruthy();
    });
  });

  it('shows shelf counts for private profile with status following', async () => {
    (getProfile as jest.Mock).mockResolvedValue({
      id: 'user-2',
      username: 'alice',
      bio: null,
      is_private: true,
      yearly_goal: 0,
    });
    (getFollowStatus as jest.Mock).mockResolvedValue('following');
    render(<UserProfileScreen />);
    await waitFor(() => {
      expect(screen.getByText(/Read · /)).toBeTruthy();
    });
  });

  it('tapping Follow calls followUser', async () => {
    render(<UserProfileScreen />);
    await waitFor(() => screen.getByTestId('follow-btn'));
    fireEvent.press(screen.getByTestId('follow-btn'));
    await waitFor(() => {
      expect(followUser).toHaveBeenCalledWith('user-1', 'user-2', false);
    });
  });
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
npx jest __tests__/screens/userProfile.test.tsx --no-coverage
```

Expected: FAIL — `@/app/user/[userId]` not found.

- [ ] **Step 3: Create `app/user/[userId].tsx`**

```typescript
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth';
import { getProfile, type UserProfile } from '@/lib/profile';
import { getShelf } from '@/lib/userBooks';
import {
  getFollowStatus,
  followUser,
  unfollowUser,
  cancelFollowRequest,
} from '@/lib/follows';
import { Colors, Spacing, Radius, Shadow } from '@/constants/theme';

export default function UserProfileScreen() {
  const { userId: targetUserId } = useLocalSearchParams<{ userId: string }>();
  const { session } = useAuth();
  const currentUserId = session?.user.id ?? '';

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [followStatus, setFollowStatus] = useState<'following' | 'requested' | 'none'>('none');
  const [shelfCounts, setShelfCounts] = useState({ reading: 0, want: 0, read: 0, dnf: 0 });

  useFocusEffect(
    useCallback(() => {
      if (!targetUserId || !currentUserId) return;
      setLoading(true);
      Promise.all([
        getProfile(targetUserId),
        getFollowStatus(currentUserId, targetUserId),
        getShelf(targetUserId, 'reading'),
        getShelf(targetUserId, 'want'),
        getShelf(targetUserId, 'read'),
        getShelf(targetUserId, 'dnf'),
      ])
        .then(([p, fs, reading, want, read, dnf]) => {
          setProfile(p);
          setFollowStatus(fs);
          setShelfCounts({
            reading: reading.length,
            want: want.length,
            read: read.length,
            dnf: dnf.length,
          });
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }, [targetUserId, currentUserId])
  );

  if (!session) return null;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  const canSeeShelf = profile && (!profile.is_private || followStatus === 'following');
  const followLabel =
    followStatus === 'following' ? 'Following' :
    followStatus === 'requested' ? 'Requested' :
    'Follow';
  const followOutlined = followStatus !== 'none';

  const handleFollow = async () => {
    if (!profile) return;
    if (followStatus === 'none') {
      setFollowStatus(profile.is_private ? 'requested' : 'following');
      await followUser(currentUserId, targetUserId, profile.is_private);
    } else if (followStatus === 'requested') {
      setFollowStatus('none');
      await cancelFollowRequest(currentUserId, targetUserId);
    } else {
      setFollowStatus('none');
      await unfollowUser(currentUserId, targetUserId);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.initial}>
              {profile?.username.charAt(0).toUpperCase() ?? '?'}
            </Text>
          </View>
          <Text style={styles.username}>{profile?.username ?? ''}</Text>
          {profile?.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
        </View>

        {/* Follow button */}
        <TouchableOpacity
          style={[styles.followBtn, followOutlined && styles.followBtnOutlined]}
          onPress={handleFollow}
          testID="follow-btn"
        >
          <Text style={[styles.followBtnText, followOutlined && styles.followBtnTextOutlined]}>
            {followLabel}
          </Text>
        </TouchableOpacity>

        {/* Shelf counts or private label */}
        {canSeeShelf ? (
          <View style={styles.pillRow}>
            {[
              { label: 'Read', count: shelfCounts.read },
              { label: 'Reading', count: shelfCounts.reading },
              { label: 'Want', count: shelfCounts.want },
              { label: 'DNF', count: shelfCounts.dnf },
            ].map(({ label, count }) => (
              <View key={label} style={styles.pill}>
                <Text style={styles.pillText}>{label} · {count}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.privateLabel}>🔒 Private profile</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: {
    padding: Spacing.lg,
    gap: Spacing.lg,
    alignItems: 'center',
  },
  header: { alignItems: 'center', gap: 8, width: '100%' },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initial: { fontSize: 32, fontWeight: '700', color: Colors.surface },
  username: { fontSize: 24, fontWeight: '700', color: Colors.textPrimary },
  bio: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
  followBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.xl,
    paddingHorizontal: 32,
    paddingVertical: 10,
  },
  followBtnOutlined: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  followBtnText: { color: Colors.surface, fontWeight: '700', fontSize: 15 },
  followBtnTextOutlined: { color: Colors.primary },
  pillRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  pill: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: Radius.xl,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.surface,
  },
  pillText: { color: Colors.primary, fontSize: 13, fontWeight: '600' },
  privateLabel: { fontSize: 15, color: Colors.textSecondary },
});
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/screens/userProfile.test.tsx --no-coverage
```

Expected: all 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add "app/user/[userId].tsx" __tests__/screens/userProfile.test.tsx
git commit -m "feat: user profile page with follow/unfollow and shelf counts"
```

---

## Task 4: Follow Requests on Own Profile

**Files:**
- Modify: `app/(tabs)/profile.tsx`
- Modify: `__tests__/screens/profile.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add to the end of `__tests__/screens/profile.test.tsx`, inside the existing `describe('ProfileScreen', ...)` block, after the last `it(...)`:

First, update the existing `jest.mock('@/lib/follows', ...)` — add this new mock at the top of the file alongside the other mocks (after the `expo-router` mock):

```typescript
jest.mock('@/lib/follows', () => ({
  getFollowRequests: jest.fn().mockResolvedValue([]),
  approveFollowRequest: jest.fn().mockResolvedValue(undefined),
  declineFollowRequest: jest.fn().mockResolvedValue(undefined),
}));

import { getFollowRequests, approveFollowRequest, declineFollowRequest } from '@/lib/follows';
```

Then add `(getFollowRequests as jest.Mock).mockResolvedValue([])` to the `beforeEach` block.

Then add these test cases inside the existing `describe('ProfileScreen', ...)` block:

```typescript
  it('hides follow requests card when no pending requests', async () => {
    render(<ProfileScreen />);
    await waitFor(() => screen.getByText('isabelle'));
    expect(screen.queryByText('Follow Requests')).toBeNull();
  });

  it('shows follow requests card when requests are pending', async () => {
    (getFollowRequests as jest.Mock).mockResolvedValue([
      { requesterId: 'user-3', username: 'bob', bio: null },
    ]);
    render(<ProfileScreen />);
    await waitFor(() => {
      expect(screen.getByText('Follow Requests')).toBeTruthy();
      expect(screen.getByText('bob')).toBeTruthy();
    });
  });

  it('Accept button calls approveFollowRequest', async () => {
    (getFollowRequests as jest.Mock).mockResolvedValue([
      { requesterId: 'user-3', username: 'bob', bio: null },
    ]);
    render(<ProfileScreen />);
    await waitFor(() => screen.getByText('bob'));
    fireEvent.press(screen.getByTestId('accept-request-user-3'));
    await waitFor(() => {
      expect(approveFollowRequest).toHaveBeenCalledWith('user-3', 'user-1');
    });
  });

  it('Decline button calls declineFollowRequest', async () => {
    (getFollowRequests as jest.Mock).mockResolvedValue([
      { requesterId: 'user-3', username: 'bob', bio: null },
    ]);
    render(<ProfileScreen />);
    await waitFor(() => screen.getByText('bob'));
    fireEvent.press(screen.getByTestId('decline-request-user-3'));
    await waitFor(() => {
      expect(declineFollowRequest).toHaveBeenCalledWith('user-3', 'user-1');
    });
  });
```

- [ ] **Step 2: Run to verify they fail**

```bash
npx jest __tests__/screens/profile.test.tsx --no-coverage
```

Expected: new 4 tests FAIL — `@/lib/follows` not mocked and follow requests section doesn't exist.

- [ ] **Step 3: Modify `app/(tabs)/profile.tsx`**

Add two imports at the top of the existing imports block:

```typescript
import {
  getFollowRequests,
  approveFollowRequest,
  declineFollowRequest,
  type FollowRequest,
} from '@/lib/follows';
```

Add a new state slice after the existing `shelfCounts` state:

```typescript
const [followRequests, setFollowRequests] = useState<FollowRequest[]>([]);
```

Add `getFollowRequests(userId)` to the existing `Promise.all` in `useFocusEffect`, and destructure the result. The updated `Promise.all` becomes:

```typescript
Promise.all([
  getProfile(userId),
  getStreak(userId),
  getYearlyGoalProgress(userId),
  getReadingHistory(userId, 365),
  getShelf(userId, 'reading'),
  getShelf(userId, 'want'),
  getShelf(userId, 'read'),
  getShelf(userId, 'dnf'),
  getFollowRequests(userId),
])
  .then(([p, s, yg, history, reading, want, read, dnf, requests]) => {
    setProfile(p);
    setStreak(s);
    setYearlyGoal(yg);
    setPagesThisYear(history.reduce((sum, d) => sum + d.pages, 0));
    setShelfCounts({
      reading: reading.length,
      want: want.length,
      read: read.length,
      dnf: dnf.length,
    });
    setFollowRequests(requests);
    setLoading(false);
  })
  .catch(() => setLoading(false));
```

Add two handler functions after `handlePrivacyToggle`:

```typescript
const handleApproveRequest = async (requesterId: string) => {
  setFollowRequests(prev => prev.filter(r => r.requesterId !== requesterId));
  await approveFollowRequest(requesterId, userId);
};

const handleDeclineRequest = async (requesterId: string) => {
  setFollowRequests(prev => prev.filter(r => r.requesterId !== requesterId));
  await declineFollowRequest(requesterId, userId);
};
```

Insert the follow requests card at the very top of the `ScrollView` content, before `{/* User header */}`:

```typescript
{/* Follow requests */}
{followRequests.length > 0 && (
  <View style={styles.requestsCard}>
    <Text style={styles.requestsTitle}>
      Follow Requests <Text style={styles.requestsBadge}>{followRequests.length}</Text>
    </Text>
    {followRequests.map(req => (
      <View key={req.requesterId} style={styles.requestRow}>
        <View style={styles.requestAvatar}>
          <Text style={styles.requestInitial}>
            {req.username.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.requestInfo}>
          <Text style={styles.requestUsername}>{req.username}</Text>
          {req.bio ? <Text style={styles.requestBio} numberOfLines={1}>{req.bio}</Text> : null}
        </View>
        <TouchableOpacity
          style={styles.acceptBtn}
          onPress={() => handleApproveRequest(req.requesterId)}
          testID={`accept-request-${req.requesterId}`}
        >
          <Text style={styles.acceptBtnText}>Accept</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.declineBtn}
          onPress={() => handleDeclineRequest(req.requesterId)}
          testID={`decline-request-${req.requesterId}`}
        >
          <Text style={styles.declineBtnText}>Decline</Text>
        </TouchableOpacity>
      </View>
    ))}
  </View>
)}
```

Add these styles to the `StyleSheet.create` call:

```typescript
  requestsCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
    ...Shadow.card,
  },
  requestsTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  requestsBadge: {
    color: Colors.primary,
    fontWeight: '700',
  },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  requestAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  requestInitial: { fontSize: 14, fontWeight: '700', color: Colors.surface },
  requestInfo: { flex: 1 },
  requestUsername: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  requestBio: { fontSize: 12, color: Colors.textSecondary },
  acceptBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  acceptBtnText: { color: Colors.surface, fontWeight: '700', fontSize: 12 },
  declineBtn: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  declineBtnText: { color: Colors.textSecondary, fontWeight: '600', fontSize: 12 },
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/screens/profile.test.tsx --no-coverage
```

Expected: all 11 tests PASS (7 existing + 4 new).

- [ ] **Step 5: Run full suite**

```bash
npx jest --no-coverage
```

Expected: all tests PASS (120 existing + new ones = ~155+ total).

- [ ] **Step 6: Commit**

```bash
git add "app/(tabs)/profile.tsx" __tests__/screens/profile.test.tsx
git commit -m "feat: follow requests card on own profile screen"
```
