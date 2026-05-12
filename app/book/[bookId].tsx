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
  KeyboardAvoidingView,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import StarRating from '@/components/StarRating';
import RatingModal from '@/components/RatingModal';
import { getUserBook, addToShelf, moveShelf, removeFromShelf, rateBook, updateReadDates, updateFormat, type UserBookWithBook, type BookFormat } from '@/lib/userBooks';
import { getBookById, getBookReviews, getSimilarBooks, updatePageCount, updateCoverUrl, updateBookGenres, searchGoogleImages, refreshBookGenres, refreshBookSeries, type BookDetails, type BookSummary, type FriendReview, type SeededReview, type RatingBreakdown } from '@/lib/books';
import { createEvent } from '@/lib/activity';
import { getReadingSessions, updateSession, deleteSession, type ReadingSession } from '@/lib/sessions';
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
  const [communityReviews, setCommunityReviews] = useState<FriendReview[]>([]);
  const [ratingBreakdown, setRatingBreakdown] = useState<RatingBreakdown>({ 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 });
  const [reviewSort, setReviewSort] = useState<'helpful' | 'recent'>('helpful');
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
  const [readingSessions, setReadingSessions] = useState<ReadingSession[]>([]);
  const [editingSession, setEditingSession] = useState<ReadingSession | null>(null);
  const [sessionStartPage, setSessionStartPage] = useState('');
  const [sessionEndPage, setSessionEndPage] = useState('');
  const [sessionMinutes, setSessionMinutes] = useState('');
  const [sessionDate, setSessionDate] = useState(new Date());
  const [sessionDatePickerVisible, setSessionDatePickerVisible] = useState(false);
  const [savingSession, setSavingSession] = useState(false);
  const [similarBooks, setSimilarBooks] = useState<BookSummary[]>([]);
  const [coverSearchVisible, setCoverSearchVisible] = useState(false);
  const [coverQuery, setCoverQuery] = useState('');
  const [coverResults, setCoverResults] = useState<string[]>([]);
  const [coverSearching, setCoverSearching] = useState(false);
  const [ratingModalVisible, setRatingModalVisible] = useState(false);

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
            // Load similar books using bookData directly to avoid race conditions
            getSimilarBooks(bookId, userId, bookData.genres ?? [])
              .then(setSimilarBooks)
              .catch(() => {});
          }
        })
        .catch(() => setLoading(false));
    }, [userId, bookId])
  );

  // Fetch friend reviews and seeded reviews
  useEffect(() => {
    if (!bookId || !userId) return;
    getBookReviews(bookId, userId)
      .then(({ friendReviews, topReviews, communityReviews, ratingBreakdown }) => {
        setFriendReviews(friendReviews);
        setTopReviews(topReviews);
        setCommunityReviews(communityReviews);
        setRatingBreakdown(ratingBreakdown);
      })
      .catch(() => {});
  }, [bookId, userId]);

  // Fetch reading sessions
  useEffect(() => {
    if (!bookId || !userId) return;
    getReadingSessions(userId, bookId)
      .then(setReadingSessions)
      .catch(() => {});
  }, [bookId, userId]);

  const breakdownTotal = useMemo(
    () => Object.values(ratingBreakdown).reduce((s, n) => s + n, 0),
    [ratingBreakdown]
  );

  // Unified sorted review list — app user reviews first, then seeded
  const allReviews = useMemo(() => {
    type UserReviewItem = {
      kind: 'user'; key: string; userId: string; username: string;
      avatarUrl: string | null; rating: number | null; text: string; date: string | null;
      helpfulVotes: number;
    };
    type SeededReviewItem = {
      kind: 'seeded'; key: string; name: string;
      rating: number | null; text: string; date: string | null; helpfulVotes: number;
    };
    type ReviewItem = UserReviewItem | SeededReviewItem;

    const userItems: ReviewItem[] = [
      ...friendReviews.map((r, i): UserReviewItem => ({
        kind: 'user', key: `friend-${i}`, userId: r.userId, username: r.username,
        avatarUrl: r.avatarUrl, rating: r.rating, text: r.review, date: r.finishedAt,
        helpfulVotes: 0,
      })),
      ...communityReviews.map((r, i): UserReviewItem => ({
        kind: 'user', key: `community-${i}`, userId: r.userId, username: r.username,
        avatarUrl: r.avatarUrl, rating: r.rating, text: r.review, date: r.finishedAt,
        helpfulVotes: 0,
      })),
    ];

    const seededItems: ReviewItem[] = topReviews.map((r): SeededReviewItem => ({
      kind: 'seeded', key: r.id, name: r.reviewerName ?? 'Anonymous',
      rating: r.rating, text: r.body, date: r.dateAdded ?? null, helpfulVotes: r.helpfulVotes ?? 0,
    }));

    const sortFn = (a: ReviewItem, b: ReviewItem) =>
      reviewSort === 'helpful'
        ? b.helpfulVotes - a.helpfulVotes
        : (b.date ?? '').localeCompare(a.date ?? '');

    return [...userItems.sort(sortFn), ...seededItems.sort(sortFn)];
  }, [friendReviews, communityReviews, topReviews, reviewSort]);

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
    reviewPlaceholderTile: {
      backgroundColor: colors.surface,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: Spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      ...Shadow.card,
    },
    reviewPlaceholderTileText: { fontSize: 14, fontFamily: Fonts.semiBold, color: colors.primary, flex: 1 },
    reviewPlaceholderTileSubtext: { fontSize: 12, fontFamily: Fonts.regular, color: colors.textTertiary, marginTop: 2 },
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

    ratingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
      ...Shadow.card,
    },
    ratingValue: { flex: 1, fontSize: 14, fontFamily: Fonts.semiBold, color: colors.textSecondary },

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

    similarRow: { gap: Spacing.md, paddingVertical: 4 },
    similarCard: { width: 110, gap: 6 },
    similarCover: { width: 110, height: 160, borderRadius: Radius.md },
    similarCoverPlaceholder: {
      backgroundColor: colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    similarTitle: { fontSize: 12, fontFamily: Fonts.semiBold, color: colors.textPrimary, lineHeight: 16 },
    similarAuthor: { fontSize: 11, fontFamily: Fonts.regular, color: colors.textSecondary },

    sessionSectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    addSessionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    addSessionBtnText: { fontSize: 14, fontFamily: Fonts.semiBold, color: colors.primary },
    sessionCard: {
      backgroundColor: colors.surface,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: Spacing.md,
      paddingVertical: 12,
      marginBottom: Spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    sessionInfo: { flex: 1 },
    sessionDate: { fontSize: 13, fontFamily: Fonts.semiBold, color: colors.textPrimary },
    sessionMeta: { fontSize: 12, fontFamily: Fonts.regular, color: colors.textSecondary, marginTop: 2 },
    sessionDuration: { fontSize: 13, fontFamily: Fonts.medium, color: colors.primary },

    ratingHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.lg,
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      padding: Spacing.md,
      ...Shadow.card,
    },
    ratingBig: { fontSize: 48, fontFamily: Fonts.bold, color: colors.textPrimary, lineHeight: 56 },
    ratingSummaryRight: { flex: 1, gap: 4 },
    ratingSummaryStars: { fontSize: 18, color: colors.primary, letterSpacing: 2 },
    ratingsCount: { fontSize: 13, fontFamily: Fonts.regular, color: colors.textSecondary },

    breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 4 },
    breakdownLabel: { fontSize: 12, fontFamily: Fonts.medium, color: colors.textSecondary, width: 20, textAlign: 'right' },
    breakdownBarBg: { flex: 1, height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' },
    breakdownBarFill: { height: 6, backgroundColor: colors.primary, borderRadius: 3 },
    breakdownCount: { fontSize: 11, fontFamily: Fonts.regular, color: colors.textTertiary, width: 24, textAlign: 'right' },

    sortRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: 4 },
    sortBtn: {
      borderRadius: Radius.xl, paddingHorizontal: 14, paddingVertical: 6,
      borderWidth: 1.5, borderColor: colors.border,
    },
    sortBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    sortBtnText: { fontSize: 13, fontFamily: Fonts.semiBold, color: colors.textSecondary },
    sortBtnTextActive: { color: colors.surface },

    reviewFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
    reviewDate: { fontSize: 11, fontFamily: Fonts.regular, color: colors.textTertiary },
    reviewHelpful: { fontSize: 11, fontFamily: Fonts.regular, color: colors.textTertiary },

    reviewAuthorRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    reviewAvatar: { width: 28, height: 28, borderRadius: 14 },
    reviewAvatarInitial: { fontSize: 12, fontFamily: Fonts.bold, color: colors.surface },

    sessionEditBody: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.lg },
    sessionEditRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: Spacing.sm,
    },
    sessionEditLabel: { flex: 1, fontSize: 15, fontFamily: Fonts.regular, color: colors.textPrimary },
    sessionEditValue: { fontSize: 15, fontFamily: Fonts.regular, color: colors.textSecondary },
    sessionEditInput: {
      fontSize: 15,
      fontFamily: Fonts.regular,
      color: colors.textPrimary,
      textAlign: 'right',
      minWidth: 60,
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
          if (s === 'remove') {
            if (userBook) await removeFromShelf(userBook.id);
            setUserBook(null);
          } else {
            await addToShelf(userId, bookId, s);
            const updated = await getUserBook(userId, bookId);
            setUserBook(updated);
          }
        } catch {
          Alert.alert('Error', 'Could not update book. Please try again.');
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

  const openEditSession = (s: ReadingSession) => {
    setSessionStartPage(String(s.start_page));
    setSessionEndPage(String(s.end_page));
    setSessionMinutes(s.duration_seconds > 0 ? String(Math.round(s.duration_seconds / 60)) : '');
    setSessionDate(new Date(s.started_at));
    setSessionDatePickerVisible(false);
    setEditingSession(s);
  };

  const handleSessionOptions = (s: ReadingSession) => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Edit', 'Delete'], destructiveButtonIndex: 2, cancelButtonIndex: 0 },
        (i) => {
          if (i === 1) openEditSession(s);
          if (i === 2) confirmDeleteSession(s.id);
        }
      );
    } else {
      Alert.alert('Session', undefined, [
        { text: 'Edit', onPress: () => openEditSession(s) },
        { text: 'Delete', style: 'destructive', onPress: () => confirmDeleteSession(s.id) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const confirmDeleteSession = (id: string) => {
    Alert.alert('Delete Session', 'Remove this reading session?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => handleDeleteSession(id) },
    ]);
  };

  const handleDeleteSession = async (id: string) => {
    try {
      await deleteSession(id);
      setReadingSessions(prev => prev.filter(s => s.id !== id));
    } catch {
      Alert.alert('Error', 'Could not delete session.');
    }
  };

  const handleSaveSession = async () => {
    if (!editingSession) return;
    const startPage = parseInt(sessionStartPage, 10);
    const endPage = parseInt(sessionEndPage, 10);
    if (isNaN(startPage) || isNaN(endPage) || startPage < 0 || endPage < startPage) {
      Alert.alert('Invalid pages', 'End page must be greater than or equal to start page.');
      return;
    }
    const durationSeconds = sessionMinutes ? Math.round(parseFloat(sessionMinutes) * 60) : 0;
    setSavingSession(true);
    try {
      await updateSession(editingSession.id, { startPage, endPage, durationSeconds, startedAt: sessionDate });
      setReadingSessions(prev => prev.map(s =>
        s.id === editingSession.id
          ? { ...s, start_page: startPage, end_page: endPage, duration_seconds: durationSeconds, started_at: sessionDate.toISOString() }
          : s
      ));
      setEditingSession(null);
    } catch {
      Alert.alert('Error', 'Could not save session.');
    } finally {
      setSavingSession(false);
    }
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

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
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
            <TouchableOpacity
              style={styles.ratingRow}
              onPress={() => setRatingModalVisible(true)}
              testID="rating-row"
              activeOpacity={0.7}
            >
              <StarRating rating={userBook!.rating ?? 0} size={28} />
              <Text style={styles.ratingValue}>
                {(userBook!.rating ?? 0) > 0
                  ? `${Number.isInteger(userBook!.rating) ? userBook!.rating : userBook!.rating!.toFixed(1)} / 5`
                  : 'Tap to rate'}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
            </TouchableOpacity>
          )}

          <RatingModal
            visible={ratingModalVisible}
            initialRating={userBook?.rating ?? 0}
            onSave={(rating) => {
              setRatingModalVisible(false);
              handleRate(rating);
            }}
            onClose={() => setRatingModalVisible(false)}
          />

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
                {userBook?.review ? (
                  <Text style={styles.reviewText}>{userBook.review}</Text>
                ) : (
                  <View style={styles.reviewPlaceholderTile}>
                    <Ionicons name="pencil-outline" size={18} color={colors.primary} />
                    <View>
                      <Text style={styles.reviewPlaceholderTileText}>Add a review...</Text>
                      <Text style={styles.reviewPlaceholderTileSubtext}>Tap to write your thoughts</Text>
                    </View>
                  </View>
                )}
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

        {/* More Like This */}
        {similarBooks.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>More Like This</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.similarRow}>
              {similarBooks.map(b => (
                <TouchableOpacity
                  key={b.id}
                  style={styles.similarCard}
                  onPress={() => router.push(`/book/${b.id}`)}
                  activeOpacity={0.8}
                >
                  {b.cover_url ? (
                    <Image source={{ uri: b.cover_url }} style={styles.similarCover} />
                  ) : (
                    <View style={[styles.similarCover, styles.similarCoverPlaceholder]}>
                      <Ionicons name="book-outline" size={28} color={colors.textTertiary} />
                    </View>
                  )}
                  <Text style={styles.similarTitle} numberOfLines={2}>{b.title}</Text>
                  <Text style={styles.similarAuthor} numberOfLines={1}>{b.author}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Reading Sessions */}
        {(readingSessions.length > 0 || userBook) && (
          <View>
            <View style={styles.sessionSectionHeader}>
              <Text style={styles.sectionTitle}>Reading Sessions</Text>
              <TouchableOpacity
                onPress={() => router.push(`/session/manual?bookId=${bookId}`)}
                style={styles.addSessionBtn}
              >
                <Ionicons name="add" size={16} color={colors.primary} />
                <Text style={styles.addSessionBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
            {readingSessions.map((s) => {
              const pagesRead = s.end_page - s.start_page;
              const mins = Math.round(s.duration_seconds / 60);
              const durationLabel = s.duration_seconds > 0
                ? mins < 60
                  ? `${mins}m`
                  : `${Math.floor(mins / 60)}h ${mins % 60}m`
                : null;
              const date = new Date(s.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
              return (
                <View key={s.id} style={styles.sessionCard} testID={`session-${s.id}`}>
                  <Ionicons name="book-outline" size={18} color={colors.textTertiary} />
                  <View style={styles.sessionInfo}>
                    <Text style={styles.sessionDate}>{date}</Text>
                    <Text style={styles.sessionMeta}>
                      {pagesRead > 0 ? `pp. ${s.start_page}–${s.end_page} (${pagesRead} pages)` : `Page ${s.end_page}`}
                    </Text>
                  </View>
                  {durationLabel && <Text style={styles.sessionDuration}>{durationLabel}</Text>}
                  <TouchableOpacity onPress={() => handleSessionOptions(s)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="ellipsis-horizontal" size={16} color={colors.textTertiary} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        {/* Reviews */}
        {(friendReviews.length > 0 || communityReviews.length > 0 || topReviews.length > 0) && (
          <View style={{ gap: Spacing.md }}>
            <Text style={styles.sectionTitle}>Reviews</Text>

            {/* Rating summary + breakdown */}
            {(book as any).rating != null && (
              <View style={styles.ratingHeader}>
                <Text style={styles.ratingBig}>{Number((book as any).rating).toFixed(1)}</Text>
                <View style={styles.ratingSummaryRight}>
                  <Text style={styles.ratingSummaryStars}>
                    {'★'.repeat(Math.round((book as any).rating))}{'☆'.repeat(5 - Math.round((book as any).rating))}
                  </Text>
                  {(book as any).ratings_count != null && (
                    <Text style={styles.ratingsCount}>
                      {Number((book as any).ratings_count).toLocaleString()} ratings
                    </Text>
                  )}
                  {breakdownTotal > 0 && (
                    <View style={{ marginTop: 6 }}>
                      {([5, 4, 3, 2, 1] as const).map(star => {
                        const count = ratingBreakdown[star];
                        const pct = breakdownTotal > 0 ? count / breakdownTotal : 0;
                        return (
                          <View key={star} style={styles.breakdownRow}>
                            <Text style={styles.breakdownLabel}>{star}★</Text>
                            <View style={styles.breakdownBarBg}>
                              <View style={[styles.breakdownBarFill, { width: `${Math.round(pct * 100)}%` }]} />
                            </View>
                            <Text style={styles.breakdownCount}>{count}</Text>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Sort toggle + unified review list */}
            {allReviews.length > 0 && (
              <View style={{ gap: Spacing.sm }}>
                <View style={styles.sortRow}>
                  {(['helpful', 'recent'] as const).map(s => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.sortBtn, reviewSort === s && styles.sortBtnActive]}
                      onPress={() => setReviewSort(s)}
                    >
                      <Text style={[styles.sortBtnText, reviewSort === s && styles.sortBtnTextActive]}>
                        {s === 'helpful' ? 'Most Helpful' : 'Most Recent'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {allReviews.map((r) => {
                  const stars = r.rating !== null ? (
                    <Text style={styles.reviewRating}>
                      {'★'.repeat(Math.min(5, Math.max(0, Math.round(r.rating))))}
                      {'☆'.repeat(5 - Math.min(5, Math.max(0, Math.round(r.rating))))}
                    </Text>
                  ) : null;
                  const dateStr = r.date
                    ? new Date(r.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                    : null;

                  if (r.kind === 'user') {
                    return (
                      <TouchableOpacity
                        key={r.key}
                        style={styles.reviewCard}
                        onPress={() => router.push(`/user/${r.userId}`)}
                        activeOpacity={0.8}
                      >
                        <View style={styles.reviewHeader}>
                          <View style={styles.reviewAuthorRow}>
                            {r.avatarUrl ? (
                              <Image source={{ uri: r.avatarUrl }} style={styles.reviewAvatar} />
                            ) : (
                              <View style={[styles.reviewAvatar, { backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' }]}>
                                <Text style={styles.reviewAvatarInitial}>{r.username.charAt(0).toUpperCase()}</Text>
                              </View>
                            )}
                            <Text style={styles.reviewUsername}>{r.username}</Text>
                          </View>
                          {stars}
                        </View>
                        <Text style={styles.reviewText}>{r.text}</Text>
                        {dateStr && (
                          <View style={styles.reviewFooter}>
                            <Text style={styles.reviewDate}>Finished {dateStr}</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  }

                  return (
                    <View key={r.key} style={styles.reviewCard}>
                      <View style={styles.reviewHeader}>
                        <Text style={styles.reviewUsername}>{r.name}</Text>
                        {stars}
                      </View>
                      <Text style={styles.reviewText}>{r.text}</Text>
                      <View style={styles.reviewFooter}>
                        {dateStr && <Text style={styles.reviewDate}>{dateStr}</Text>}
                        {r.helpfulVotes > 0 && <Text style={styles.reviewHelpful}>{r.helpfulVotes} helpful</Text>}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
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
      {/* Edit Session Modal */}
      <Modal visible={!!editingSession} transparent animationType="slide">
        <View style={styles.datePickerOverlay}>
          <View style={styles.datePickerSheet}>
            <View style={styles.datePickerHeader}>
              <TouchableOpacity onPress={() => setEditingSession(null)}>
                <Text style={styles.datePickerCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.datePickerTitle}>Edit Session</Text>
              <TouchableOpacity onPress={handleSaveSession} disabled={savingSession}>
                <Text style={[styles.datePickerDone, savingSession && { opacity: 0.4 }]}>Save</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.sessionEditBody}>
              <TouchableOpacity style={styles.sessionEditRow} onPress={() => setSessionDatePickerVisible(v => !v)}>
                <Text style={styles.sessionEditLabel}>Date</Text>
                <Text style={styles.sessionEditValue}>
                  {sessionDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
                <Ionicons name={sessionDatePickerVisible ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textTertiary} />
              </TouchableOpacity>
              {sessionDatePickerVisible && (
                <DateTimePicker
                  value={sessionDate}
                  mode="date"
                  display="spinner"
                  maximumDate={new Date()}
                  textColor={colors.textPrimary}
                  onChange={(_, d) => { if (d) setSessionDate(d); }}
                />
              )}
              <View style={styles.sessionEditRow}>
                <Text style={styles.sessionEditLabel}>Start page</Text>
                <TextInput
                  style={styles.sessionEditInput}
                  value={sessionStartPage}
                  onChangeText={setSessionStartPage}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={colors.textTertiary}
                />
              </View>
              <View style={styles.sessionEditRow}>
                <Text style={styles.sessionEditLabel}>End page</Text>
                <TextInput
                  style={styles.sessionEditInput}
                  value={sessionEndPage}
                  onChangeText={setSessionEndPage}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={colors.textTertiary}
                />
              </View>
              <View style={styles.sessionEditRow}>
                <Text style={styles.sessionEditLabel}>Duration (min)</Text>
                <TextInput
                  style={styles.sessionEditInput}
                  value={sessionMinutes}
                  onChangeText={setSessionMinutes}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={colors.textTertiary}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>

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

