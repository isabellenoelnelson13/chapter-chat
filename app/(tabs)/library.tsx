import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  SectionList,
  Image,
  ActivityIndicator,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { getShelf, type UserBookWithBook } from '@/lib/userBooks';
import { Shelf } from '@/types/database';
import { useTheme } from '@/lib/theme';
import { Fonts, Spacing, Radius, Shadow } from '@/constants/theme';
import StarRating from '@/components/StarRating';
import { curateReadingList } from '@/lib/agents/curator';
import { CuratorResult, CuratorGroup } from '@/lib/agents/types';

const SHELVES: { key: Shelf; label: string }[] = [
  { key: 'reading', label: 'Reading' },
  { key: 'want', label: 'Want to Read' },
  { key: 'read', label: 'Read' },
  { key: 'dnf', label: 'DNF' },
];

export default function LibraryScreen() {
  const { colors } = useTheme();
  const tabBarHeight = useBottomTabBarHeight();
  const { session } = useAuth();
  const router = useRouter();

  const [activeShelf, setActiveShelf] = useState<Shelf>('reading');
  const [books, setBooks] = useState<UserBookWithBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState<'recent' | 'alpha'>('recent');
  const [searchQuery, setSearchQuery] = useState('');

  const [curatorResult, setCuratorResult] = useState<CuratorResult | null>(null);
  const [curatorLoading, setCuratorLoading] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [goalInput, setGoalInput] = useState('');

  const userId = session?.user.id ?? '';

  useEffect(() => {
    if (activeShelf !== 'want') setCuratorResult(null);
  }, [activeShelf]);

  const bookMap = useMemo(
    () => new Map(books.map((b) => [b.book_id, b])),
    [books]
  );

  async function handleCurate() {
    setShowGoalModal(false);
    setCuratorLoading(true);
    try {
      const result = await curateReadingList(userId, goalInput.trim() || undefined);
      setCuratorResult(result);
    } catch {
      setCuratorResult(null);
    } finally {
      setCuratorLoading(false);
    }
  }

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

  const sortedBooks = useMemo(() => {
    if (sortOrder === 'alpha') {
      return [...books].sort((a, b) => a.book.title.localeCompare(b.book.title));
    }
    return books;
  }, [books, sortOrder]);

  const filteredBooks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sortedBooks;
    return sortedBooks.filter(
      (b) =>
        b.book.title.toLowerCase().includes(q) ||
        b.book.author.toLowerCase().includes(q)
    );
  }, [sortedBooks, searchQuery]);

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

    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      marginHorizontal: Spacing.lg,
      marginBottom: Spacing.sm,
      paddingHorizontal: Spacing.md,
      paddingVertical: 9,
      gap: Spacing.sm,
      ...Shadow.card,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      fontFamily: Fonts.regular,
      color: colors.textPrimary,
      padding: 0,
    },

    sortRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.sm,
      gap: Spacing.sm,
    },
    sortLabel: { color: colors.textSecondary, fontSize: 13, fontFamily: Fonts.regular },
    sortBtn: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: Radius.sm,
    },
    sortBtnActive: { backgroundColor: colors.primary },
    sortBtnText: { fontSize: 13, fontFamily: Fonts.semiBold, color: colors.textSecondary },
    sortBtnTextActive: { color: colors.surface },

    list: { paddingHorizontal: Spacing.lg, paddingBottom: tabBarHeight, gap: Spacing.sm },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyText: { color: colors.textSecondary, fontSize: 15, fontFamily: Fonts.regular },

    aiBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.primary,
      paddingHorizontal: Spacing.md,
      paddingVertical: 6,
      borderRadius: Radius.xl,
    },
    aiBtnText: { color: colors.surface, fontSize: 13, fontFamily: Fonts.semiBold },

    summaryBanner: {
      marginHorizontal: Spacing.lg,
      marginBottom: Spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: Radius.md,
      padding: Spacing.md,
      ...Shadow.card,
    },
    summaryText: { color: colors.textSecondary, fontSize: 13, fontFamily: Fonts.regular, lineHeight: 19 },

    sectionHeader: {
      fontSize: 13,
      fontFamily: Fonts.semiBold,
      color: colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginTop: Spacing.md,
      marginBottom: Spacing.xs,
    },

    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'flex-end',
    },
    modalSheetWrapper: { justifyContent: 'flex-end' },
    modalSheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: Radius.xl,
      borderTopRightRadius: Radius.xl,
      padding: Spacing.lg,
      paddingBottom: Spacing.xl,
      gap: Spacing.md,
    },
    modalHandle: {
      width: 36,
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: Spacing.sm,
    },
    modalTitle: { fontSize: 18, fontFamily: Fonts.bold, color: colors.textPrimary },
    modalSubtitle: { fontSize: 14, fontFamily: Fonts.regular, color: colors.textSecondary, lineHeight: 20 },
    goalInput: {
      backgroundColor: colors.background,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: 12,
      fontSize: 15,
      fontFamily: Fonts.regular,
      color: colors.textPrimary,
    },
    modalActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
    modalCancel: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: Radius.md,
      backgroundColor: colors.border,
      alignItems: 'center',
    },
    modalCancelText: { fontFamily: Fonts.semiBold, fontSize: 15, color: colors.textSecondary },
    modalConfirm: {
      flex: 2,
      paddingVertical: 12,
      borderRadius: Radius.md,
      backgroundColor: colors.primary,
      alignItems: 'center',
    },
    modalConfirmText: { fontFamily: Fonts.semiBold, fontSize: 15, color: colors.surface },
  }), [colors, tabBarHeight]);

  if (!session) return null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
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
            onPress={() => { setActiveShelf(key); setSearchQuery(''); }}
          >
            <Text style={[styles.tabText, activeShelf === key && styles.activeTabText]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={16} color={colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by title or author..."
          placeholderTextColor={colors.textTertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          testID="shelf-search-input"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Sort controls / AI button */}
      {activeShelf === 'want' && curatorResult ? (
        <View style={styles.sortRow}>
          <Ionicons name="sparkles" size={14} color={colors.primary} />
          <Text style={[styles.sortLabel, { color: colors.primary, flex: 1 }]}>Organized by AI</Text>
          <TouchableOpacity onPress={() => { setCuratorResult(null); setGoalInput(''); }}>
            <Text style={[styles.sortBtnText, { color: colors.textSecondary }]}>Clear</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.sortRow}>
          {activeShelf !== 'want' && (
            <>
              <Text style={styles.sortLabel}>Sort:</Text>
              <TouchableOpacity
                style={[styles.sortBtn, sortOrder === 'recent' && styles.sortBtnActive]}
                onPress={() => setSortOrder('recent')}
              >
                <Text style={[styles.sortBtnText, sortOrder === 'recent' && styles.sortBtnTextActive]}>Recent</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sortBtn, sortOrder === 'alpha' && styles.sortBtnActive]}
                onPress={() => setSortOrder('alpha')}
              >
                <Text style={[styles.sortBtnText, sortOrder === 'alpha' && styles.sortBtnTextActive]}>A–Z</Text>
              </TouchableOpacity>
            </>
          )}
          {activeShelf === 'want' && (
            <TouchableOpacity
              style={styles.aiBtn}
              onPress={() => setShowGoalModal(true)}
              disabled={curatorLoading || books.length === 0}
            >
              {curatorLoading ? (
                <ActivityIndicator size="small" color={colors.surface} />
              ) : (
                <>
                  <Ionicons name="sparkles" size={14} color={colors.surface} />
                  <Text style={styles.aiBtnText}>Organize with AI</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* AI summary banner */}
      {activeShelf === 'want' && curatorResult?.summary && (
        <View style={styles.summaryBanner}>
          <Text style={styles.summaryText}>{curatorResult.summary}</Text>
        </View>
      )}

      {loading || curatorLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : activeShelf === 'want' && curatorResult ? (
        <SectionList
          sections={curatorResult.groups.map((g: CuratorGroup) => ({
            title: g.label,
            data: g.books,
          }))}
          keyExtractor={(item) => item.bookId}
          contentContainerStyle={styles.list}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{section.title}</Text>
          )}
          renderItem={({ item }) => {
            const full = bookMap.get(item.bookId);
            if (!full) return null;
            return (
              <TouchableOpacity onPress={() => router.push(`/book/${item.bookId}`)}>
                <BookCard book={full} shelf="want" />
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Nothing to organize yet</Text>
          }
          stickySectionHeadersEnabled={false}
        />
      ) : (
        <FlatList
          data={filteredBooks}
          keyExtractor={(item) => item.id}
          contentContainerStyle={filteredBooks.length === 0 ? styles.emptyContainer : styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => router.push(`/book/${item.book_id}`)}>
              <BookCard book={item} shelf={activeShelf} />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {searchQuery.trim() ? `No results for "${searchQuery.trim()}"` : 'No books here yet'}
            </Text>
          }
        />
      )}

      {/* Goal input modal */}
      <Modal
        visible={showGoalModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowGoalModal(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowGoalModal(false)}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalSheetWrapper}
          >
            <Pressable style={styles.modalSheet} onPress={() => {}}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Organize your reading list</Text>
              <Text style={styles.modalSubtitle}>
                Add a reading goal to prioritize what comes first — or leave it blank to group by series, author, and genre.
              </Text>
              <TextInput
                style={styles.goalInput}
                placeholder="e.g. finish a series, read more nonfiction…"
                placeholderTextColor={colors.textTertiary}
                value={goalInput}
                onChangeText={setGoalInput}
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleCurate}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancel}
                  onPress={() => setShowGoalModal(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalConfirm} onPress={handleCurate}>
                  <Text style={styles.modalConfirmText}>Organize</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
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
          <StarRating rating={book.rating} size={14} gap={2} color={colors.primary} />
        )}
      </View>
    </View>
  );
}
