import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getAuthor, getAuthorBooks, type Author, type AuthorBook } from '@/lib/authors';
import { useTheme } from '@/lib/theme';
import { Fonts, Spacing, Radius, Shadow } from '@/constants/theme';

export default function AuthorScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { authorId } = useLocalSearchParams<{ authorId: string }>();

  const [author, setAuthor] = useState<Author | null>(null);
  const [books, setBooks] = useState<AuthorBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [bioExpanded, setBioExpanded] = useState(false);

  useEffect(() => {
    if (!authorId) return;
    Promise.all([getAuthor(authorId), getAuthorBooks(authorId)])
      .then(([authorData, booksData]) => {
        setAuthor(authorData);
        setBooks(booksData);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authorId]);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    backBtn: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, gap: 4,
    },
    backText: { color: colors.primary, fontSize: 16, fontFamily: Fonts.semiBold },
    header: {
      alignItems: 'center', paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md, paddingBottom: Spacing.lg, gap: Spacing.sm,
    },
    photo: { width: 100, height: 100, borderRadius: 50 },
    photoPlaceholder: {
      width: 100, height: 100, borderRadius: 50,
      backgroundColor: colors.border,
      alignItems: 'center', justifyContent: 'center',
    },
    name: {
      fontSize: 22, fontFamily: Fonts.bold,
      color: colors.textPrimary, textAlign: 'center',
    },
    born: { fontSize: 13, fontFamily: Fonts.regular, color: colors.textTertiary },
    website: { fontSize: 13, fontFamily: Fonts.semiBold, color: colors.primary },
    bio: {
      fontSize: 14, fontFamily: Fonts.bookBody,
      color: colors.textSecondary, lineHeight: 20, textAlign: 'center',
    },
    showMore: { color: colors.primary, fontSize: 13, fontFamily: Fonts.semiBold, marginTop: 2 },
    divider: { height: 1, backgroundColor: colors.border, marginHorizontal: Spacing.lg },
    sectionTitle: {
      fontSize: 17, fontFamily: Fonts.bold, color: colors.textPrimary,
      paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.sm,
    },
    list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl, gap: Spacing.sm },
    card: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: colors.surface, borderRadius: Radius.lg,
      padding: Spacing.md, gap: Spacing.md, ...Shadow.card,
    },
    cover: { width: 56, height: 84, borderRadius: Radius.sm },
    coverPlaceholder: {
      width: 56, height: 84, borderRadius: Radius.sm, backgroundColor: colors.border,
    },
    info: { flex: 1, gap: 3 },
    bookTitle: { fontSize: 15, fontFamily: Fonts.bookTitle, color: colors.textPrimary },
    bookRating: { fontSize: 12, fontFamily: Fonts.regular, color: colors.textTertiary },
    notFound: { fontSize: 16, fontFamily: Fonts.regular, color: colors.textSecondary },
  }), [colors]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!author) {
    return (
      <SafeAreaView style={styles.container}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <View style={styles.center}>
          <Text style={styles.notFound}>Author not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={24} color={colors.primary} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      <FlatList
        data={books}
        keyExtractor={(b) => b.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              {author.photo_url ? (
                <Image source={{ uri: author.photo_url }} style={styles.photo} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Ionicons name="person" size={40} color={colors.textTertiary} />
                </View>
              )}
              <Text style={styles.name}>{author.name}</Text>
              {author.born_date ? (
                <Text style={styles.born}>b. {author.born_date}</Text>
              ) : null}
              {author.website ? (
                <TouchableOpacity onPress={() => Linking.openURL(author.website!)}>
                  <Text style={styles.website}>{author.website}</Text>
                </TouchableOpacity>
              ) : null}
              {author.bio ? (
                <>
                  <Text style={styles.bio} numberOfLines={bioExpanded ? undefined : 3}>
                    {author.bio}
                  </Text>
                  <TouchableOpacity onPress={() => setBioExpanded(!bioExpanded)}>
                    <Text style={styles.showMore}>{bioExpanded ? 'Show less' : 'Read more'}</Text>
                  </TouchableOpacity>
                </>
              ) : null}
            </View>
            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>Books</Text>
          </>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/book/${item.id}`)}
            activeOpacity={0.75}
          >
            {item.cover_url ? (
              <Image source={{ uri: item.cover_url }} style={styles.cover} />
            ) : (
              <View style={styles.coverPlaceholder} />
            )}
            <View style={styles.info}>
              <Text style={styles.bookTitle} numberOfLines={2}>{item.title}</Text>
              {item.rating != null && (
                <Text style={styles.bookRating}>★ {Number(item.rating).toFixed(1)}</Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.notFound}>No books found</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
