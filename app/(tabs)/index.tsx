import { useCallback, useState } from 'react';
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
import { Colors, Spacing, Radius, Shadow } from '@/constants/theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = SCREEN_WIDTH - 2 * Spacing.lg;

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
  const { session } = useAuth();
  const router = useRouter();

  const [readingBooks, setReadingBooks] = useState<UserBookWithBook[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [stats, setStats] = useState<TodayStats>({ pagesRead: 0, timeSeconds: 0, streak: 0 });
  const [loading, setLoading] = useState(true);

  const userId = session?.user.id ?? '';

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      setLoading(true);
      Promise.all([getShelf(userId, 'reading'), getTodayStats(userId)])
        .then(([books, todayStats]) => {
          setReadingBooks(books);
          setStats(todayStats);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }, [userId])
  );

  if (!session) return null;

  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  const renderBookCard = (book: UserBookWithBook) => {
    const progress = book.book.page_count
      ? Math.min(1, book.current_page / book.book.page_count)
      : 0;
    const pct = Math.round(progress * 100);
    const pacePerDay = book.book.page_count && book.current_page > 0 ? stats.pagesRead : 0;
    const daysLeft = book.book.page_count
      ? estimateDaysRemaining(pacePerDay, book.current_page, book.book.page_count)
      : null;

    return (
      <View key={book.id} style={[styles.bookCard, { width: CARD_WIDTH }]}>
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
            {book.current_page} / {book.book.page_count ?? '?'} pages · {pct}%
            {daysLeft !== null ? `  ·  ~${daysLeft} days left` : ''}
          </Text>
          <TouchableOpacity
            style={styles.startBtn}
            onPress={() => router.push(`/session/${book.book_id}`)}
          >
            <Ionicons name="play" size={14} color={Colors.primary} />
            <Text style={styles.startBtnText}>Start Reading Session</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderCurrentBookSection = () => {
    if (readingBooks.length === 0) {
      return (
        <TouchableOpacity style={styles.emptyCard} onPress={() => router.push('/search')}>
          <Ionicons name="book-outline" size={40} color={Colors.textTertiary} />
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
          <TouchableOpacity
            style={styles.profileBtn}
            onPress={() => router.push('/(tabs)/profile')}
          >
            <Ionicons name="person-circle-outline" size={32} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {renderCurrentBookSection()}

        {/* Today's Progress */}
        <Text style={styles.sectionTitle}>Today's Progress</Text>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="book-outline" size={20} color={Colors.primary} />
            <Text style={styles.statValue}>{stats.pagesRead}</Text>
            <Text style={styles.statLabel}>Pages</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="time-outline" size={20} color={Colors.primary} />
            <Text style={styles.statValue}>{formatTime(stats.timeSeconds)}</Text>
            <Text style={styles.statLabel}>Time</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="flame" size={20} color={Colors.orange} />
            <Text style={styles.statValue}>{stats.streak}</Text>
            <Text style={styles.statLabel}>Streak</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: { padding: Spacing.lg, gap: Spacing.lg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  greeting: { fontSize: 28, fontWeight: '700', color: Colors.primary },
  date: { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
  profileBtn: { padding: 4 },

  bookCard: {
    backgroundColor: Colors.primary,
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
  bookTitle: { color: Colors.surface, fontSize: 17, fontWeight: '700' },
  bookAuthor: { color: 'rgba(255,255,255,0.75)', fontSize: 13 },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: { height: 4, backgroundColor: Colors.surface, borderRadius: 2 },
  progressText: { color: 'rgba(255,255,255,0.75)', fontSize: 12 },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    paddingVertical: 10,
    gap: 6,
    marginTop: 4,
  },
  startBtnText: { color: Colors.primary, fontWeight: '700', fontSize: 14 },

  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 32,
    alignItems: 'center',
    gap: Spacing.sm,
    ...Shadow.card,
  },
  emptyText: { color: Colors.textPrimary, fontSize: 18, fontWeight: '600' },
  emptySubtext: { color: Colors.textSecondary, fontSize: 14 },

  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: Spacing.sm,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotActive: { backgroundColor: Colors.primary },
  dotInactive: { borderWidth: 1.5, borderColor: Colors.primary, backgroundColor: 'transparent' },

  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  statsRow: { flexDirection: 'row', gap: Spacing.sm },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 6,
    ...Shadow.card,
  },
  statValue: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary },
  statLabel: { fontSize: 12, color: Colors.textSecondary },
});
