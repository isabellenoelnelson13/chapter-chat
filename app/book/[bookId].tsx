import { useCallback, useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { getUserBook, moveShelf, rateBook, type UserBookWithBook } from '@/lib/userBooks';
import { createEvent } from '@/lib/activity';
import { Shelf } from '@/types/database';
import { Colors, Spacing, Radius, Shadow } from '@/constants/theme';

const SHELF_OPTIONS = ['Cancel', 'Reading', 'Want to Read', 'Read', 'Did Not Finish'] as const;
const SHELF_KEYS: (Shelf | null)[] = [null, 'reading', 'want', 'read', 'dnf'];

export default function BookDetailScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const { bookId } = useLocalSearchParams<{ bookId: string }>();

  const [userBook, setUserBook] = useState<UserBookWithBook | null>(null);
  const [loading, setLoading] = useState(true);
  const [descExpanded, setDescExpanded] = useState(false);
  const [shareConfirmed, setShareConfirmed] = useState(false);

  const userId = session?.user.id ?? '';

  useFocusEffect(
    useCallback(() => {
      if (!userId || !bookId) return;
      setLoading(true);
      getUserBook(userId, bookId)
        .then((data) => {
          setUserBook(data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }, [userId, bookId])
  );

  if (!session) return null;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (!userBook) {
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

  const { book, shelf } = userBook;

  const handleMoveShelf = () => {
    ActionSheetIOS.showActionSheetWithOptions(
      { options: [...SHELF_OPTIONS], cancelButtonIndex: 0, title: `Move "${book.title}" to...` },
      async (buttonIndex) => {
        const newShelf = SHELF_KEYS[buttonIndex];
        if (newShelf) {
          await moveShelf(userBook.id, newShelf);
          if (newShelf === 'reading') {
            await createEvent(userId, 'started_book', bookId, {});
          } else if (newShelf === 'read') {
            const ub = await getUserBook(userId, bookId);
            await createEvent(userId, 'finished_book', bookId, {
              rating: ub?.rating ?? null,
              review_snippet: ub?.review ? ub.review.slice(0, 200) : null,
            });
          } else if (newShelf === 'want' || newShelf === 'dnf') {
            await createEvent(userId, 'added_to_shelf', bookId, { shelf: newShelf });
          }
          router.back();
        }
      }
    );
  };

  const handleShareProgress = async () => {
    await createEvent(userId, 'shared_session', bookId, {
      pages_read: userBook.current_page,
      duration_seconds: 0,
    });
    setShareConfirmed(true);
    setTimeout(() => setShareConfirmed(false), 2000);
  };

  const handleRate = async (rating: number) => {
    setUserBook({ ...userBook, rating });
    await rateBook(userBook.id, rating);
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
            {!!book.page_count && (
              <Text style={styles.pageCount}>{book.page_count} pages</Text>
            )}
          </View>
        </View>

        {/* Description */}
        {book.description ? (
          <View>
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

        {/* Action bar */}
        <View style={styles.actions}>
          {shelf === 'reading' && (
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => router.push(`/session/${userBook.book_id}`)}
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
            <View style={styles.ratingRow} testID="rating-row">
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => handleRate(star)}
                  testID={`star-${star}`}
                >
                  <Text style={styles.star}>
                    {(userBook.rating ?? 0) >= star ? '★' : '☆'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={handleMoveShelf}
            testID="move-shelf-btn"
          >
            <Text style={styles.secondaryBtnText}>Move to shelf</Text>
          </TouchableOpacity>
        </View>
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
  backText: { color: Colors.primary, fontSize: 16, fontWeight: '600' },
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
  bookTitle: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary },
  bookAuthor: { fontSize: 15, color: Colors.textSecondary },
  pageCount: { fontSize: 13, color: Colors.textTertiary },
  notFound: { fontSize: 16, color: Colors.textSecondary },

  description: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  showMore: { color: Colors.primary, fontSize: 13, fontWeight: '600', marginTop: 4 },

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
  primaryBtnText: { color: Colors.surface, fontWeight: '700', fontSize: 15 },
  secondaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: Radius.xl,
    paddingVertical: 12,
  },
  secondaryBtnText: { color: Colors.primary, fontWeight: '600', fontSize: 15 },

  ratingRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.sm },
  star: { fontSize: 32, color: Colors.primary },
});
