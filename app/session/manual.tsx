import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { getShelf, type UserBookWithBook } from '@/lib/userBooks';
import { createSession } from '@/lib/sessions';
import { Colors, Spacing, Radius, Shadow } from '@/constants/theme';

function parseTime(hhmm: string): number | null {
  const parts = hhmm.split(':');
  if (parts.length !== 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m) || h < 0 || m < 0 || m > 59) return null;
  return h * 3600 + m * 60;
}

export default function ManualSessionScreen() {
  const { session } = useAuth();
  const userId = session!.user.id;
  const router = useRouter();

  const [readingBooks, setReadingBooks] = useState<UserBookWithBook[]>([]);
  const [selectedBook, setSelectedBook] = useState<UserBookWithBook | null>(null);
  const [loading, setLoading] = useState(true);
  const [startPage, setStartPage] = useState('');
  const [endPage, setEndPage] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    getShelf(userId, 'reading')
      .then((books) => {
        setReadingBooks(books);
        if (books.length > 0) {
          setSelectedBook(books[0]);
          setStartPage(String(books[0].current_page));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [userId]);

  const logSession = async () => {
    setError('');
    const sp = parseInt(startPage, 10);
    const ep = parseInt(endPage, 10);
    const pageCount = selectedBook?.book.page_count;
    if (
      isNaN(sp) || isNaN(ep) ||
      sp < 0 || ep <= sp ||
      (pageCount !== null && pageCount !== undefined && ep > pageCount)
    ) {
      setError('End page must be greater than start page');
      return;
    }
    const durationSeconds = parseTime(timeStr);
    if (durationSeconds === null) {
      setError('Enter time as H:MM or HH:MM');
      return;
    }
    if (durationSeconds <= 0) {
      setError('Time must be greater than 0');
      return;
    }
    if (!selectedBook) return;

    try {
      await createSession({
        userId,
        bookId: selectedBook.book_id,
        userBookId: selectedBook.id,
        startPage: sp,
        endPage: ep,
        durationSeconds,
        startedAt: new Date(),
      });
      router.back();
    } catch {
      Alert.alert('Error', 'Could not save session. Please try again.');
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={Colors.textSecondary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.heading}>Log a Session</Text>

        {selectedBook && (
          <Text style={styles.bookTitle}>{selectedBook.book.title}</Text>
        )}

        {readingBooks.length === 0 && (
          <Text style={styles.noBooks}>No books currently being read</Text>
        )}

        {readingBooks.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bookPicker}>
            {readingBooks.map((book) => (
              <TouchableOpacity
                key={book.id}
                style={[
                  styles.bookChip,
                  selectedBook?.id === book.id && styles.bookChipActive,
                ]}
                onPress={() => {
                  setSelectedBook(book);
                  setStartPage(String(book.current_page));
                }}
              >
                <Text
                  style={[
                    styles.bookChipText,
                    selectedBook?.id === book.id && styles.bookChipTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {book.book.title}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <View style={styles.row}>
          <View style={styles.halfField}>
            <Text style={styles.label}>Start page</Text>
            <TextInput
              style={styles.input}
              placeholder="Start page"
              placeholderTextColor={Colors.textTertiary}
              value={startPage}
              onChangeText={setStartPage}
              keyboardType="number-pad"
            />
          </View>
          <View style={styles.halfField}>
            <Text style={styles.label}>End page</Text>
            <TextInput
              style={styles.input}
              placeholder="End page"
              placeholderTextColor={Colors.textTertiary}
              value={endPage}
              onChangeText={setEndPage}
              keyboardType="number-pad"
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Time spent</Text>
          <TextInput
            style={styles.input}
            placeholder="HH:MM"
            placeholderTextColor={Colors.textTertiary}
            value={timeStr}
            onChangeText={setTimeStr}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity style={styles.saveBtn} onPress={logSession}>
          <Text style={styles.saveBtnText}>Log Session</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: { padding: Spacing.lg, gap: Spacing.lg },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { color: Colors.textSecondary, fontSize: 15 },
  heading: { color: Colors.primary, fontSize: 28, fontWeight: '700' },
  bookTitle: { color: Colors.primary, fontSize: 16, fontWeight: '600' },
  noBooks: { color: Colors.textSecondary, fontSize: 15 },
  bookPicker: { flexGrow: 0 },
  bookChip: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: Spacing.sm,
    maxWidth: 160,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bookChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  bookChipText: { color: Colors.textSecondary, fontSize: 13 },
  bookChipTextActive: { color: Colors.surface },
  row: { flexDirection: 'row', gap: Spacing.sm },
  halfField: { flex: 1, gap: 6 },
  field: { gap: 6 },
  label: { color: Colors.textSecondary, fontSize: 13, fontWeight: '500' },
  input: {
    backgroundColor: Colors.surface,
    color: Colors.textPrimary,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    ...Shadow.card,
  },
  error: { color: Colors.error, fontSize: 13 },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveBtnText: { color: Colors.surface, fontSize: 16, fontWeight: '700' },
});
