import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { getCurrentBook, type UserBookWithBook } from '@/lib/userBooks';
import { getTodayStats, estimateDaysRemaining, type TodayStats } from '@/lib/stats';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function HomeScreen() {
  const { session } = useAuth();
  const userId = session!.user.id;
  const router = useRouter();

  const [currentBook, setCurrentBook] = useState<UserBookWithBook | null>(null);
  const [stats, setStats] = useState<TodayStats>({ pagesRead: 0, timeSeconds: 0, streak: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getCurrentBook(userId), getTodayStats(userId)]).then(([book, todayStats]) => {
      setCurrentBook(book);
      setStats(todayStats);
      setLoading(false);
    });
  }, [userId]);

  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#f0c040" />
      </View>
    );
  }

  const pacePerDay =
    currentBook?.book.page_count && currentBook.current_page > 0
      ? stats.pagesRead
      : 0;
  const daysLeft =
    currentBook?.book.page_count && typeof estimateDaysRemaining === 'function'
      ? estimateDaysRemaining(pacePerDay, currentBook.current_page, currentBook.book.page_count)
      : null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.greeting}>{getGreeting()}</Text>
        <Text style={styles.date}>{dateStr}</Text>

        {currentBook ? (
          <View style={styles.bookCard}>
            {currentBook.book.cover_url ? (
              <Image source={{ uri: currentBook.book.cover_url }} style={styles.cover} />
            ) : (
              <View style={styles.coverPlaceholder} />
            )}
            <View style={styles.bookInfo}>
              <Text style={styles.bookTitle}>{currentBook.book.title}</Text>
              <Text style={styles.bookAuthor}>{currentBook.book.author}</Text>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: currentBook.book.page_count
                        ? `${Math.round((currentBook.current_page / currentBook.book.page_count) * 100)}%`
                        : '0%',
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {currentBook.current_page} / {currentBook.book.page_count ?? '?'} pages
                {daysLeft !== null ? ` · ~${daysLeft}d left` : ''}
              </Text>
              <TouchableOpacity
                style={styles.startBtn}
                onPress={() => router.push(`/session/${currentBook.book_id}`)}
              >
                <Text style={styles.startBtnText}>Start Reading</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.emptyCard} onPress={() => router.push('/search')}>
            <Text style={styles.emptyIcon}>📖</Text>
            <Text style={styles.emptyText}>Start a book</Text>
            <Text style={styles.emptySubtext}>Search for something to read</Text>
          </TouchableOpacity>
        )}

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{stats.pagesRead}</Text>
            <Text style={styles.statLabel}>pages</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{formatTime(stats.timeSeconds)}</Text>
            <Text style={styles.statLabel}>today</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{stats.streak}</Text>
            <Text style={styles.statLabel}>🔥 streak</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  center: { flex: 1, backgroundColor: '#0f0f0f', justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20, gap: 20 },
  greeting: { color: '#f0c040', fontSize: 22, fontWeight: '700' },
  date: { color: '#888', fontSize: 14 },
  bookCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    gap: 14,
  },
  cover: { width: 70, height: 105, borderRadius: 6 },
  coverPlaceholder: { width: 70, height: 105, borderRadius: 6, backgroundColor: '#2a2a2a' },
  bookInfo: { flex: 1, gap: 6 },
  bookTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  bookAuthor: { color: '#888', fontSize: 13 },
  progressTrack: { height: 4, backgroundColor: '#2a2a2a', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, backgroundColor: '#f0c040', borderRadius: 2 },
  progressText: { color: '#666', fontSize: 12 },
  startBtn: {
    backgroundColor: '#f0c040',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  startBtnText: { color: '#0f0f0f', fontWeight: '700', fontSize: 14 },
  emptyCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyIcon: { fontSize: 40 },
  emptyText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  emptySubtext: { color: '#888', fontSize: 14 },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    justifyContent: 'space-around',
  },
  stat: { alignItems: 'center', gap: 4 },
  statValue: { color: '#fff', fontSize: 22, fontWeight: '700' },
  statLabel: { color: '#888', fontSize: 12 },
});
