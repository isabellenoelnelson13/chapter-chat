import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { getShelf, type UserBookWithBook } from '@/lib/userBooks';
import { Shelf } from '@/types/database';
import { Colors, Spacing, Radius, Shadow } from '@/constants/theme';

const SHELVES: { key: Shelf; label: string }[] = [
  { key: 'reading', label: 'Reading' },
  { key: 'want', label: 'Want to Read' },
  { key: 'read', label: 'Read' },
  { key: 'dnf', label: 'DNF' },
];

export default function LibraryScreen() {
  const { session } = useAuth();
  const router = useRouter();

  const [activeShelf, setActiveShelf] = useState<Shelf>('reading');
  const [books, setBooks] = useState<UserBookWithBook[]>([]);
  const [loading, setLoading] = useState(true);

  const userId = session?.user.id ?? '';

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    getShelf(userId, activeShelf)
      .then(setBooks)
      .catch(() => setBooks([]))
      .finally(() => setLoading(false));
  }, [userId, activeShelf]);

  if (!session) return null;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Library</Text>
        <TouchableOpacity style={styles.fab} onPress={() => router.push('/search')} testID="add-book-btn">
          <Ionicons name="add" size={24} color={Colors.surface} />
        </TouchableOpacity>
      </View>

      {/* Shelf tabs (pill selector) */}
      <View style={styles.tabTrack}>
        {SHELVES.map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={[styles.tab, activeShelf === key && styles.activeTab]}
            onPress={() => setActiveShelf(key)}
          >
            <Text style={[styles.tabText, activeShelf === key && styles.activeTabText]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={books}
          keyExtractor={(item) => item.id}
          contentContainerStyle={books.length === 0 ? styles.emptyContainer : styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => router.push(`/book/${item.book_id}`)}>
              <BookCard book={item} shelf={activeShelf} />
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No books here yet</Text>}
        />
      )}
    </SafeAreaView>
  );
}

function BookCard({ book, shelf }: { book: UserBookWithBook; shelf: Shelf }) {
  const progress = book.book.page_count
    ? Math.min(1, book.current_page / book.book.page_count)
    : 0;

  return (
    <View style={styles.card}>
      {book.book.cover_url ? (
        <Image source={{ uri: book.book.cover_url }} style={styles.cover} />
      ) : (
        <View style={styles.coverPlaceholder} />
      )}
      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle} numberOfLines={2}>{book.book.title}</Text>
        <Text style={styles.cardAuthor}>{book.book.author}</Text>
        {shelf === 'reading' && !!book.book.page_count && (
          <>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
            </View>
            <Text style={styles.progressPct}>{Math.round(progress * 100)}% complete</Text>
          </>
        )}
        {shelf === 'read' && book.rating !== null && (
          <Text style={styles.rating}>
            {'★'.repeat(Math.min(5, Math.max(0, book.rating ?? 0)))}
            {'☆'.repeat(5 - Math.min(5, Math.max(0, book.rating ?? 0)))}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  title: { fontSize: 32, fontWeight: '700', color: Colors.primary },
  fab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadow.card,
  },

  // Pill selector
  tabTrack: {
    flexDirection: 'row',
    backgroundColor: Colors.border,
    borderRadius: Radius.xl,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    padding: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: Radius.xl,
  },
  activeTab: { backgroundColor: Colors.surface, ...Shadow.card },
  tabText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
  activeTabText: { color: Colors.textPrimary, fontWeight: '700' },

  list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg, gap: Spacing.sm },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: Colors.textSecondary, fontSize: 15 },

  card: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
    ...Shadow.card,
  },
  cover: { width: 56, height: 84, borderRadius: Radius.sm },
  coverPlaceholder: {
    width: 56,
    height: 84,
    borderRadius: Radius.sm,
    backgroundColor: Colors.border,
  },
  cardInfo: { flex: 1, gap: 4, justifyContent: 'center' },
  cardTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '600' },
  cardAuthor: { color: Colors.textSecondary, fontSize: 13 },
  progressTrack: {
    height: 3,
    backgroundColor: Colors.progressTrack,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: { height: 3, backgroundColor: Colors.progressFill, borderRadius: 2 },
  progressPct: { color: Colors.textSecondary, fontSize: 12 },
  rating: { color: Colors.primary, fontSize: 14 },
});
