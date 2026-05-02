import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import {
  getEventById,
  getEventLikes,
  getComments,
  addComment,
  likeEvent,
  unlikeEvent,
  type ActivityEvent,
  type ActivityLike,
  type ActivityComment,
} from '@/lib/activity';
import { sendPushNotification } from '@/lib/notifications';
import { searchUsernames, getUserIdsByUsernames } from '@/lib/follows';
import { useTheme } from '@/lib/theme';
import { Fonts, Spacing, Radius, Shadow } from '@/constants/theme';

/** Extract unique lowercase usernames from a string */
function extractMentions(text: string): string[] {
  const matches: string[] = [];
  const regex = /@(\w+)/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    const u = m[1].toLowerCase();
    if (!matches.includes(u)) matches.push(u);
  }
  return matches;
}

/** Render text with @mentions highlighted */
function MentionText({ text, style }: { text: string; style?: object }) {
  const { colors } = useTheme();
  const parts = text.split(/(@\w+)/g);
  return (
    <Text style={style}>
      {parts.map((part, i) =>
        /^@\w+$/.test(part)
          ? <Text key={i} style={{ color: colors.primary, fontFamily: Fonts.semiBold }}>{part}</Text>
          : part
      )}
    </Text>
  );
}

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

export default function ActivityDetailScreen() {
  const { colors } = useTheme();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const userId = session?.user.id ?? '';

  const [event, setEvent] = useState<ActivityEvent | null>(null);
  const [likes, setLikes] = useState<ActivityLike[]>([]);
  const [comments, setComments] = useState<ActivityComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentInput, setCommentInput] = useState('');
  const [sending, setSending] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionResults, setMentionResults] = useState<{ id: string; username: string }[]>([]);
  const inputRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!eventId || !userId) return;
    Promise.all([
      getEventById(eventId, userId),
      getEventLikes(eventId),
      getComments(eventId),
    ]).then(([ev, lks, cmts]) => {
      setEvent(ev);
      setLikes(lks);
      setComments(cmts);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [eventId, userId]);

  const handleLike = async () => {
    if (!event) return;
    const wasLiked = event.likedByMe;
    setEvent({ ...event, likedByMe: !wasLiked, likeCount: event.likeCount + (wasLiked ? -1 : 1) });
    if (wasLiked) {
      await unlikeEvent(userId, event.id);
      setLikes(prev => prev.filter(l => l.userId !== userId));
    } else {
      await likeEvent(userId, event.id);
      setLikes(prev => [...prev, { userId, username: session?.user.user_metadata?.username ?? 'You' }]);
    }
  };

  const handleCommentChange = (text: string) => {
    setCommentInput(text);
    // Detect if the cursor is inside an @mention
    const match = text.match(/@(\w*)$/);
    if (match) {
      const query = match[1];
      setMentionQuery(query);
      if (query.length > 0) {
        searchUsernames(query, userId).then(setMentionResults);
      } else {
        setMentionResults([]);
      }
    } else {
      setMentionQuery(null);
      setMentionResults([]);
    }
  };

  const insertMention = (username: string) => {
    // Replace the trailing @partial with @username
    const replaced = commentInput.replace(/@(\w*)$/, `@${username} `);
    setCommentInput(replaced);
    setMentionQuery(null);
    setMentionResults([]);
    inputRef.current?.focus();
  };

  const handleSend = async () => {
    if (!event || !commentInput.trim()) return;
    setSending(true);
    const body = commentInput.trim();
    setCommentInput('');
    try {
      const newComment = await addComment(userId, event.id, body);
      setComments(prev => [...prev, newComment]);
      setEvent(prev => prev ? { ...prev, commentCount: prev.commentCount + 1 } : prev);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
      const commenterName = session?.user.user_metadata?.username ?? 'Someone';
      // Notify the post author (unless they are commenting on their own post)
      if (event.actorId !== userId) {
        sendPushNotification(
          event.actorId,
          'New comment',
          `${commenterName} commented on your update`,
          { eventId: event.id },
        );
      }
      // Notify mentioned users
      const mentioned = extractMentions(body);
      if (mentioned.length > 0) {
        getUserIdsByUsernames(mentioned).then((users) => {
          users
            .filter((u) => u.id !== userId && u.id !== event.actorId) // skip self & already notified author
            .forEach((u) => {
              sendPushNotification(
                u.id,
                'You were mentioned',
                `${commenterName} mentioned you in a comment`,
                { eventId: event.id },
              );
            });
        });
      }
    } finally {
      setSending(false);
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    backBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, gap: 4 },
    backText: { color: colors.primary, fontSize: 16, fontFamily: Fonts.semiBold },
    notFound: { textAlign: 'center', marginTop: 40, color: colors.textSecondary, fontFamily: Fonts.regular },
    scroll: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: Spacing.xl },
    eventCard: {
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      padding: Spacing.md,
      gap: Spacing.sm,
      ...Shadow.card,
    },
    eventHeader: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
    avatar: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: colors.primary,
      alignItems: 'center', justifyContent: 'center',
    },
    avatarInitial: { color: colors.surface, fontFamily: Fonts.bold, fontSize: 16 },
    headline: { fontSize: 15, fontFamily: Fonts.regular, color: colors.textPrimary, lineHeight: 22 },
    username: { fontFamily: Fonts.bold, color: colors.textPrimary },
    bookTitle: { fontFamily: Fonts.semiBold, color: colors.primary },
    timestamp: { fontSize: 12, fontFamily: Fonts.regular, color: colors.textTertiary, marginTop: 2 },
    cover: { width: 48, height: 70, borderRadius: Radius.sm },
    snippet: {
      fontSize: 14, fontFamily: Fonts.bookBody,
      color: colors.textSecondary, fontStyle: 'italic',
      lineHeight: 20, paddingHorizontal: 4,
    },
    sessionStats: { flexDirection: 'row', gap: 6, alignItems: 'center' },
    sessionStat: { fontSize: 13, fontFamily: Fonts.medium, color: colors.textSecondary },
    sessionDot: { color: colors.textTertiary },
    likeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    likeCount: { fontSize: 14, fontFamily: Fonts.regular, color: colors.textSecondary },
    likeCountActive: { color: colors.error },
    section: { gap: Spacing.sm },
    sectionTitle: { fontSize: 16, fontFamily: Fonts.bold, color: colors.textPrimary },
    likedByRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    likedByChip: {
      backgroundColor: colors.surface,
      borderRadius: Radius.xl,
      paddingHorizontal: 12, paddingVertical: 5,
      borderWidth: 1, borderColor: colors.border,
      ...Shadow.card,
    },
    likedByText: { fontSize: 13, fontFamily: Fonts.medium, color: colors.textPrimary },
    commentRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
    commentAvatar: {
      width: 32, height: 32, borderRadius: 16,
      backgroundColor: colors.primary,
      alignItems: 'center', justifyContent: 'center',
    },
    commentInitial: { color: colors.surface, fontFamily: Fonts.bold, fontSize: 13 },
    commentBody: {
      flex: 1, backgroundColor: colors.surface,
      borderRadius: Radius.md, padding: Spacing.sm, gap: 3,
      ...Shadow.card,
    },
    commentMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    commentUsername: { fontSize: 13, fontFamily: Fonts.bold, color: colors.textPrimary },
    commentTime: { fontSize: 11, fontFamily: Fonts.regular, color: colors.textTertiary },
    commentText: { fontSize: 14, fontFamily: Fonts.regular, color: colors.textPrimary, lineHeight: 20 },
    inputBar: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
      paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
      borderTopWidth: 1, borderTopColor: colors.border,
      backgroundColor: colors.surface,
    },
    input: {
      flex: 1, fontSize: 15, fontFamily: Fonts.regular,
      color: colors.textPrimary,
      paddingVertical: 8, paddingHorizontal: Spacing.md,
      backgroundColor: colors.background,
      borderRadius: Radius.xl,
      borderWidth: 1, borderColor: colors.border,
    },
    mentionList: {
      maxHeight: 180,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
    },
    mentionRow: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    mentionRowText: { fontSize: 14, fontFamily: Fonts.semiBold, color: colors.primary },
  }), [colors]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!event) {
    return (
      <SafeAreaView style={styles.container}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.notFound}>Activity not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <SafeAreaView style={styles.container}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Event card */}
          <View style={styles.eventCard}>
            <View style={styles.eventHeader}>
              <View style={styles.avatar}>
                <Text style={styles.avatarInitial}>
                  {event.actorUsername.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.headline} numberOfLines={3}>
                  <Text style={styles.username}>{event.actorUsername}</Text>
                  {' '}{eventVerb(event)}{' '}
                  <Text style={styles.bookTitle}>{event.bookTitle}</Text>
                </Text>
                <Text style={styles.timestamp}>{timeAgo(event.createdAt)}</Text>
              </View>
              {event.bookCoverUrl ? (
                <TouchableOpacity onPress={() => router.push(`/book/${event.bookId}`)}>
                  <Image source={{ uri: event.bookCoverUrl }} style={styles.cover} />
                </TouchableOpacity>
              ) : null}
            </View>

            {event.eventType === 'finished_book' && event.metadata.review_snippet ? (
              <Text style={styles.snippet}>"{event.metadata.review_snippet}"</Text>
            ) : null}

            {event.eventType === 'shared_session' ? (
              <View style={styles.sessionStats}>
                <Text style={styles.sessionStat}>
                  {event.metadata.pages_read} pages
                </Text>
                {event.metadata.duration_seconds > 0 && (
                  <>
                    <Text style={styles.sessionDot}>·</Text>
                    <Text style={styles.sessionStat}>
                      {Math.round(event.metadata.duration_seconds / 60)} min
                    </Text>
                  </>
                )}
              </View>
            ) : null}

            {/* Like button */}
            <TouchableOpacity style={styles.likeBtn} onPress={handleLike}>
              <Ionicons
                name={event.likedByMe ? 'heart-sharp' : 'heart-outline'}
                size={22}
                color={event.likedByMe ? colors.error : colors.textSecondary}
              />
              <Text style={[styles.likeCount, event.likedByMe && styles.likeCountActive]}>
                {event.likeCount} {event.likeCount === 1 ? 'like' : 'likes'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Liked by */}
          {likes.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Liked by</Text>
              <View style={styles.likedByRow}>
                {likes.map((l) => (
                  <View key={l.userId} style={styles.likedByChip}>
                    <Text style={styles.likedByText}>{l.username}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Comments */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {comments.length === 0 ? 'No comments yet' : `Comments (${comments.length})`}
            </Text>
            {comments.map((c) => (
              <View key={c.id} style={styles.commentRow}>
                <View style={styles.commentAvatar}>
                  <Text style={styles.commentInitial}>
                    {c.username.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.commentBody}>
                  <View style={styles.commentMeta}>
                    <Text style={styles.commentUsername}>{c.username}</Text>
                    <Text style={styles.commentTime}>{timeAgo(c.createdAt)}</Text>
                  </View>
                  <MentionText text={c.body} style={styles.commentText} />
                </View>
              </View>
            ))}
          </View>
        </ScrollView>

        {/* @mention autocomplete */}
        {mentionQuery !== null && mentionResults.length > 0 && (
          <FlatList
            data={mentionResults}
            keyExtractor={(item) => item.id}
            style={styles.mentionList}
            keyboardShouldPersistTaps="always"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.mentionRow}
                onPress={() => insertMention(item.username)}
              >
                <Text style={styles.mentionRowText}>@{item.username}</Text>
              </TouchableOpacity>
            )}
          />
        )}

        {/* Comment input */}
        <View style={styles.inputBar}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Add a comment… (@mention someone)"
            placeholderTextColor={colors.textTertiary}
            value={commentInput}
            onChangeText={handleCommentChange}
            returnKeyType="send"
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity onPress={handleSend} disabled={sending || !commentInput.trim()}>
            <Ionicons
              name="send"
              size={22}
              color={commentInput.trim() ? colors.primary : colors.textTertiary}
            />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

