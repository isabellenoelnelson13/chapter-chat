import { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  ActionSheetIOS,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { searchBooks, upsertBook, type BookSearchResult } from '@/lib/books';
import { addToShelf } from '@/lib/userBooks';
import { Shelf } from '@/types/database';

const SHELF_OPTIONS = ['Cancel', 'Reading', 'Want to Read', 'Read', 'Did Not Finish'] as const;
const SHELF_KEYS: (Shelf | null)[] = [null, 'reading', 'want', 'read', 'dnf'];

export default function SearchScreen() {
  const { session } = useAuth();
  const userId = session!.user.id;
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BookSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onChangeText = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const items = await searchBooks(text.trim());
        setResults(items);
      } finally {
        setSearching(false);
      }
    }, 400);
  };

  const addBook = async (book: BookSearchResult, shelf: Shelf) => {
    const bookId = await upsertBook(book);
    await addToShelf(userId, bookId, shelf);
    router.back();
  };

  const showShelfPicker = (book: BookSearchResult) => {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [...SHELF_OPTIONS],
        cancelButtonIndex: 0,
        title: `Add "${book.title}" to...`,
      },
      (buttonIndex) => {
        const shelf = SHELF_KEYS[buttonIndex];
        if (shelf) addBook(book, shelf);
      }
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TextInput
          style={styles.input}
          placeholder="Search by title or author..."
          placeholderTextColor="#555"
          value={query}
          onChangeText={onChangeText}
          autoFocus
          returnKeyType="search"
        />
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.cancel}>Cancel</Text>
        </TouchableOpacity>
      </View>

      {searching && <ActivityIndicator color="#f0c040" style={styles.spinner} />}

      <FlatList
        data={results}
        keyExtractor={(item) => item.google_books_id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.result} onPress={() => showShelfPicker(item)}>
            {item.cover_url ? (
              <Image source={{ uri: item.cover_url }} style={styles.cover} />
            ) : (
              <View style={styles.coverPlaceholder} />
            )}
            <View style={styles.info}>
              <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
              <Text style={styles.author}>{item.author}</Text>
              {item.page_count && (
                <Text style={styles.pages}>{item.page_count} pages</Text>
              )}
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  input: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    color: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  cancel: { color: '#f0c040', fontSize: 15 },
  spinner: { marginVertical: 16 },
  list: { padding: 16, gap: 12 },
  result: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 12,
    gap: 12,
  },
  cover: { width: 50, height: 75, borderRadius: 4 },
  coverPlaceholder: { width: 50, height: 75, borderRadius: 4, backgroundColor: '#2a2a2a' },
  info: { flex: 1, gap: 4, justifyContent: 'center' },
  title: { color: '#fff', fontSize: 15, fontWeight: '600' },
  author: { color: '#888', fontSize: 13 },
  pages: { color: '#555', fontSize: 12 },
});
