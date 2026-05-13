import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@/lib/auth';
import { getTrending, getRecommended, type TrendingPeriod } from '@/lib/discover';
import { upsertBook, type BookSearchResult } from '@/lib/books';
import { type Recommendation } from '@/lib/agents/types';
import { useTheme } from '@/lib/theme';
import { Fonts, Spacing, Radius, Shadow } from '@/constants/theme';

const PERIODS: { label: string; value: TrendingPeriod }[] = [
  { label: 'Last Month', value: 'last_month' },
  { label: '3 Months', value: '3_months' },
  { label: '1 Year', value: '1_year' },
  { label: 'All Time', value: 'all_time' },
];

type Tab = 'trending' | 'for_you';

export default function DiscoverScreen() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const router = useRouter();
  const userId = session?.user.id ?? '';

  const [activeTab, setActiveTab] = useState<Tab>('trending');
  const [activePeriod, setActivePeriod] = useState<TrendingPeriod>('all_time');
  const [books, setBooks] = useState<BookSearchResult[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPersonalized, setIsPersonalized] = useState(false);

  const loadBooks = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      if (activeTab === 'for_you') {
        const result = await getRecommended(userId);
        setRecommendations(result.books);
        setIsPersonalized(result.personalized);
      } else {
        const results = await getTrending(activePeriod);
        setBooks(results);
      }
    } catch {
      setBooks([]);
    } finally {
      setLoading(false);
    }
  }, [userId, activeTab, activePeriod]);

  // Reload on screen focus (handles navigating back to this tab)
  useFocusEffect(useCallback(() => { loadBooks(); }, [loadBooks]));

  // Reload when tab or period selection changes, skipping the initial render
  // (which is already handled by useFocusEffect above)
  const skipFirstRef = useRef(true);
  useEffect(() => {
    if (skipFirstRef.current) { skipFirstRef.current = false; return; }
    loadBooks();
  }, [activeTab, activePeriod]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setActivePeriod('all_time');
  };

  const handlePeriodPress = (period: TrendingPeriod) => {
    setActivePeriod(period);
  };

  const handleBookPress = async (book: BookSearchResult) => {
    try {
      const bookId = await upsertBook(book);
      router.push(`/book/${bookId}`);
    } catch {
      Alert.alert('Error', 'Could not open book. Please try again.');
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
    title: {
      fontSize: 32,
      fontFamily: Fonts.bold,
      color: colors.primary,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.sm,
    },
    tabTrack: {
      flexDirection: 'row',
      backgroundColor: colors.border,
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
    activeTab: { backgroundColor: colors.surface, ...Shadow.card },
    tabText: { color: colors.textSecondary, fontSize: 13, fontFamily: Fonts.semiBold },
    activeTabText: { color: colors.textPrimary, fontFamily: Fonts.bold },
    pillRow: {
      flexGrow: 0,
      flexShrink: 0,
    },
    genreRow: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.sm,
      gap: 8,
      alignItems: 'center',
    },
    genrePill: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: Radius.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    activeGenrePill: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    genreText: { fontSize: 13, fontFamily: Fonts.semiBold, color: colors.textSecondary },
    activeGenreText: { color: colors.surface, fontFamily: Fonts.semiBold },
    list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg, gap: Spacing.sm },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyText: {
      color: colors.textSecondary,
      fontSize: 15,
      fontFamily: Fonts.regular,
      textAlign: 'center',
      lineHeight: 22,
    },
    card: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
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
      backgroundColor: colors.border,
    },
    cardInfo: { flex: 1, gap: 4, justifyContent: 'center' },
    cardTitle: { color: colors.textPrimary, fontSize: 15, fontFamily: Fonts.bookTitle },
    cardAuthor: { color: colors.textSecondary, fontSize: 13, fontFamily: Fonts.regular },
    cardMeta: { color: colors.textTertiary, fontSize: 12, fontFamily: Fonts.regular },
    cardRationale: {
      color: colors.primary,
      fontSize: 12,
      fontFamily: Fonts.regular,
      fontStyle: 'italic',
      lineHeight: 17,
    },
  }), [colors]);

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

      {/* Period pills — Trending mode only */}
      {activeTab === 'trending' && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.pillRow}
          contentContainerStyle={styles.genreRow}
        >
          {PERIODS.map(({ label, value }) => (
            <TouchableOpacity
              key={value}
              testID={`period-pill-${value}`}
              style={[styles.genrePill, activePeriod === value && styles.activeGenrePill]}
              onPress={() => handlePeriodPress(value)}
            >
              <Text style={[styles.genreText, activePeriod === value && styles.activeGenreText]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : activeTab === 'for_you' && !isPersonalized ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>
            Add some books to your library and we'll find recommendations for you.
          </Text>
        </View>
      ) : activeTab === 'for_you' ? (
        <FlatList
          data={recommendations}
          keyExtractor={(item) => item.hardcover_id}
          contentContainerStyle={recommendations.length === 0 ? styles.emptyContainer : styles.list}
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
                    ★ {item.rating.toFixed(1)} · {item.users_read_count >= 1000 ? `${(item.users_read_count / 1000).toFixed(0)}k` : item.users_read_count} readers
                  </Text>
                )}
                {item.rationale ? (
                  <Text style={styles.cardRationale} numberOfLines={2}>{item.rationale}</Text>
                ) : null}
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No recommendations yet.</Text>
          }
        />
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
                    ★ {item.rating.toFixed(1)} · {item.users_read_count >= 1000 ? `${(item.users_read_count / 1000).toFixed(0)}k` : item.users_read_count} readers
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
