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
  Alert,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { searchBooks, upsertBook, type BookSearchResult } from '@/lib/books';
import { getAIRecommendations } from '@/lib/agents/recommend';
import { type Recommendation } from '@/lib/agents/types';
import { useTheme } from '@/lib/theme';
import { Fonts, Spacing, Radius, Shadow } from '@/constants/theme';

export default function SearchScreen() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BookSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [loadingBookId, setLoadingBookId] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [recsLoading, setRecsLoading] = useState(false);
  const [recsFetched, setRecsFetched] = useState(false);
  const [messageIndex, setMessageIndex] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const LOADING_MESSAGES = [
    'Analyzing your reading history…',
    'Finding your taste patterns…',
    'Searching for the perfect fit…',
    'Picking your top matches…',
  ];

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    if (!recsLoading) return;
    setMessageIndex(0);
    const interval = setInterval(() => {
      setMessageIndex((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [recsLoading]);

  function fetchRecommendations() {
    if (!session) return;
    Keyboard.dismiss();
    setRecsLoading(true);
    getAIRecommendations(session.user.id)
      .then((r) => {
        setRecommendations(r.recommendations);
        setRecsFetched(true);
      })
      .catch(() => setRecsFetched(true))
      .finally(() => setRecsLoading(false));
  }

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
    forYouHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.sm,
    },
    forYouTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    forYouTitle: { fontSize: 18, fontFamily: Fonts.bold, color: colors.textPrimary },
    refreshBtn: { padding: 4 },
    rationale: {
      color: colors.primary,
      fontSize: 12,
      fontFamily: Fonts.regular,
      fontStyle: 'italic',
      lineHeight: 17,
    },
    promptCard: {
      margin: Spacing.md,
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      padding: Spacing.lg,
      alignItems: 'center',
      gap: Spacing.md,
      ...Shadow.card,
    },
    promptTitle: { fontSize: 16, fontFamily: Fonts.bold, color: colors.textPrimary, textAlign: 'center' },
    promptSub: { fontSize: 13, fontFamily: Fonts.regular, color: colors.textSecondary, textAlign: 'center', lineHeight: 19 },
    promptBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      borderRadius: Radius.xl,
      paddingVertical: 12,
      paddingHorizontal: Spacing.lg,
    },
    promptBtnText: { color: colors.surface, fontFamily: Fonts.semiBold, fontSize: 15 },
    loadingScreen: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.md,
      paddingHorizontal: Spacing.xl,
    },
    loadingMessage: {
      fontSize: 16,
      fontFamily: Fonts.regular,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
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

  const handleBookPress = async (book: BookSearchResult) => {
    setLoadingBookId(book.hardcover_id);
    try {
      const bookId = await upsertBook(book);
      router.push(`/book/${bookId}`);
    } catch {
      Alert.alert('Error', 'Could not load book. Please try again.');
    } finally {
      setLoadingBookId(null);
    }
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

      {!query.trim() ? (
        <>
          {recsLoading ? (
            <View style={styles.loadingScreen}>
              <Ionicons name="sparkles" size={32} color={colors.primary} />
              <Text style={styles.loadingMessage}>{LOADING_MESSAGES[messageIndex]}</Text>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : recsFetched ? (
            <>
              <View style={styles.forYouHeader}>
                <View style={styles.forYouTitleRow}>
                  <Ionicons name="sparkles" size={16} color={colors.primary} />
                  <Text style={styles.forYouTitle}>For You</Text>
                </View>
                <TouchableOpacity style={styles.refreshBtn} onPress={fetchRecommendations}>
                  <Ionicons name="refresh" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <FlatList
                data={recommendations}
                keyExtractor={(item) => item.hardcover_id}
                contentContainerStyle={styles.list}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.result}
                    onPress={() => handleBookPress(item)}
                    disabled={loadingBookId !== null}
                  >
                    {item.cover_url ? (
                      <Image source={{ uri: item.cover_url }} style={styles.cover} />
                    ) : (
                      <View style={styles.coverPlaceholder} />
                    )}
                    <View style={styles.info}>
                      <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
                      <Text style={styles.author}>{item.author}</Text>
                      {item.rating !== null && (
                        <Text style={styles.pages}>
                          ★ {item.rating.toFixed(1)} · {item.users_read_count >= 1000 ? `${(item.users_read_count / 1000).toFixed(0)}k` : item.users_read_count} readers
                        </Text>
                      )}
                      {!!item.rationale && (
                        <Text style={styles.rationale}>{item.rationale}</Text>
                      )}
                    </View>
                    {loadingBookId === item.hardcover_id && (
                      <ActivityIndicator color={colors.primary} />
                    )}
                  </TouchableOpacity>
                )}
              />
            </>
          ) : (
            <View style={styles.promptCard}>
              <Ionicons name="sparkles" size={28} color={colors.primary} />
              <Text style={styles.promptTitle}>Get a personalized recommendation</Text>
              <Text style={styles.promptSub}>
                We'll analyze your reading history and find books tailored to your taste.
              </Text>
              <TouchableOpacity style={styles.promptBtn} onPress={fetchRecommendations}>
                <Ionicons name="sparkles" size={16} color={colors.surface} />
                <Text style={styles.promptBtnText}>Recommend something to me</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      ) : (
        <>
          <FlatList
            data={results}
            keyExtractor={(item) => item.hardcover_id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.result}
                onPress={() => handleBookPress(item)}
                disabled={loadingBookId !== null}
              >
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
                {loadingBookId === item.hardcover_id && (
                  <ActivityIndicator color={colors.primary} />
                )}
              </TouchableOpacity>
            )}
            ListFooterComponent={
              !searching && hasSearched ? (
                <TouchableOpacity
                  style={styles.addManuallyBtn}
                  onPress={() => router.push(`/add-book?title=${encodeURIComponent(query.trim())}`)}
                >
                  <Text style={styles.addManuallyText}>
                    {results.length === 0
                      ? `+ Add "${query.trim()}" manually`
                      : "Can't find it? Add manually"}
                  </Text>
                </TouchableOpacity>
              ) : null
            }
          />
          {!searching && hasSearched && results.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No results found</Text>
            </View>
          )}
        </>
      )}
    </SafeAreaView>
  );
}
