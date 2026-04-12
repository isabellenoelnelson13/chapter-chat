import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  ActionSheetIOS,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@/lib/auth';
import { getTrending, getBooksByGenre, getRecommended } from '@/lib/discover';
import { upsertBook, type BookSearchResult } from '@/lib/books';
import { addToShelf } from '@/lib/userBooks';
import { Shelf } from '@/types/database';
import { Colors, Spacing, Radius, Shadow } from '@/constants/theme';

const SHELF_OPTIONS = ['Cancel', 'Reading', 'Want to Read', 'Read', 'Did Not Finish'] as const;
const SHELF_KEYS: (Shelf | null)[] = [null, 'reading', 'want', 'read', 'dnf'];

const GENRES = [
  'Fantasy',
  'Romance',
  'Thriller',
  'Sci-Fi',
  'Mystery',
  'Historical Fiction',
  'Literary Fiction',
  'Non-Fiction',
];

type Tab = 'trending' | 'for_you';

export default function DiscoverScreen() {
  const { session } = useAuth();
  const userId = session?.user.id ?? '';

  const [activeTab, setActiveTab] = useState<Tab>('trending');
  const [activeGenre, setActiveGenre] = useState<string | null>(null);
  const [books, setBooks] = useState<BookSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPersonalized, setIsPersonalized] = useState(false);

  const loadBooks = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      if (activeTab === 'for_you') {
        const result = await getRecommended(userId);
        setBooks(result.books);
        setIsPersonalized(result.personalized);
      } else {
        const results = activeGenre
          ? await getBooksByGenre(activeGenre)
          : await getTrending();
        setBooks(results);
      }
    } catch {
      setBooks([]);
    } finally {
      setLoading(false);
    }
  }, [userId, activeTab, activeGenre]);

  // Reload on screen focus (handles navigating back to this tab)
  useFocusEffect(useCallback(() => { loadBooks(); }, [loadBooks]));

  // Reload when tab or genre selection changes, skipping the initial render
  // (which is already handled by useFocusEffect above)
  const skipFirstRef = useRef(true);
  useEffect(() => {
    if (skipFirstRef.current) { skipFirstRef.current = false; return; }
    loadBooks();
  }, [activeTab, activeGenre]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setActiveGenre(null);
  };

  const handleGenrePress = (genre: string) => {
    if (activeGenre === genre) {
      setActiveGenre(null);
    } else {
      setActiveGenre(genre);
    }
  };

  const handleBookPress = (book: BookSearchResult) => {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [...SHELF_OPTIONS],
        cancelButtonIndex: 0,
        title: `Add "${book.title}" to...`,
      },
      async (buttonIndex) => {
        const shelf = SHELF_KEYS[buttonIndex];
        if (!shelf) return;
        try {
          const bookId = await upsertBook(book);
          await addToShelf(userId, bookId, shelf);
        } catch {
          Alert.alert('Error', 'Could not add book. Please try again.');
        }
      }
    );
  };

  if (!session) return null;

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Discover</Text>

      {/* Tab toggle */}
      <View style={styles.tabTrack}>
        <TouchableOpacity
          testID="tab-trending"
          style={[styles.tab, activeTab === 'trending' && styles.activeTab]}
          onPress={() => handleTabChange('trending')}
        >
          <Text style={[styles.tabText, activeTab === 'trending' && styles.activeTabText]}>
            Trending
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="tab-for-you"
          style={[styles.tab, activeTab === 'for_you' && styles.activeTab]}
          onPress={() => handleTabChange('for_you')}
        >
          <Text style={[styles.tabText, activeTab === 'for_you' && styles.activeTabText]}>
            For You
          </Text>
        </TouchableOpacity>
      </View>

      {/* Genre pills — Trending mode only */}
      {activeTab === 'trending' && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.genreRow}
        >
          {GENRES.map((genre) => (
            <TouchableOpacity
              key={genre}
              testID={`genre-pill-${genre}`}
              style={[styles.genrePill, activeGenre === genre && styles.activeGenrePill]}
              onPress={() => handleGenrePress(genre)}
            >
              <Text style={[styles.genreText, activeGenre === genre && styles.activeGenreText]}>
                {genre}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : activeTab === 'for_you' && !isPersonalized ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>
            Add some books to your library and we'll find recommendations for you.
          </Text>
        </View>
      ) : (
        <FlatList
          data={books}
          keyExtractor={(item) => item.hardcover_id}
          contentContainerStyle={books.length === 0 ? styles.emptyContainer : styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              testID={`book-card-${item.hardcover_id}`}
              style={styles.card}
              onPress={() => handleBookPress(item)}
            >
              {item.cover_url ? (
                <Image source={{ uri: item.cover_url }} style={styles.cover} />
              ) : (
                <View style={styles.coverPlaceholder} />
              )}
              <View style={styles.cardInfo}>
                <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.cardAuthor}>{item.author}</Text>
                {item.rating !== null && (
                  <Text style={styles.cardMeta}>
                    ★ {item.rating.toFixed(1)} · {(item.users_read_count / 1000).toFixed(0)}k readers
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No books found.</Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  tabTrack: {
    flexDirection: 'row',
    backgroundColor: Colors.border,
    borderRadius: Radius.xl,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    padding: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: Radius.xl,
  },
  activeTab: { backgroundColor: Colors.surface, ...Shadow.card },
  tabText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  activeTabText: { color: Colors.textPrimary, fontWeight: '700' },
  genreRow: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    gap: 8,
  },
  genrePill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  activeGenrePill: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  genreText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  activeGenreText: { color: Colors.surface },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg, gap: Spacing.sm },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
    ...Shadow.card,
  },
  cover: { width: 50, height: 75, borderRadius: Radius.sm },
  coverPlaceholder: {
    width: 50,
    height: 75,
    borderRadius: Radius.sm,
    backgroundColor: Colors.border,
  },
  cardInfo: { flex: 1, gap: 4, justifyContent: 'center' },
  cardTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '600' },
  cardAuthor: { color: Colors.textSecondary, fontSize: 13 },
  cardMeta: { color: Colors.textTertiary, fontSize: 12 },
});
