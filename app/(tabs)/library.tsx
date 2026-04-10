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
import { useAuth } from '@/lib/auth';
import { getShelf, type UserBookWithBook } from '@/lib/userBooks';
import { Shelf } from '@/types/database';

const SHELVES: { key: Shelf; label: string }[] = [
  { key: 'reading', label: 'Reading' },
  { key: 'want', label: 'Want' },
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
      <View style={styles.tabs}>
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
          <ActivityIndicator color="#f0c040" />
        </View>
      ) : (
        <FlatList
          data={books}
          keyExtractor={(item) => item.id}
          contentContainerStyle={books.length === 0 ? styles.emptyContainer : styles.list}
          renderItem={({ item }) => <BookCard book={item} shelf={activeShelf} />}
          ListEmptyComponent={<Text style={styles.emptyText}>No books here yet</Text>}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => router.push('/search')}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function BookCard({ book, shelf }: { book: UserBookWithBook; shelf: Shelf }) {
  const progress = book.book.page_count ? book.current_page / book.book.page_count : 0;

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
        {shelf === 'reading' && book.book.page_count && (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
        )}
        {shelf === 'read' && book.rating !== null && (
          <Text style={styles.rating}>{'★'.repeat(book.rating)}{'☆'.repeat(5 - book.rating)}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  activeTab: { borderBottomWidth: 2, borderBottomColor: '#f0c040' },
  tabText: { color: '#555', fontSize: 13, fontWeight: '600' },
  activeTabText: { color: '#f0c040' },
  list: { padding: 16, gap: 12 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#555', fontSize: 15 },
  card: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 12,
    gap: 12,
  },
  cover: { width: 56, height: 84, borderRadius: 4 },
  coverPlaceholder: { width: 56, height: 84, borderRadius: 4, backgroundColor: '#2a2a2a' },
  cardInfo: { flex: 1, gap: 4, justifyContent: 'center' },
  cardTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },
  cardAuthor: { color: '#888', fontSize: 13 },
  progressTrack: { height: 3, backgroundColor: '#2a2a2a', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 3, backgroundColor: '#f0c040', borderRadius: 2 },
  rating: { color: '#f0c040', fontSize: 14 },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#f0c040',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  fabText: { color: '#0f0f0f', fontSize: 28, fontWeight: '700', lineHeight: 32 },
});
