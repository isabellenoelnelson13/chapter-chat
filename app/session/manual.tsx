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
import { useAuth } from '@/lib/auth';
import { getShelf, type UserBookWithBook } from '@/lib/userBooks';
import { createSession } from '@/lib/sessions';

function parseTime(hhmm: string): number | null {
  const parts = hhmm.split(':');
  if (parts.length !== 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m) || m < 0 || m > 59) return null;
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
    if (isNaN(sp) || isNaN(ep) || ep <= sp) {
      setError('End page must be greater than start page');
      return;
    }
    const durationSeconds = parseTime(timeStr);
    if (durationSeconds === null || durationSeconds <= 0) {
      setError('Enter time as H:MM or HH:MM');
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
        <ActivityIndicator color="#f0c040" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
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
                <Text style={styles.bookChipText} numberOfLines={1}>{book.book.title}</Text>
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
              placeholderTextColor="#555"
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
              placeholderTextColor="#555"
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
            placeholderTextColor="#555"
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
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  center: { flex: 1, backgroundColor: '#0f0f0f', justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 24, gap: 20 },
  backBtn: {},
  backText: { color: '#888', fontSize: 15 },
  heading: { color: '#fff', fontSize: 22, fontWeight: '700' },
  bookTitle: { color: '#f0c040', fontSize: 16, fontWeight: '600' },
  noBooks: { color: '#888', fontSize: 15 },
  bookPicker: { flexGrow: 0 },
  bookChip: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    maxWidth: 160,
  },
  bookChipActive: { backgroundColor: '#f0c040' },
  bookChipText: { color: '#fff', fontSize: 13 },
  row: { flexDirection: 'row', gap: 12 },
  halfField: { flex: 1, gap: 6 },
  field: { gap: 6 },
  label: { color: '#888', fontSize: 13 },
  input: {
    backgroundColor: '#1a1a1a',
    color: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
  },
  error: { color: '#ff4444', fontSize: 13 },
  saveBtn: {
    backgroundColor: '#f0c040',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveBtnText: { color: '#0f0f0f', fontSize: 16, fontWeight: '700' },
});
