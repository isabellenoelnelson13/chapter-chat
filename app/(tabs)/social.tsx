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
