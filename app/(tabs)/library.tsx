import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { getShelf, type UserBookWithBook } from '@/lib/userBooks';
import { Shelf } from '@/types/database';
import { useTheme } from '@/lib/theme';
import { Fonts, Spacing, Radius, Shadow } from '@/constants/theme';

const SHELVES: { key: Shelf; label: string }[] = [
  { key: 'reading', label: 'Reading' },
  { key: 'want', label: 'Want to Read' },
  { key: 'read', label: 'Read' },
  { key: 'dnf', label: 'DNF' },
];

export default function LibraryScreen() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const router = useRouter();

  const [activeShelf, setActiveShelf] = useState<Shelf>('reading');
  const [books, setBooks] = useState<UserBookWithBook[]>([]);
  const [loading, setLoading] = useState(true);

  const userId = session?.user.id ?? '';

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      setLoading(true);
      getShelf(userId, activeShelf)
        .then(setBooks)
        .catch(() => setBooks([]))
        .finally(() => setLoading(false));
    }, [userId, activeShelf])
  );

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.sm,
    },
    title: { fontSize: 32, fontFamily: Fonts.bold, color: colors.primary },
    fab: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      ...Shadow.card,
    },

    // Pill selector
    tabTrack: {
      flexDirection: 'row',
      backgroundColor: colors.border,
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
    activeTab: { backgroundColor: colors.surface, ...Shadow.card },
    tabText: { color: colors.textSecondary, fontSize: 12, fontFamily: Fonts.semiBold },
    activeTabText: { color: colors.textPrimary, fontFamily: Fonts.bold },

    list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg, gap: Spacing.sm },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyText: { color: colors.textSecondary, fontSize: 15, fontFamily: Fonts.regular },
  }), [colors]);

  if (!session) return null;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Library</Text>
        <TouchableOpacity style={styles.fab} onPress={() => router.push('/search')} testID="add-book-btn">
          <Ionicons name="add" size={24} color={colors.surface} />
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
          <ActivityIndicator color={colors.primary} />
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
  const { colors } = useTheme();
  const isPercent = book.format === 'ebook' || book.format === 'audiobook';
  const progress = isPercent
    ? (book.progress_percent ?? 0) / 100
    : book.book.page_count
      ? Math.min(1, book.current_page / book.book.page_count)
      : 0;

  const styles = useMemo(() => StyleSheet.create({
    card: {
      flexDirection: 'row',
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
    cardInfo: { flex: 1, gap: 4, justifyContent: 'center' },
    cardTitle: { color: colors.textPrimary, fontSize: 15, fontFamily: Fonts.bookTitle },
    cardAuthor: { color: colors.textSecondary, fontSize: 13, fontFamily: Fonts.regular },
    cardMeta: { color: colors.textTertiary, fontSize: 12, fontFamily: Fonts.regular },
    progressTrack: {
      height: 3,
      backgroundColor: colors.progressTrack,
      borderRadius: 2,
      overflow: 'hidden',
    },
    progressFill: { height: 3, backgroundColor: colors.progressFill, borderRadius: 2 },
    progressPct: { color: colors.textSecondary, fontSize: 12, fontFamily: Fonts.regular },
    rating: { color: colors.primary, fontSize: 14, fontFamily: Fonts.regular },
  }), [colors]);

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
        {book.book.rating !== null && (
          <Text style={styles.cardMeta}>
            ★ {book.book.rating.toFixed(1)}
            {book.book.users_read_count
              ? ` · ${book.book.users_read_count >= 1000
                  ? `${(book.book.users_read_count / 1000).toFixed(0)}k`
                  : book.book.users_read_count} readers`
              : ''}
          </Text>
        )}
        {shelf === 'reading' && (isPercent || !!book.book.page_count) && (
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
