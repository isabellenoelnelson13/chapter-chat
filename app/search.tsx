import { useEffect, useMemo, useRef, useState } from 'react';
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
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { searchBooks, upsertBook, type BookSearchResult } from '@/lib/books';
import { addToShelf } from '@/lib/userBooks';
import { Shelf } from '@/types/database';
import { useTheme } from '@/lib/theme';
import { Fonts, Spacing, Radius, Shadow } from '@/constants/theme';

const SHELF_OPTIONS = ['Cancel', 'Reading', 'Want to Read', 'Read', 'Did Not Finish'] as const;
const SHELF_KEYS: (Shelf | null)[] = [null, 'reading', 'want', 'read', 'dnf'];

export default function SearchScreen() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BookSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.md,
      gap: Spacing.sm,
    },
    input: {
      flex: 1,
      backgroundColor: colors.surface,
      color: colors.textPrimary,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 15,
      fontFamily: Fonts.regular,
      ...Shadow.card,
    },
    cancel: { color: colors.primary, fontSize: 15, fontFamily: Fonts.semiBold },
    spinner: { marginVertical: Spacing.md },
    list: { padding: Spacing.md, gap: Spacing.sm },
    result: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      padding: Spacing.md,
      gap: Spacing.md,
      ...Shadow.card,
    },
    cover: { width: 50, height: 75, borderRadius: Radius.sm },
    coverPlaceholder: {
      width: 50,
      height: 75,
      borderRadius: Radius.sm,
      backgroundColor: colors.border,
    },
    info: { flex: 1, gap: 4, justifyContent: 'center' },
    title: { color: colors.textPrimary, fontSize: 15, fontFamily: Fonts.bookTitle },
    author: { color: colors.textSecondary, fontSize: 13, fontFamily: Fonts.regular },
    pages: { color: colors.textTertiary, fontSize: 12, fontFamily: Fonts.regular },
    emptyState: {
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.xl,
      gap: Spacing.md,
    },
    emptyText: {
      color: colors.textTertiary,
      fontSize: 15,
      fontFamily: Fonts.regular,
      textAlign: 'center',
    },
    addManuallyBtn: {
      backgroundColor: colors.primary,
      borderRadius: Radius.md,
      paddingVertical: 14,
      paddingHorizontal: Spacing.lg,
      alignItems: 'center',
      width: '100%',
    },
    addManuallyText: {
      color: colors.surface,
      fontSize: 15,
      fontFamily: Fonts.semiBold,
    },
  }), [colors]);

  if (!session) return null;
  const userId = session.user.id;

  const onChangeText = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const items = await searchBooks(text.trim());
        setResults(items);
        setHasSearched(true);
      } finally {
        setSearching(false);
      }
    }, 400);
  };

  const addBook = async (book: BookSearchResult, shelf: Shelf) => {
    try {
      const bookId = await upsertBook(book);
      await addToShelf(userId, bookId, shelf);
      router.back();
    } catch {
      Alert.alert('Error', 'Could not add book. Please try again.');
    }
  };

  const showShelfPicker = (book: BookSearchResult) => {
    // ActionSheetIOS is iOS-only — this app targets iOS exclusively
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
          placeholderTextColor={colors.textTertiary}
          value={query}
          onChangeText={onChangeText}
          autoFocus
          returnKeyType="search"
        />
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.cancel}>Cancel</Text>
        </TouchableOpacity>
      </View>

      {searching && <ActivityIndicator color={colors.primary} style={styles.spinner} />}

      <FlatList
        data={results}
        keyExtractor={(item) => item.hardcover_id}
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
              {!!item.page_count && (
                <Text style={styles.pages}>{item.page_count} pages</Text>
              )}
            </View>
          </TouchableOpacity>
        )}
      />

      {!searching && hasSearched && query.trim() !== '' && results.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No results found</Text>
          <TouchableOpacity
            style={styles.addManuallyBtn}
            onPress={() => router.push(`/add-book?title=${encodeURIComponent(query.trim())}`)}
          >
            <Text style={styles.addManuallyText}>+ Add "{query.trim()}" manually</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}
