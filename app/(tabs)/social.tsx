import { useCallback, useMemo, useState, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
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
  type ActivityEvent,
} from '@/lib/activity';
import { useTheme } from '@/lib/theme';
import { Fonts, Spacing, Radius, Shadow } from '@/constants/theme';

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
  const { colors } = useTheme();
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

  const modalStyles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    titleBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: { fontSize: 17, fontFamily: Fonts.bold, color: colors.textPrimary },
    list: { flex: 1 },
    listContent: { padding: Spacing.lg, gap: Spacing.md },
    empty: { fontSize: 14, fontFamily: Fonts.regular, color: colors.textSecondary, textAlign: 'center', marginTop: 24 },
    commentRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
    commentAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    commentInitial: { fontSize: 12, fontFamily: Fonts.bold, color: colors.surface },
    commentUsername: { fontSize: 13, fontFamily: Fonts.bold, color: colors.textPrimary },
    commentBody: { fontSize: 14, fontFamily: Fonts.regular, color: colors.textPrimary, marginTop: 2 },
    commentTime: { fontSize: 11, fontFamily: Fonts.regular, color: colors.textTertiary, marginTop: 2 },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    input: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      paddingHorizontal: Spacing.md,
      paddingVertical: 10,
      fontSize: 15,
      fontFamily: Fonts.regular,
      color: colors.textPrimary,
      borderWidth: 1,
      borderColor: colors.border,
    },
  }), [colors]);

  return (
    <Modal visible={!!event} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={modalStyles.container}>
        <View style={modalStyles.titleBar}>
          <Text style={modalStyles.title}>Comments</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <ScrollView style={modalStyles.list} contentContainerStyle={modalStyles.listContent}>
          {loading ? (
            <ActivityIndicator color={colors.primary} />
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
            placeholderTextColor={colors.textTertiary}
            value={input}
            onChangeText={setInput}
            testID="comment-input"
          />
          <TouchableOpacity onPress={handleSend} testID="send-comment-btn">
            <Ionicons name="send" size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function FeedCard({
  event,
  onLike,
}: {
  event: ActivityEvent;
  onLike: () => void;
}) {
  const { colors } = useTheme();
  const router = useRouter();
  const verb = eventVerb(event);

  const feedStyles = useMemo(() => StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
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
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarInitial: { fontSize: 16, fontFamily: Fonts.bold, color: colors.surface },
    headline: { fontSize: 14, fontFamily: Fonts.regular, color: colors.textPrimary, lineHeight: 20 },
    username: { fontFamily: Fonts.bold },
    bookTitle: { fontFamily: Fonts.bookTitle, color: colors.primary },
    timestamp: { fontSize: 12, fontFamily: Fonts.regular, color: colors.textTertiary },
    snippet: { fontSize: 13, fontFamily: Fonts.regular, color: colors.textSecondary, lineHeight: 18 },
    actions: { flexDirection: 'row', gap: Spacing.md, paddingTop: 4 },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    actionCount: { fontSize: 13, fontFamily: Fonts.regular, color: colors.textSecondary },
  }), [colors]);

  return (
    <TouchableOpacity
      style={feedStyles.card}
      onPress={() => router.push(`/activity/${event.id}`)}
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
            color={event.likedByMe ? colors.error : colors.textSecondary}
          />
          <Text style={feedStyles.actionCount}>{event.likeCount}</Text>
        </TouchableOpacity>
        <View style={feedStyles.actionBtn}>
          <Ionicons name="chatbubble-outline" size={18} color={colors.textSecondary} />
          <Text style={feedStyles.actionCount}>{event.commentCount}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function SocialScreen() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const router = useRouter();
  const userId = session?.user.id ?? '';

  const [following, setFollowing] = useState<UserSearchResult[]>([]);
  const [feed, setFeed] = useState<ActivityEvent[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadData = useCallback(() => {
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
      loadData();
    }, [loadData])
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

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { padding: Spacing.lg, gap: Spacing.lg },
    title: { fontSize: 32, fontFamily: Fonts.bold, color: colors.primary },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    clubsLink: {
      color: colors.primary,
      fontFamily: Fonts.semiBold,
      fontSize: 15,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      paddingHorizontal: Spacing.md,
      paddingVertical: 10,
      ...Shadow.card,
    },
    searchInput: { flex: 1, fontSize: 15, fontFamily: Fonts.regular, color: colors.textPrimary },
    sectionTitle: { fontSize: 18, fontFamily: Fonts.bold, color: colors.textPrimary },
    emptyText: { fontSize: 14, fontFamily: Fonts.regular, color: colors.textSecondary },

    followingHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    followingCount: {
      fontSize: 13, fontFamily: Fonts.semiBold,
      color: colors.surface,
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingHorizontal: 7,
      paddingVertical: 1,
      overflow: 'hidden',
    },
    avatarStrip: { paddingVertical: 4, gap: Spacing.md },
    avatarItem: { alignItems: 'center', width: 64 },
    avatarCircle: {
      width: 52, height: 52, borderRadius: 26,
      backgroundColor: colors.primary,
      justifyContent: 'center', alignItems: 'center',
      ...Shadow.card,
    },
    avatarCircleInitial: { fontSize: 20, fontFamily: Fonts.bold, color: colors.surface },
    avatarName: {
      fontSize: 11, fontFamily: Fonts.medium,
      color: colors.textSecondary,
      marginTop: 5, textAlign: 'center',
    },

    userRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      padding: Spacing.md,
      ...Shadow.card,
    },
    userAvatar: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: colors.primary,
      justifyContent: 'center', alignItems: 'center',
    },
    userInitial: { fontSize: 16, fontFamily: Fonts.bold, color: colors.surface },
    userInfo: { flex: 1 },
    userName: { fontSize: 15, fontFamily: Fonts.semiBold, color: colors.textPrimary },
    userBio: { fontSize: 13, fontFamily: Fonts.regular, color: colors.textSecondary, marginTop: 2 },
    followBtn: {
      backgroundColor: colors.primary,
      borderRadius: Radius.xl,
      paddingHorizontal: 14, paddingVertical: 6,
    },
    followBtnOutlined: {
      backgroundColor: 'transparent',
      borderWidth: 1.5, borderColor: colors.primary,
    },
    followBtnText: { color: colors.surface, fontFamily: Fonts.bold, fontSize: 13 },
    followBtnTextOutlined: { color: colors.primary, fontFamily: Fonts.bold },
  }), [colors]);

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
        <View style={styles.titleRow}>
          <Text style={styles.title}>Social</Text>
          <TouchableOpacity
            onPress={() => router.push('/clubs')}
            testID="clubs-btn"
          >
            <Text style={styles.clubsLink}>Clubs</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color={colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search people..."
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={handleSearchChange}
            autoCapitalize="none"
            autoCorrect={false}
            testID="search-input"
          />
        </View>

        {isSearchActive ? (
          searching ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} />
          ) : searchResults.length === 0 ? (
            <Text style={styles.emptyText}>No users found</Text>
          ) : (
            searchResults.map(u => renderUserRow(u, 'search'))
          )
        ) : (
          <>
            <View style={styles.followingHeader}>
              <Text style={styles.sectionTitle}>Following</Text>
              {following.length > 0 && (
                <Text style={styles.followingCount}>{following.length}</Text>
              )}
            </View>
            {following.length === 0 ? (
              <Text style={styles.emptyText}>Search for people to follow.</Text>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.avatarStrip}
              >
                {following.map(u => (
                  <TouchableOpacity
                    key={u.id}
                    style={styles.avatarItem}
                    onPress={() => router.push(`/user/${u.id}`)}
                  >
                    <View style={styles.avatarCircle}>
                      <Text style={styles.avatarCircleInitial}>
                        {u.username.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.avatarName} numberOfLines={1}>{u.username}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <Text style={styles.sectionTitle}>Activity</Text>
            {feed.length === 0 ? (
              <Text style={styles.emptyText}>Follow people to see their activity here.</Text>
            ) : (
              feed.map(event => (
                <FeedCard
                  key={event.id}
                  event={event}
                  onLike={() => handleLike(event)}
                />
              ))
            )}
          </>
        )}
      </ScrollView>

    </SafeAreaView>
  );
}
