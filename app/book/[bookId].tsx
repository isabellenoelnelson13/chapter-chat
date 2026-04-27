import { useCallback, useEffect, useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { getUserBook, addToShelf, moveShelf, removeFromShelf, rateBook, updateReadDates, type UserBookWithBook } from '@/lib/userBooks';
import { getBookById, getBookReviews, updatePageCount, type BookDetails, type HardcoverReview } from '@/lib/books';
import { createEvent } from '@/lib/activity';
import { Shelf } from '@/types/database';
import { Colors, Fonts, Spacing, Radius, Shadow } from '@/constants/theme';

const SHELF_OPTIONS = ['Cancel', 'Reading', 'Want to Read', 'Read', 'Did Not Finish', 'Remove from library'] as const;
const SHELF_KEYS: (Shelf | 'remove' | null)[] = [null, 'reading', 'want', 'read', 'dnf', 'remove'];

export default function BookDetailScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const { bookId } = useLocalSearchParams<{ bookId: string }>();

  const [book, setBook] = useState<BookDetails | null>(null);
  const [userBook, setUserBook] = useState<UserBookWithBook | null>(null);
  const [reviews, setReviews] = useState<HardcoverReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [descExpanded, setDescExpanded] = useState(false);
  const [shareConfirmed, setShareConfirmed] = useState(false);
  const [editingPages, setEditingPages] = useState(false);
  const [pageInput, setPageInput] = useState('');

  const userId = session?.user.id ?? '';

  useFocusEffect(
    useCallback(() => {
      if (!userId || !bookId) return;
      setLoading(true);
      Promise.all([getBookById(bookId), getUserBook(userId, bookId)])
        .then(([bookData, userBookData]) => {
          setBook(bookData);
          setUserBook(userBookData);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }, [userId, bookId])
  );

  // Fetch reviews once we know the hardcover_id
  useEffect(() => {
    if (!book?.hardcover_id) return;
    getBookReviews(book.hardcover_id).then(setReviews).catch(() => {});
  }, [book?.hardcover_id]);

  if (!session) return null;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (!book) {
    return (
      <SafeAreaView style={styles.container}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={Colors.primary} />
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
    await rateBook(userBook!.id, rating);
  };

  const promptDate = (field: 'started_at' | 'finished_at') => {
    const current = userBook?.[field];
    const label = field === 'started_at' ? 'Start date' : 'End date';
    const currentFormatted = current ? current.slice(0, 10) : '';
    Alert.prompt(
      `Edit ${label}`,
      'Enter date as YYYY-MM-DD, or leave blank to clear.',
      async (value) => {
        const trimmed = value?.trim() ?? '';
        const iso = trimmed === '' ? null : new Date(trimmed).toISOString();
        if (trimmed !== '' && isNaN(new Date(trimmed).getTime())) {
          Alert.alert('Invalid date', 'Please use YYYY-MM-DD format.');
          return;
        }
        const newStarted = field === 'started_at' ? iso : (userBook?.started_at ?? null);
        const newFinished = field === 'finished_at' ? iso : (userBook?.finished_at ?? null);
        await updateReadDates(userBook!.id, newStarted, newFinished);
        setUserBook({ ...userBook!, started_at: newStarted, finished_at: newFinished });
      },
      'plain-text',
      currentFormatted,
    );
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
        <Ionicons name="chevron-back" size={24} color={Colors.primary} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Book header */}
        <View style={styles.bookHeader}>
          {book.cover_url ? (
            <Image source={{ uri: book.cover_url }} style={styles.cover} />
          ) : (
            <View style={styles.coverPlaceholder} />
          )}
          <View style={styles.bookMeta}>
            <Text style={styles.bookTitle}>{book.title}</Text>
            <Text style={styles.bookAuthor}>{book.author}</Text>

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

            {editingPages ? (
              <TextInput
                style={styles.pageInput}
                value={pageInput}
                onChangeText={setPageInput}
                keyboardType="number-pad"
                placeholder="Enter page count"
                placeholderTextColor={Colors.textTertiary}
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
              <Ionicons name="add" size={16} color={Colors.surface} />
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

          {shelf === 'reading' && (
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => router.push(`/session/${userBook!.book_id}`)}
              testID="start-session-btn"
            >
              <Ionicons name="play" size={14} color={Colors.surface} />
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
            <View style={styles.starRow} testID="rating-row">
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => handleRate(star)}
                  testID={`star-${star}`}
                >
                  <Text style={styles.star}>
                    {(userBook!.rating ?? 0) >= star ? '★' : '☆'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {(shelf === 'reading' || shelf === 'read') && (
            <View style={styles.datesCard}>
              <TouchableOpacity style={styles.dateRow} onPress={() => promptDate('started_at')}>
                <Text style={styles.dateLabel}>Started</Text>
                <Text style={styles.dateValue}>
                  {userBook?.started_at ? userBook.started_at.slice(0, 10) : 'Tap to set'}
                </Text>
                <Ionicons name="pencil-outline" size={14} color={Colors.textTertiary} />
              </TouchableOpacity>
              {shelf === 'read' && (
                <>
                  <View style={styles.dateDivider} />
                  <TouchableOpacity style={styles.dateRow} onPress={() => promptDate('finished_at')}>
                    <Text style={styles.dateLabel}>Finished</Text>
                    <Text style={styles.dateValue}>
                      {userBook?.finished_at ? userBook.finished_at.slice(0, 10) : 'Tap to set'}
                    </Text>
                    <Ionicons name="pencil-outline" size={14} color={Colors.textTertiary} />
                  </TouchableOpacity>
                </>
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
        {reviews.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Reviews</Text>
            {reviews.map((r, i) => (
              <View key={i} style={styles.reviewCard} testID={`review-${i}`}>
                <View style={styles.reviewHeader}>
                  <Text style={styles.reviewUsername}>{r.username}</Text>
                  {r.rating !== null && (
                    <Text style={styles.reviewRating}>
                      {'★'.repeat(Math.min(5, Math.max(0, r.rating)))}
                      {'☆'.repeat(5 - Math.min(5, Math.max(0, r.rating)))}
                    </Text>
                  )}
                </View>
                <Text style={styles.reviewText}>{r.review}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    gap: 4,
  },
  backText: { color: Colors.primary, fontSize: 16, fontFamily: Fonts.semiBold },
  scroll: { padding: Spacing.lg, gap: Spacing.lg },

  bookHeader: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
  cover: { width: 140, height: 200, borderRadius: Radius.md },
  coverPlaceholder: {
    width: 140,
    height: 200,
    borderRadius: Radius.md,
    backgroundColor: Colors.border,
  },
  bookMeta: { flex: 1, gap: 6, paddingTop: 4 },
  bookTitle: { fontSize: 20, fontFamily: Fonts.bookTitle, color: Colors.textPrimary },
  bookAuthor: { fontSize: 15, fontFamily: Fonts.regular, color: Colors.textSecondary },

  ratingBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  ratingBadgeText: { fontSize: 13, color: Colors.primary, fontFamily: Fonts.semiBold },
  ratingBadgeReaders: { fontSize: 13, fontFamily: Fonts.regular, color: Colors.textTertiary },

  pageCount: { fontSize: 13, fontFamily: Fonts.regular, color: Colors.textTertiary },
  pageCountPlaceholder: { fontSize: 13, fontFamily: Fonts.regular, color: Colors.primary },
  pageInput: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.textPrimary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.primary,
    paddingVertical: 2,
    minWidth: 80,
  },
  notFound: { fontSize: 16, fontFamily: Fonts.regular, color: Colors.textSecondary },

  sectionTitle: { fontSize: 17, fontFamily: Fonts.bold, color: Colors.textPrimary, marginBottom: 8 },
  description: { fontSize: 14, fontFamily: Fonts.bookBody, color: Colors.textSecondary, lineHeight: 20 },
  showMore: { color: Colors.primary, fontSize: 13, fontFamily: Fonts.semiBold, marginTop: 4 },

  reviewCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadow.card,
  },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  reviewUsername: { fontSize: 13, fontFamily: Fonts.bold, color: Colors.textPrimary },
  reviewRating: { fontSize: 12, fontFamily: Fonts.regular, color: Colors.primary },
  reviewText: { fontSize: 13, fontFamily: Fonts.regular, color: Colors.textSecondary, lineHeight: 18 },

  actions: { gap: Spacing.sm },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: Radius.xl,
    paddingVertical: 14,
    gap: 6,
  },
  primaryBtnText: { color: Colors.surface, fontFamily: Fonts.bold, fontSize: 15 },
  secondaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: Radius.xl,
    paddingVertical: 12,
  },
  secondaryBtnText: { color: Colors.primary, fontFamily: Fonts.semiBold, fontSize: 15 },

  starRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.sm },
  star: { fontSize: 32, color: Colors.primary },

  datesCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    gap: Spacing.sm,
  },
  dateLabel: { fontSize: 14, fontFamily: Fonts.regular, color: Colors.textSecondary, width: 64 },
  dateValue: { flex: 1, fontSize: 14, color: Colors.textPrimary, fontFamily: Fonts.medium },
  dateDivider: { height: 1, backgroundColor: Colors.border, marginHorizontal: Spacing.md },
});
