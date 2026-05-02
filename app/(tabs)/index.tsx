import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { getShelf, type UserBookWithBook } from '@/lib/userBooks';
import { getTodayStats, estimateDaysRemaining, type TodayStats } from '@/lib/stats';
import { getFriendsFeed, type ActivityEvent } from '@/lib/activity';
import { getProfile } from '@/lib/profile';
import { scheduleStreakProtection, getNotificationPreferences, getUnreadCount } from '@/lib/notifications';
import { useTheme } from '@/lib/theme';
import { Fonts, Spacing, Radius, Shadow } from '@/constants/theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = SCREEN_WIDTH - 2 * Spacing.lg;

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function eventSummary(event: ActivityEvent): string {
  switch (event.eventType) {
    case 'started_book': return `is now reading ${event.bookTitle}`;
    case 'finished_book': return `finished ${event.bookTitle}`;
    case 'added_to_shelf':
      return event.metadata.shelf === 'want'
        ? `wants to read ${event.bookTitle}`
        : `added ${event.bookTitle} to DNF`;
    case 'shared_session':
      return `read ${event.metadata.pages_read} pages of ${event.bookTitle}`;
  }
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function HomeScreen() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const router = useRouter();

  const [readingBooks, setReadingBooks] = useState<UserBookWithBook[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [stats, setStats] = useState<TodayStats>({ pagesRead: 0, timeSeconds: 0, streak: 0 });
  const [friendsFeed, setFriendsFeed] = useState<ActivityEvent[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const userId = session?.user.id ?? '';

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      setLoading(true);
      Promise.all([getShelf(userId, 'reading'), getTodayStats(userId), getFriendsFeed(userId), getProfile(userId)])
        .then(([books, todayStats, feed, profile]) => {
          setReadingBooks(books);
          setStats(todayStats);
          setFriendsFeed(feed);
          setAvatarUrl(profile?.avatar_url ?? null);
          getUnreadCount(userId).then(setUnreadCount);
          setLoading(false);
          // Schedule streak protection based on today's reading activity
          getNotificationPreferences(userId).then((prefs) => {
            if (prefs.streakProtectionEnabled) {
              scheduleStreakProtection(todayStats.pagesRead > 0);
            }
          });
        })
        .catch(() => setLoading(false));
    }, [userId])
  );

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: {
      flex: 1,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
    scroll: { padding: Spacing.lg, gap: Spacing.lg },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    greeting: { fontSize: 28, fontFamily: Fonts.bold, color: colors.primary },
    date: { fontSize: 14, fontFamily: Fonts.regular, color: colors.textSecondary, marginTop: 2 },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    profileBtn: { padding: 4 },
    profileAvatar: { width: 36, height: 36, borderRadius: 18 },
    badge: {
      position: 'absolute',
      top: -4,
      right: -4,
      backgroundColor: colors.error,
      borderRadius: 8,
      minWidth: 16,
      height: 16,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 3,
    },
    badgeText: { color: '#FFFFFF', fontSize: 9, fontFamily: Fonts.bold },

    bookCard: {
      backgroundColor: colors.primary,
      borderRadius: Radius.lg,
      padding: Spacing.md,
      flexDirection: 'row',
      gap: Spacing.md,
      ...Shadow.card,
    },
    cover: { width: 80, height: 120, borderRadius: Radius.sm },
    coverPlaceholder: {
      width: 80,
      height: 120,
      borderRadius: Radius.sm,
      backgroundColor: 'rgba(255,255,255,0.2)',
    },
    bookInfo: { flex: 1, gap: 6 },
    bookTitle: { color: colors.surface, fontSize: 17, fontFamily: Fonts.bookTitle },
    bookAuthor: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontFamily: Fonts.regular },
    progressTrack: {
      height: 4,
      backgroundColor: 'rgba(255,255,255,0.3)',
      borderRadius: 2,
      overflow: 'hidden',
    },
    progressFill: { height: 4, backgroundColor: colors.surface, borderRadius: 2 },
    progressText: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontFamily: Fonts.regular },
    startBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderRadius: Radius.xl,
      paddingVertical: 10,
      gap: 6,
      marginTop: 4,
    },
    startBtnText: { color: colors.primary, fontFamily: Fonts.bold, fontSize: 14 },

    emptyCard: {
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      padding: 32,
      alignItems: 'center',
      gap: Spacing.sm,
      ...Shadow.card,
    },
    emptyText: { color: colors.textPrimary, fontSize: 18, fontFamily: Fonts.semiBold },
    emptySubtext: { color: colors.textSecondary, fontSize: 14, fontFamily: Fonts.regular },

    dotsRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 6,
      marginTop: Spacing.sm,
    },
    dot: { width: 8, height: 8, borderRadius: 4 },
    dotActive: { backgroundColor: colors.primary },
    dotInactive: { borderWidth: 1.5, borderColor: colors.primary, backgroundColor: 'transparent' },

    sectionTitle: { fontSize: 18, fontFamily: Fonts.bold, color: colors.textPrimary },

    feedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    seeAll: { fontSize: 13, fontFamily: Fonts.semiBold, color: colors.primary },
    emptyFeed: {
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      padding: Spacing.lg,
      alignItems: 'center',
      ...Shadow.card,
    },
    emptyFeedText: { fontSize: 14, fontFamily: Fonts.regular, color: colors.textSecondary },
    feedCard: {
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      padding: Spacing.md,
      flexDirection: 'row',
      gap: Spacing.md,
      alignItems: 'center',
      ...Shadow.card,
    },
    feedCover: { width: 44, height: 64, borderRadius: Radius.sm },
    feedCoverPlaceholder: { width: 44, height: 64, borderRadius: Radius.sm, backgroundColor: colors.border },
    feedInfo: { flex: 1, gap: 3 },
    feedUsername: { fontSize: 13, fontFamily: Fonts.bold, color: colors.primary },
    feedSummary: { fontSize: 13, fontFamily: Fonts.regular, color: colors.textPrimary, lineHeight: 18 },
    feedTime: { fontSize: 12, fontFamily: Fonts.regular, color: colors.textTertiary },
    statsRow: { flexDirection: 'row', gap: Spacing.sm },
    statCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      padding: Spacing.md,
      alignItems: 'center',
      gap: 6,
      ...Shadow.card,
    },
    statValue: { fontSize: 22, fontFamily: Fonts.bold, color: colors.textPrimary },
    statLabel: { fontSize: 12, fontFamily: Fonts.regular, color: colors.textSecondary },
  }), [colors]);

  if (!session) return null;

  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const renderBookCard = (book: UserBookWithBook) => {
    const isPercent = book.format === 'ebook' || book.format === 'audiobook';
    const progress = isPercent
      ? (book.progress_percent ?? 0) / 100
      : book.book.page_count
        ? Math.min(1, book.current_page / book.book.page_count)
        : 0;
    const pct = Math.round(progress * 100);
    const pacePerDay = !isPercent && book.book.page_count && book.current_page > 0 ? stats.pagesRead : 0;
    const daysLeft = !isPercent && book.book.page_count
      ? estimateDaysRemaining(pacePerDay, book.current_page, book.book.page_count)
      : null;

    return (
      <TouchableOpacity
        key={book.id}
        style={[styles.bookCard, { width: CARD_WIDTH }]}
        onPress={() => router.push(`/book/${book.book_id}`)}
        activeOpacity={0.85}
      >
        {book.book.cover_url ? (
          <Image source={{ uri: book.book.cover_url }} style={styles.cover} />
        ) : (
          <View style={styles.coverPlaceholder} />
        )}
        <View style={styles.bookInfo}>
          <Text style={styles.bookTitle} numberOfLines={2}>{book.book.title}</Text>
          <Text style={styles.bookAuthor}>{book.book.author}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${pct}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {isPercent
              ? `${pct}% complete`
              : `${book.current_page} / ${book.book.page_count ?? '?'} pages · ${pct}%`}
            {daysLeft !== null ? `  ·  ~${daysLeft} days left` : ''}
          </Text>
          <TouchableOpacity
            style={styles.startBtn}
            onPress={(e) => { e.stopPropagation(); router.push(`/session/${book.book_id}`); }}
          >
            <Ionicons name="play" size={14} color={colors.primary} />
            <Text style={styles.startBtnText}>Start Reading Session</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderCurrentBookSection = () => {
    if (readingBooks.length === 0) {
      return (
        <TouchableOpacity style={styles.emptyCard} onPress={() => router.push('/search')}>
          <Ionicons name="book-outline" size={40} color={colors.textTertiary} />
          <Text style={styles.emptyText}>Start a book</Text>
          <Text style={styles.emptySubtext}>Search for something to read</Text>
        </TouchableOpacity>
      );
    }

    if (readingBooks.length === 1) {
      return renderBookCard(readingBooks[0]);
    }

    // 2+ books: carousel
    return (
      <View>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={{ width: CARD_WIDTH }}
          onScroll={(e) => {
            const offsetX = e.nativeEvent.contentOffset.x;
            setActiveIndex(Math.round(offsetX / CARD_WIDTH));
          }}
          scrollEventThrottle={16}
        >
          {readingBooks.map(renderBookCard)}
        </ScrollView>
        <View style={styles.dotsRow} testID="carousel-dots">
          {readingBooks.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === activeIndex ? styles.dotActive : styles.dotInactive]}
            />
          ))}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.date}>{dateStr}</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity onPress={() => router.push('/notifications-inbox')}>
              <View>
                <Ionicons name="notifications-outline" size={26} color={colors.primary} />
                {unreadCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.profileBtn}
              onPress={() => router.push('/(tabs)/profile')}
            >
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.profileAvatar} />
              ) : (
                <Ionicons name="person-circle-outline" size={36} color={colors.primary} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {renderCurrentBookSection()}

        {/* Today's Progress */}
        <Text style={styles.sectionTitle}>Today's Progress</Text>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="book-outline" size={20} color={colors.primary} />
            <Text style={styles.statValue}>{stats.pagesRead}</Text>
            <Text style={styles.statLabel}>Pages</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="time-outline" size={20} color={colors.primary} />
            <Text style={styles.statValue}>{formatTime(stats.timeSeconds)}</Text>
            <Text style={styles.statLabel}>Time</Text>
          </View>
          <TouchableOpacity style={styles.statCard} onPress={() => router.push('/quick-log')}>
            <Ionicons name="flame" size={20} color={colors.orange} />
            <Text style={styles.statValue}>{stats.streak}</Text>
            <Text style={styles.statLabel}>Streak</Text>
          </TouchableOpacity>
        </View>
        {/* Friends' Activity */}
        <View style={styles.feedHeader}>
          <Text style={styles.sectionTitle}>Friends' Activity</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/social')}>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>
        {friendsFeed.length === 0 ? (
          <TouchableOpacity
            style={styles.emptyFeed}
            onPress={() => router.push('/(tabs)/social')}
          >
            <Text style={styles.emptyFeedText}>Follow friends to see their activity</Text>
          </TouchableOpacity>
        ) : (
          friendsFeed.map((event) => (
            <TouchableOpacity
              key={event.id}
              style={styles.feedCard}
              onPress={() => router.push(`/activity/${event.id}`)}
            >
              {event.bookCoverUrl ? (
                <Image source={{ uri: event.bookCoverUrl }} style={styles.feedCover} />
              ) : (
                <View style={styles.feedCoverPlaceholder} />
              )}
              <View style={styles.feedInfo}>
                <Text style={styles.feedUsername}>{event.actorUsername}</Text>
                <Text style={styles.feedSummary} numberOfLines={2}>
                  {eventSummary(event)}
                </Text>
                <Text style={styles.feedTime}>{timeAgo(event.createdAt)}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
