import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  ActionSheetIOS,
  TextInput,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import StarRating from '@/components/StarRating';
import { getUserBook, addToShelf, moveShelf, removeFromShelf, rateBook, updateReadDates, updateFormat, type UserBookWithBook, type BookFormat } from '@/lib/userBooks';
import { getBookById, getBookReviews, updatePageCount, updateCoverUrl, updateBookGenres, searchGoogleImages, refreshBookGenres, refreshBookSeries, type BookDetails, type FriendReview, type SeededReview } from '@/lib/books';
import { createEvent } from '@/lib/activity';
import { Shelf } from '@/types/database';
import { useTheme } from '@/lib/theme';
import { Fonts, Spacing, Radius, Shadow } from '@/constants/theme';

const SHELF_OPTIONS = ['Cancel', 'Reading', 'Want to Read', 'Read', 'Did Not Finish', 'Remove from library'] as const;
const SHELF_KEYS: (Shelf | 'remove' | null)[] = [null, 'reading', 'want', 'read', 'dnf', 'remove'];

export default function BookDetailScreen() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const router = useRouter();
  const { bookId } = useLocalSearchParams<{ bookId: string }>();

  const [book, setBook] = useState<BookDetails | null>(null);
  const [userBook, setUserBook] = useState<UserBookWithBook | null>(null);
  const [friendReviews, setFriendReviews] = useState<FriendReview[]>([]);
  const [topReviews, setTopReviews] = useState<SeededReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [descExpanded, setDescExpanded] = useState(false);
  const [shareConfirmed, setShareConfirmed] = useState(false);
  const [reviewEditing, setReviewEditing] = useState(false);
  const [reviewInput, setReviewInput] = useState('');
  const [editingPages, setEditingPages] = useState(false);
  const [pageInput, setPageInput] = useState('');
  const [editingGenres, setEditingGenres] = useState(false);
  const [genreInput, setGenreInput] = useState('');
  const [datePickerField, setDatePickerField] = useState<'started_at' | 'finished_at' | null>(null);
  const [datePickerValue, setDatePickerValue] = useState(new Date());
  const [coverSearchVisible, setCoverSearchVisible] = useState(false);
  const [coverQuery, setCoverQuery] = useState('');
  const [coverResults, setCoverResults] = useState<string[]>([]);
  const [coverSearching, setCoverSearching] = useState(false);

  const userId = session?.user.id ?? '';

  useFocusEffect(
    useCallback(() => {
      if (!userId || !bookId) return;
      setLoading(true);
      Promise.all([getBookById(bookId), getUserBook(userId, bookId)])
        .then(([bookData, userBookData]) => {
          setBook(bookData);
          setUserBook(userBookData);
          setReviewInput(userBookData?.review ?? '');
          setLoading(false);
          // Silently refresh genres from Google Books in the background
          if (bookData) {
            refreshBookGenres(bookId, bookData.title, bookData.author).catch(() => {});
            // Refresh series data from Hardcover if not yet populated
            if (bookData.hardcover_id && !bookData.series_id) {
              refreshBookSeries(bookId, bookData.hardcover_id)
                .then(() => getBookById(bookId))
                .then((refreshed) => { if (refreshed) setBook(refreshed); })
                .catch(() => {});
            }
          }
        })
        .catch(() => setLoading(false));
    }, [userId, bookId])
  );

  // Fetch friend reviews and seeded reviews
  useEffect(() => {
    if (!bookId || !userId) return;
    getBookReviews(bookId, userId)
      .then(({ friendReviews, topReviews }) => {
        setFriendReviews(friendReviews);
        setTopReviews(topReviews);
      })
      .catch(() => {});
  }, [bookId, userId]);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      gap: 4,
    },
    backText: { color: colors.primary, fontSize: 16, fontFamily: Fonts.semiBold },
    scroll: { padding: Spacing.lg, gap: Spacing.lg },

    bookHeader: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
    cover: { width: 140, height: 200, borderRadius: Radius.md },
    coverPlaceholder: {
      width: 140,
      height: 200,
      borderRadius: Radius.md,
      backgroundColor: colors.border,
    },
    bookMeta: { flex: 1, gap: 6, paddingTop: 4 },
    bookTitle: { fontSize: 20, fontFamily: Fonts.bookTitle, color: colors.textPrimary },
    bookAuthor: { fontSize: 15, fontFamily: Fonts.regular, color: colors.textSecondary },

    ratingBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
    ratingBadgeText: { fontSize: 13, color: colors.primary, fontFamily: Fonts.semiBold },
    ratingBadgeReaders: { fontSize: 13, fontFamily: Fonts.regular, color: colors.textTertiary },

    seriesLabel: { fontSize: 13, fontFamily: Fonts.semiBold, color: colors.primary },
    pageCount: { fontSize: 13, fontFamily: Fonts.regular, color: colors.textTertiary },
    pageCountPlaceholder: { fontSize: 13, fontFamily: Fonts.regular, color: colors.primary },
    pageInput: {
      fontSize: 13,
      fontFamily: Fonts.regular,
      color: colors.textPrimary,
      borderBottomWidth: 1,
      borderBottomColor: colors.primary,
      paddingVertical: 2,
      minWidth: 80,
    },
    notFound: { fontSize: 16, fontFamily: Fonts.regular, color: colors.textSecondary },

    sectionTitle: { fontSize: 17, fontFamily: Fonts.bold, color: colors.textPrimary, marginBottom: 8 },

    genreHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    genrePills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    genrePill: {
      backgroundColor: colors.surface,
      borderRadius: Radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 5,
    },
    genrePillText: { fontSize: 13, fontFamily: Fonts.medium, color: colors.textPrimary },
    genreInputRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    genreInput: {
      flex: 1,
      fontSize: 14,
      fontFamily: Fonts.regular,
      color: colors.textPrimary,
      borderBottomWidth: 1,
      borderBottomColor: colors.primary,
      paddingVertical: 4,
    },
    genreSave: { fontSize: 14, fontFamily: Fonts.semiBold, color: colors.primary },
    description: { fontSize: 14, fontFamily: Fonts.bookBody, color: colors.textSecondary, lineHeight: 20 },
    showMore: { color: colors.primary, fontSize: 13, fontFamily: Fonts.semiBold, marginTop: 4 },

    reviewCard: {
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
      ...Shadow.card,
    },
    reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    reviewUsername: { fontSize: 13, fontFamily: Fonts.bold, color: colors.textPrimary },
    reviewRating: { fontSize: 12, fontFamily: Fonts.regular, color: colors.primary },
    reviewText: { fontSize: 13, fontFamily: Fonts.regular, color: colors.textSecondary, lineHeight: 18 },

    actions: { gap: Spacing.sm },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      borderRadius: Radius.xl,
      paddingVertical: 14,
      gap: 6,
    },
    primaryBtnText: { color: colors.surface, fontFamily: Fonts.bold, fontSize: 15 },
    secondaryBtn: {
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: colors.primary,
      borderRadius: Radius.xl,
      paddingVertical: 12,
    },
    secondaryBtnText: { color: colors.primary, fontFamily: Fonts.semiBold, fontSize: 15 },

    formatRow: { flexDirection: 'row', gap: Spacing.sm },
    formatBtn: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 10,
      borderRadius: Radius.xl,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    formatBtnActive: { borderColor: colors.primary, backgroundColor: '#EDE9FA' },
    formatBtnText: { fontSize: 12, fontFamily: Fonts.semiBold, color: colors.textSecondary },
    formatBtnTextActive: { color: colors.primary },

    ratingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
    ratingValue: { fontSize: 14, fontFamily: Fonts.semiBold, color: colors.textSecondary },

    datesCard: {
      backgroundColor: colors.surface,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    dateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingVertical: 12,
      gap: Spacing.sm,
    },
    dateLabel: { fontSize: 14, fontFamily: Fonts.regular, color: colors.textSecondary, width: 64 },
    dateValue: { flex: 1, fontSize: 14, color: colors.textPrimary, fontFamily: Fonts.medium },
    dateDivider: { height: 1, backgroundColor: colors.border, marginHorizontal: Spacing.md },

    coverWrapper: { position: 'relative' },
    coverEditBadge: {
      position: 'absolute',
      bottom: 6,
      right: 6,
      backgroundColor: colors.primary,
      borderRadius: 10,
      width: 22,
      height: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },

    coverModal: { flex: 1, backgroundColor: colors.background },
    coverModalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    coverSearchRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
      padding: Spacing.lg,
    },
    coverSearchInput: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: Spacing.md,
      paddingVertical: 10,
      fontSize: 15,
      fontFamily: Fonts.regular,
      color: colors.textPrimary,
    },
    coverSearchBtn: {
      backgroundColor: colors.primary,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    coverGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      padding: Spacing.md,
      gap: Spacing.sm,
    },
    coverGridItem: {
      width: 100,
      height: 150,
      borderRadius: Radius.sm,
      backgroundColor: colors.border,
    },
    coverEmptyText: {
      color: colors.textTertiary,
      fontFamily: Fonts.regular,
      fontSize: 14,
      textAlign: 'center',
      marginTop: 48,
      width: '100%',
    },

    datePickerOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.4)',
    },
    datePickerSheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: Radius.lg,
      borderTopRightRadius: Radius.lg,
      paddingBottom: 32,
    },
    datePickerHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    datePickerTitle: { fontSize: 16, fontFamily: Fonts.semiBold, color: colors.textPrimary },
    datePickerCancel: { fontSize: 16, fontFamily: Fonts.regular, color: colors.textSecondary },
    datePickerDone: { fontSize: 16, fontFamily: Fonts.semiBold, color: colors.primary },

    reviewSubheader: {
      fontSize: 14,
      fontFamily: Fonts.semiBold,
      color: colors.textSecondary,
      marginBottom: 8,
      marginTop: 4,
    },
  }), [colors]);

  if (!session) return null;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!book) {
    return (
      <SafeAreaView style={styles.container}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <View style={styles.center}>
          <Text style={styles.notFound}>Book not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const shelf = userBook?.shelf ?? null;

  const handleAddToShelf = () => {
    ActionSheetIOS.showActionSheetWithOptions(
      { options: [...SHELF_OPTIONS], cancelButtonIndex: 0, title: `Add "${book.title}" to...` },
      async (buttonIndex) => {
        const s = SHELF_KEYS[buttonIndex];
        if (!s) return;
        try {
          await addToShelf(userId, bookId, s);
          const updated = await getUserBook(userId, bookId);
          setUserBook(updated);
        } catch {
          Alert.alert('Error', 'Could not add book. Please try again.');
        }
      }
    );
  };

  const handleMoveShelf = () => {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [...SHELF_OPTIONS],
        cancelButtonIndex: 0,
        destructiveButtonIndex: SHELF_OPTIONS.length - 1,
        title: `Move "${book.title}" to...`,
      },
      async (buttonIndex) => {
        const newShelf = SHELF_KEYS[buttonIndex];
        if (!newShelf) return;
        if (newShelf === 'remove') {
          await removeFromShelf(userBook!.id);
          router.back();
          return;
        }
        await moveShelf(userBook!.id, newShelf);
        const refreshed = await getUserBook(userId, bookId);
        setUserBook(refreshed);
        if (newShelf === 'reading') {
          await createEvent(userId, 'started_book', bookId, {});
        } else if (newShelf === 'read') {
          await createEvent(userId, 'finished_book', bookId, {
            rating: refreshed?.rating ?? null,
            review_snippet: refreshed?.review ? refreshed.review.slice(0, 200) : null,
          });
        } else if (newShelf === 'want' || newShelf === 'dnf') {
          await createEvent(userId, 'added_to_shelf', bookId, { shelf: newShelf });
        }
      }
    );
  };

  const handleShareProgress = async () => {
    await createEvent(userId, 'shared_session', bookId, {
      pages_read: userBook!.current_page,
      duration_seconds: 0,
    });
    setShareConfirmed(true);
    setTimeout(() => setShareConfirmed(false), 2000);
  };

  const handleRate = async (rating: number) => {
    setUserBook({ ...userBook!, rating });
    await rateBook(userBook!.id, rating, userBook!.review ?? undefined);
  };

  const handleSaveReview = () => {
    const text = reviewInput.trim() || undefined;
    setUserBook({ ...userBook!, review: text ?? null });
    setReviewEditing(false);
    rateBook(userBook!.id, userBook!.rating ?? 0, text);
  };

  const openDatePicker = (field: 'started_at' | 'finished_at') => {
    const current = userBook?.[field];
    setDatePickerValue(current ? new Date(current) : new Date());
    setDatePickerField(field);
  };

  const onDateChange = async (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') {
      setDatePickerField(null);
      if (event.type === 'dismissed' || !selected || !datePickerField) return;
    }
    if (!selected || !datePickerField) return;
    setDatePickerValue(selected);
    if (Platform.OS === 'android') {
      await saveDateSelection(datePickerField, selected);
    }
  };

  const saveDateSelection = async (field: 'started_at' | 'finished_at', date: Date) => {
    const iso = date.toISOString();
    const newStarted = field === 'started_at' ? iso : (userBook?.started_at ?? null);
    const newFinished = field === 'finished_at' ? iso : (userBook?.finished_at ?? null);
    await updateReadDates(userBook!.id, newStarted, newFinished);
    setUserBook({ ...userBook!, started_at: newStarted, finished_at: newFinished });
  };

  const handleSaveGenres = async () => {
    setEditingGenres(false);
    const genres = genreInput.split(',').map(g => g.trim()).filter(Boolean);
    if (!book) return;
    const updated = genres.length > 0 ? genres : (book.genres ?? []);
    setBook({ ...book, genres: updated });
    await updateBookGenres(book.id, updated);
  };

  const openCoverSearch = () => {
    setCoverQuery(book?.title ?? '');
    setCoverResults([]);
    setCoverSearchVisible(true);
  };

  const runCoverSearch = async () => {
    if (!coverQuery.trim()) return;
    setCoverSearching(true);
    try {
      const urls = await searchGoogleImages(coverQuery.trim());
      setCoverResults(urls);
    } catch {
      setCoverResults([]);
    } finally {
      setCoverSearching(false);
    }
  };

  const selectCover = async (coverUrl: string) => {
    if (!book) return;
    await updateCoverUrl(book.id, coverUrl);
    setBook({ ...book, cover_url: coverUrl });
    setCoverSearchVisible(false);
  };

  const handleSavePageCount = async () => {
    const parsed = parseInt(pageInput, 10);
    if (!pageInput.trim() || isNaN(parsed) || parsed <= 0) {
      setEditingPages(false);
      return;
    }
    try {
      await updatePageCount(bookId, parsed);
      setBook({ ...book, page_count: parsed });
    } catch {
      Alert.alert('Error', 'Could not update page count.');
    } finally {
      setEditingPages(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={24} color={colors.primary} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Book header */}
        <View style={styles.bookHeader}>
          <TouchableOpacity onPress={openCoverSearch} style={styles.coverWrapper}>
            {book.cover_url ? (
              <Image source={{ uri: book.cover_url }} style={styles.cover} />
            ) : (
              <View style={styles.coverPlaceholder} />
            )}
            <View style={styles.coverEditBadge}>
              <Ionicons name="camera" size={12} color={colors.surface} />
            </View>
          </TouchableOpacity>
          <View style={styles.bookMeta}>
            <Text style={styles.bookTitle}>{book.title}</Text>
            {book.goodreads_author_id ? (
              <TouchableOpacity
                onPress={() => router.push(`/author/${book.goodreads_author_id}`)}
                testID="author-link"
              >
                <Text style={[styles.bookAuthor, { color: colors.primary }]}>{book.author}</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.bookAuthor}>{book.author}</Text>
            )}

            {/* Hardcover community rating */}
            {book.rating !== null && (
              <View style={styles.ratingBadge} testID="hardcover-rating">
                <Text style={styles.ratingBadgeText}>
                  ★ {book.rating.toFixed(1)}
                </Text>
                {book.users_read_count ? (
                  <Text style={styles.ratingBadgeReaders}>
                    {' '}· {book.users_read_count >= 1000
                      ? `${(book.users_read_count / 1000).toFixed(0)}k`
                      : book.users_read_count} readers
                  </Text>
                ) : null}
              </View>
            )}

            {book.series_name && book.series_id && (
              <TouchableOpacity
                onPress={() => router.push(`/series/${book.series_id}`)}
                testID="series-link"
              >
                <Text style={styles.seriesLabel}>
                  {book.series_name}
                  {book.series_position != null ? ` #${book.series_position}` : ''}
                </Text>
              </TouchableOpacity>
            )}

            {editingPages ? (
              <TextInput
                style={styles.pageInput}
                value={pageInput}
                onChangeText={setPageInput}
                keyboardType="number-pad"
                placeholder="Enter page count"
                placeholderTextColor={colors.textTertiary}
                autoFocus
                onBlur={handleSavePageCount}
                onSubmitEditing={handleSavePageCount}
                returnKeyType="done"
                testID="page-count-input"
              />
            ) : (
              <TouchableOpacity
                onPress={() => {
                  setPageInput(book.page_count ? String(book.page_count) : '');
                  setEditingPages(true);
                }}
                testID="page-count-btn"
              >
                <Text style={book.page_count ? styles.pageCount : styles.pageCountPlaceholder}>
                  {book.page_count ? `${book.page_count} pages` : 'Add page count'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Shelf actions */}
        <View style={styles.actions}>
          {!userBook && (
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={handleAddToShelf}
              testID="add-to-shelf-btn"
            >
              <Ionicons name="add" size={16} color={colors.surface} />
              <Text style={styles.primaryBtnText}>Add to Shelf</Text>
            </TouchableOpacity>
          )}

          {userBook && (
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={handleMoveShelf}
              testID="move-shelf-btn"
            >
              <Text style={styles.secondaryBtnText}>Move to shelf</Text>
            </TouchableOpacity>
          )}

          {userBook && (
            <View style={styles.formatRow}>
              {(['physical', 'ebook', 'audiobook'] as BookFormat[]).map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[styles.formatBtn, userBook.format === f && styles.formatBtnActive]}
                  onPress={async () => {
                    setUserBook({ ...userBook, format: f });
                    await updateFormat(userBook.id, f);
                  }}
                >
                  <Text style={[styles.formatBtnText, userBook.format === f && styles.formatBtnTextActive]}>
                    {f === 'physical' ? '📖 Physical' : f === 'ebook' ? '📱 eBook' : '🎧 Audio'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {shelf === 'reading' && (
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => router.push(`/session/${userBook!.book_id}`)}
              testID="start-session-btn"
            >
              <Ionicons name="play" size={14} color={colors.surface} />
              <Text style={styles.primaryBtnText}>Start Reading Session</Text>
            </TouchableOpacity>
          )}

          {shelf === 'reading' && (
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={handleShareProgress}
              testID="share-progress-btn"
            >
              <Text style={styles.secondaryBtnText}>
                {shareConfirmed ? 'Shared ✓' : 'Share progress'}
              </Text>
            </TouchableOpacity>
          )}

          {shelf === 'read' && (
            <View style={styles.ratingRow} testID="rating-row">
              <StarRating
                rating={userBook!.rating ?? 0}
                size={40}
                onRate={handleRate}
              />
              {(userBook!.rating ?? 0) > 0 && (
                <Text style={styles.ratingValue}>
                  {(userBook!.rating!).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')} / 5
                </Text>
              )}
            </View>
          )}

          {shelf === 'read' && (
            reviewEditing ? (
              <View style={styles.genreInputRow}>
                <TextInput
                  style={[styles.genreInput, { minHeight: 60 }]}
                  value={reviewInput}
                  onChangeText={setReviewInput}
                  placeholder="Write your thoughts..."
                  placeholderTextColor={colors.textTertiary}
                  multiline
                  autoFocus
                  testID="review-input"
                />
                <TouchableOpacity onPress={handleSaveReview} testID="review-save">
                  <Text style={styles.genreSave}>Save</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => setReviewEditing(true)}
                testID={userBook?.review ? 'review-text' : 'review-placeholder'}
              >
                <Text style={userBook?.review ? styles.reviewText : styles.pageCountPlaceholder}>
                  {userBook?.review ?? 'Add a review...'}
                </Text>
              </TouchableOpacity>
            )
          )}

          {(shelf === 'reading' || shelf === 'read') && (
            <View style={styles.datesCard}>
              <TouchableOpacity style={styles.dateRow} onPress={() => openDatePicker('started_at')}>
                <Text style={styles.dateLabel}>Started</Text>
                <Text style={styles.dateValue}>
                  {userBook?.started_at ? new Date(userBook.started_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Tap to set'}
                </Text>
                <Ionicons name="calendar-outline" size={14} color={colors.textTertiary} />
              </TouchableOpacity>
              {shelf === 'read' && (
                <>
                  <View style={styles.dateDivider} />
                  <TouchableOpacity style={styles.dateRow} onPress={() => openDatePicker('finished_at')}>
                    <Text style={styles.dateLabel}>Finished</Text>
                    <Text style={styles.dateValue}>
                      {userBook?.finished_at ? new Date(userBook.finished_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Tap to set'}
                    </Text>
                    <Ionicons name="calendar-outline" size={14} color={colors.textTertiary} />
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}
        </View>

        {/* Genres */}
        <View>
          <View style={styles.genreHeader}>
            <Text style={styles.sectionTitle}>Genres</Text>
            {!editingGenres && (
              <TouchableOpacity onPress={() => {
                setGenreInput((book.genres ?? []).join(', '));
                setEditingGenres(true);
              }}>
                <Ionicons name="pencil-outline" size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>
          {editingGenres ? (
            <View style={styles.genreInputRow}>
              <TextInput
                style={styles.genreInput}
                value={genreInput}
                onChangeText={setGenreInput}
                placeholder="Fantasy, Romance, Fiction…"
                placeholderTextColor={colors.textTertiary}
                autoFocus
                returnKeyType="done"
                onBlur={handleSaveGenres}
                onSubmitEditing={handleSaveGenres}
              />
              <TouchableOpacity onPress={handleSaveGenres}>
                <Text style={styles.genreSave}>Save</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.genrePills}>
              {(book.genres ?? []).length > 0 ? (
                (book.genres ?? []).map((g, i) => (
                  <View key={i} style={styles.genrePill}>
                    <Text style={styles.genrePillText}>{g}</Text>
                  </View>
                ))
              ) : (
                <TouchableOpacity onPress={() => {
                  setGenreInput('');
                  setEditingGenres(true);
                }}>
                  <Text style={styles.pageCountPlaceholder}>Add genres</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Description */}
        {book.description ? (
          <View>
            <Text style={styles.sectionTitle}>Summary</Text>
            <Text
              style={styles.description}
              numberOfLines={descExpanded ? undefined : 4}
            >
              {book.description}
            </Text>
            <TouchableOpacity onPress={() => setDescExpanded(!descExpanded)}>
              <Text style={styles.showMore}>{descExpanded ? 'Show less' : 'Show more'}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Reviews */}
        {(friendReviews.length > 0 || topReviews.length > 0) && (
          <View>
            <Text style={styles.sectionTitle}>Reviews</Text>

            {friendReviews.length > 0 && (
              <View>
                <Text style={styles.reviewSubheader}>From your friends</Text>
                {friendReviews.map((r, i) => (
                  <View key={i} style={styles.reviewCard} testID={`friend-review-${i}`}>
                    <View style={styles.reviewHeader}>
                      <Text style={styles.reviewUsername}>{r.username}</Text>
                      {r.rating !== null && (
                        <Text style={styles.reviewRating}>
                          {'★'.repeat(Math.min(5, Math.max(0, Math.round(r.rating))))}
                          {'☆'.repeat(5 - Math.min(5, Math.max(0, Math.round(r.rating))))}
                        </Text>
                      )}
                    </View>
                    <Text style={styles.reviewText}>{r.review}</Text>
                  </View>
                ))}
              </View>
            )}

            {topReviews.length > 0 && (
              <View>
                <Text style={styles.reviewSubheader}>GoodReads reviews</Text>
                {topReviews.map((r) => (
                  <View key={r.id} style={styles.reviewCard} testID={`seeded-review-${r.id}`}>
                    <View style={styles.reviewHeader}>
                      <Text style={styles.reviewUsername}>{r.reviewerName ?? 'Anonymous'}</Text>
                      {r.rating !== null && (
                        <Text style={styles.reviewRating}>
                          {'★'.repeat(Math.min(5, Math.max(0, Math.round(r.rating))))}
                          {'☆'.repeat(5 - Math.min(5, Math.max(0, Math.round(r.rating))))}
                        </Text>
                      )}
                    </View>
                    <Text style={styles.reviewText}>{r.body}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
      {/* Cover Image Search Modal */}
      <Modal visible={coverSearchVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.coverModal}>
          <View style={styles.coverModalHeader}>
            <TouchableOpacity onPress={() => setCoverSearchVisible(false)}>
              <Text style={styles.datePickerCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.datePickerTitle}>Change Cover</Text>
            <View style={{ width: 56 }} />
          </View>
          <View style={styles.coverSearchRow}>
            <TextInput
              style={styles.coverSearchInput}
              value={coverQuery}
              onChangeText={setCoverQuery}
              placeholder="Search for a cover…"
              placeholderTextColor={colors.textTertiary}
              returnKeyType="search"
              onSubmitEditing={runCoverSearch}
              autoFocus
            />
            <TouchableOpacity style={styles.coverSearchBtn} onPress={runCoverSearch}>
              <Ionicons name="search" size={18} color={colors.surface} />
            </TouchableOpacity>
          </View>
          {coverSearching ? (
            <ActivityIndicator style={{ marginTop: 32 }} color={colors.primary} />
          ) : (
            <ScrollView contentContainerStyle={styles.coverGrid}>
              {coverResults.map((url, i) => (
                <TouchableOpacity key={i} onPress={() => selectCover(url)}>
                  <Image source={{ uri: url }} style={styles.coverGridItem} />
                </TouchableOpacity>
              ))}
              {coverResults.length === 0 && !coverSearching && (
                <Text style={styles.coverEmptyText}>Search above to find covers</Text>
              )}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* Date Picker — iOS modal, Android inline */}
      {datePickerField && Platform.OS === 'ios' && (
        <Modal transparent animationType="slide">
          <View style={styles.datePickerOverlay}>
            <View style={styles.datePickerSheet}>
              <View style={styles.datePickerHeader}>
                <TouchableOpacity onPress={() => setDatePickerField(null)}>
                  <Text style={styles.datePickerCancel}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.datePickerTitle}>
                  {datePickerField === 'started_at' ? 'Start Date' : 'End Date'}
                </Text>
                <TouchableOpacity onPress={async () => {
                  await saveDateSelection(datePickerField, datePickerValue);
                  setDatePickerField(null);
                }}>
                  <Text style={styles.datePickerDone}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={datePickerValue}
                mode="date"
                display="spinner"
                onChange={onDateChange}
                maximumDate={new Date()}
                textColor={colors.textPrimary}
              />
            </View>
          </View>
        </Modal>
      )}
      {datePickerField && Platform.OS === 'android' && (
        <DateTimePicker
          value={datePickerValue}
          mode="date"
          display="default"
          onChange={onDateChange}
          maximumDate={new Date()}
        />
      )}
    </SafeAreaView>
  );
}

