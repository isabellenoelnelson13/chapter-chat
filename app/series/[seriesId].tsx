import { useEffect, useMemo, useState } from 'react';
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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getSeriesBooks, upsertBook, type BookSearchResult } from '@/lib/books';
import { useTheme } from '@/lib/theme';
import { Fonts, Spacing, Radius, Shadow } from '@/constants/theme';

export default function SeriesScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { seriesId } = useLocalSearchParams<{ seriesId: string }>();

  const [books, setBooks] = useState<BookSearchResult[]>([]);
  const [seriesName, setSeriesName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!seriesId) return;
    getSeriesBooks(seriesId)
      .then((results) => {
        setBooks(results);
        if (results[0]?.series_name) setSeriesName(results[0].series_name);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [seriesId]);

  const handleBookPress = async (book: BookSearchResult) => {
    try {
      const bookId = await upsertBook(book);
      router.push(`/book/${bookId}`);
    } catch {
      // best-effort
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      gap: 4,
    },
    backText: { color: colors.primary, fontSize: 16, fontFamily: Fonts.semiBold },
    heading: {
      fontSize: 22,
      fontFamily: Fonts.bold,
      color: colors.textPrimary,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.md,
    },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyText: { fontSize: 15, fontFamily: Fonts.regular, color: colors.textSecondary },
    list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl, gap: Spacing.sm },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
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
      backgroundColor: colors.border,
    },
    info: { flex: 1, gap: 3 },
    position: { fontSize: 11, fontFamily: Fonts.semiBold, color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.5 },
    title: { fontSize: 15, fontFamily: Fonts.bookTitle, color: colors.textPrimary },
    author: { fontSize: 13, fontFamily: Fonts.regular, color: colors.textSecondary },
    rating: { fontSize: 12, fontFamily: Fonts.regular, color: colors.textTertiary },
  }), [colors]);

  const renderBook = ({ item }: { item: BookSearchResult }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => handleBookPress(item)}
      activeOpacity={0.75}
    >
      {item.cover_url ? (
        <Image source={{ uri: item.cover_url }} style={styles.cover} />
      ) : (
        <View style={styles.coverPlaceholder} />
      )}
      <View style={styles.info}>
        {item.series_position != null && (
          <Text style={styles.position}>Book {item.series_position}</Text>
        )}
        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.author} numberOfLines={1}>{item.author}</Text>
        {item.rating != null && (
          <Text style={styles.rating}>★ {item.rating.toFixed(1)}</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={24} color={colors.primary} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      <Text style={styles.heading}>{seriesName || 'Series'}</Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>Could not load series.</Text>
        </View>
      ) : books.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>No books found in this series.</Text>
        </View>
      ) : (
        <FlatList
          data={books}
          keyExtractor={(b) => b.hardcover_id}
          renderItem={renderBook}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}
