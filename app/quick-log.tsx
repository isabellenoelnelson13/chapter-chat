import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { getShelf, type UserBookWithBook } from '@/lib/userBooks';
import { createQuickLog } from '@/lib/sessions';
import { useTheme } from '@/lib/theme';
import { Fonts, Spacing, Radius, Shadow } from '@/constants/theme';

const DAY_OPTIONS = [
  { label: 'Today', offset: 0 },
  { label: 'Yesterday', offset: 1 },
  { label: '2 days ago', offset: 2 },
  { label: '3 days ago', offset: 3 },
];

function dateForOffset(offset: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  d.setHours(12, 0, 0, 0);
  return d;
}

export default function QuickLogScreen() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const router = useRouter();
  const userId = session!.user.id;

  const [books, setBooks] = useState<UserBookWithBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedBookIds, setSelectedBookIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    getShelf(userId, 'reading')
      .then((b) => {
        setBooks(b);
        // Pre-select all books by default
        setSelectedBookIds(new Set(b.map((book) => book.id)));
      })
      .finally(() => setLoading(false));
  }, [userId]);

  const toggleBook = (id: string) => {
    setSelectedBookIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    if (selectedBookIds.size === 0) {
      Alert.alert('Select a book', 'Choose at least one book you read.');
      return;
    }
    setSaving(true);
    const date = dateForOffset(selectedDay);
    try {
      const selected = books.filter((b) => selectedBookIds.has(b.id));
      await Promise.all(
        selected.map((b) =>
          createQuickLog({
            userId,
            bookId: b.book_id,
            page: b.current_page,
            date,
          })
        )
      );
      router.back();
    } catch {
      Alert.alert('Error', 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.sm,
    },
    title: { fontSize: 24, fontFamily: Fonts.bold, color: colors.primary },
    closeBtn: { padding: 4 },
    scroll: { padding: Spacing.lg, gap: Spacing.lg },
    sectionLabel: {
      fontSize: 13,
      fontFamily: Fonts.semiBold,
      color: colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    dayRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
    dayChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: Radius.xl,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    dayChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    dayChipText: { fontSize: 14, fontFamily: Fonts.semiBold, color: colors.textSecondary },
    dayChipTextActive: { color: colors.surface },
    bookCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      padding: Spacing.md,
      borderWidth: 2,
      borderColor: 'transparent',
      ...Shadow.card,
    },
    bookCardSelected: { borderColor: colors.primary },
    cover: { width: 48, height: 72, borderRadius: Radius.sm },
    coverPlaceholder: {
      width: 48,
      height: 72,
      borderRadius: Radius.sm,
      backgroundColor: colors.border,
    },
    bookInfo: { flex: 1, gap: 3 },
    bookTitle: { fontSize: 15, fontFamily: Fonts.bookTitle, color: colors.textPrimary },
    bookAuthor: { fontSize: 12, fontFamily: Fonts.regular, color: colors.textSecondary },
    bookProgress: { fontSize: 12, fontFamily: Fonts.regular, color: colors.textTertiary },
    checkCircle: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkCircleSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    emptyText: {
      textAlign: 'center',
      color: colors.textSecondary,
      fontFamily: Fonts.regular,
      fontSize: 15,
      marginTop: Spacing.xl,
    },
    footer: {
      padding: Spacing.lg,
      paddingBottom: Spacing.xl,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    saveBtn: {
      backgroundColor: colors.primary,
      borderRadius: Radius.md,
      paddingVertical: 16,
      alignItems: 'center',
    },
    saveBtnDisabled: { opacity: 0.5 },
    saveBtnText: { color: colors.surface, fontSize: 16, fontFamily: Fonts.bold },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  }), [colors]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Quick Log</Text>
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* Day selector */}
            <View>
              <Text style={styles.sectionLabel}>When did you read?</Text>
              <View style={styles.dayRow}>
                {DAY_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.offset}
                    style={[styles.dayChip, selectedDay === opt.offset && styles.dayChipActive]}
                    onPress={() => setSelectedDay(opt.offset)}
                  >
                    <Text style={[styles.dayChipText, selectedDay === opt.offset && styles.dayChipTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Book selector */}
            <View>
              <Text style={styles.sectionLabel}>Which books?</Text>
              {books.length === 0 ? (
                <Text style={styles.emptyText}>No books currently being read</Text>
              ) : (
                books.map((book) => {
                  const selected = selectedBookIds.has(book.id);
                  const isPercent = book.format === 'ebook' || book.format === 'audiobook';
                  const progressLabel = isPercent
                    ? `${Math.round(book.progress_percent ?? 0)}% complete`
                    : book.book.page_count
                      ? `Page ${book.current_page} of ${book.book.page_count}`
                      : `Page ${book.current_page}`;

                  return (
                    <TouchableOpacity
                      key={book.id}
                      style={[styles.bookCard, selected && styles.bookCardSelected]}
                      onPress={() => toggleBook(book.id)}
                      activeOpacity={0.7}
                    >
                      {book.book.cover_url ? (
                        <Image source={{ uri: book.book.cover_url }} style={styles.cover} />
                      ) : (
                        <View style={styles.coverPlaceholder} />
                      )}
                      <View style={styles.bookInfo}>
                        <Text style={styles.bookTitle} numberOfLines={2}>{book.book.title}</Text>
                        <Text style={styles.bookAuthor}>{book.book.author}</Text>
                        <Text style={styles.bookProgress}>{progressLabel}</Text>
                      </View>
                      <View style={[styles.checkCircle, selected && styles.checkCircleSelected]}>
                        {selected && <Ionicons name="checkmark" size={14} color={colors.surface} />}
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.saveBtn, (saving || selectedBookIds.size === 0) && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving || selectedBookIds.size === 0}
            >
              {saving
                ? <ActivityIndicator color={colors.surface} />
                : <Text style={styles.saveBtnText}>
                    Log {selectedBookIds.size === 1 ? '1 book' : `${selectedBookIds.size} books`}
                  </Text>
              }
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}
