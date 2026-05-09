import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import {
  getClub,
  addMember,
  removeMember,
  setCurrentBook,
  getPosts,
  addPost,
  deleteClub,
  type ClubDetail,
  type ClubPost,
} from '@/lib/clubs';
import { searchUsers, type UserSearchResult } from '@/lib/follows';
import { searchBooks, upsertBook, type BookSearchResult } from '@/lib/books';
import { sendPushNotification } from '@/lib/notifications';
import { useTheme } from '@/lib/theme';
import { Fonts, Spacing, Radius, Shadow } from '@/constants/theme';

function pct(current: number, total: number | null): string {
  if (!total) return '—';
  return `${Math.round((current / total) * 100)}%`;
}

export default function ClubDetailScreen() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const router = useRouter();
  const { clubId } = useLocalSearchParams<{ clubId: string }>();
  const userId = session?.user.id ?? '';

  const [club, setClub] = useState<ClubDetail | null>(null);
  const [posts, setPosts] = useState<ClubPost[]>([]);
  const [loading, setLoading] = useState(true);

  const [showPostModal, setShowPostModal] = useState(false);
  const [postBody, setPostBody] = useState('');

  const [showMemberModal, setShowMemberModal] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberResults, setMemberResults] = useState<UserSearchResult[]>([]);

  const [showBookModal, setShowBookModal] = useState(false);
  const [bookSearch, setBookSearch] = useState('');
  const [bookResults, setBookResults] = useState<BookSearchResult[]>([]);

  const loadData = useCallback(() => {
    if (!clubId) return;
    setLoading(true);
    Promise.all([getClub(clubId), getPosts(clubId)])
      .then(([clubData, postsData]) => {
        setClub(clubData);
        setPosts(postsData);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [clubId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleSearchMembers = async (query: string) => {
    setMemberSearch(query);
    if (!query.trim()) { setMemberResults([]); return; }
    const results = await searchUsers(query.trim(), userId);
    setMemberResults(results);
  };

  const handleAddMember = async (user: UserSearchResult) => {
    try {
      await addMember(clubId, user.id);
      setShowMemberModal(false);
      setMemberSearch('');
      setMemberResults([]);
      loadData();
    } catch {
      Alert.alert('Error', 'Could not add member.');
    }
  };

  const handleSearchBooks = async (query: string) => {
    setBookSearch(query);
    if (!query.trim()) { setBookResults([]); return; }
    const results = await searchBooks(query.trim());
    setBookResults(results);
  };

  const handleSetBook = async (book: BookSearchResult) => {
    try {
      const bookId = await upsertBook(book);
      await setCurrentBook(clubId, bookId, userId);
      setShowBookModal(false);
      setBookSearch('');
      setBookResults([]);
      loadData();
    } catch {
      Alert.alert('Error', 'Could not change book.');
    }
  };

  const handleLeaveClub = () => {
    Alert.alert(
      'Leave Club',
      `Are you sure you want to leave "${club?.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeMember(clubId, userId);
              router.back();
            } catch {
              Alert.alert('Error', 'Could not leave the club. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleDeleteClub = () => {
    Alert.alert(
      'Delete Club',
      `Are you sure you want to delete "${club?.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteClub(clubId, userId);
              router.back();
            } catch {
              Alert.alert('Error', 'Could not delete the club. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleSubmitPost = async () => {
    if (!postBody.trim()) return;
    try {
      const newPost = await addPost(clubId, userId, postBody.trim(), undefined);
      setPosts((prev) => [newPost, ...prev]);
      setPostBody('');
      setShowPostModal(false);
      // Notify all other club members
      if (club) {
        const posterName = session?.user.user_metadata?.username ?? 'Someone';
        club.members
          .filter((m) => m.userId !== userId)
          .forEach((m) => {
            sendPushNotification(
              m.userId,
              club.name,
              `${posterName} posted in ${club.name}`,
              { clubId },
            );
          });
      }
    } catch {
      Alert.alert('Error', 'Could not post.');
    }
  };

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
    scroll: { padding: Spacing.lg, gap: Spacing.md },
    title: { fontSize: 24, fontFamily: Fonts.bold, color: colors.textPrimary },
    description: { fontSize: 14, fontFamily: Fonts.regular, color: colors.textSecondary },
    notFound: { fontSize: 16, fontFamily: Fonts.regular, color: colors.textSecondary },
    sectionTitle: { fontSize: 17, fontFamily: Fonts.bold, color: colors.textPrimary, marginTop: Spacing.sm },
    memberRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    memberAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    memberInitial: { color: colors.surface, fontFamily: Fonts.bold, fontSize: 14 },
    memberName: { fontSize: 14, fontFamily: Fonts.semiBold, color: colors.textPrimary },
    memberRole: { fontSize: 12, fontFamily: Fonts.regular, color: colors.textSecondary },
    memberPct: { fontSize: 14, fontFamily: Fonts.bold, color: colors.primary },
    secondaryBtn: {
      borderWidth: 1.5,
      borderColor: colors.primary,
      borderRadius: Radius.md,
      paddingVertical: 10,
      alignItems: 'center',
    },
    secondaryBtnText: { color: colors.primary, fontFamily: Fonts.semiBold, fontSize: 15 },
    bookRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    noBookText: { fontSize: 15, fontFamily: Fonts.regular, color: colors.textTertiary, flex: 1 },
    changeBookText: { color: colors.primary, fontSize: 13, fontFamily: Fonts.semiBold, marginTop: 6 },
    currentBookCard: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      padding: Spacing.md,
      gap: Spacing.md,
      alignItems: 'flex-start',
      ...Shadow.card,
    },
    currentBookCover: { width: 70, height: 105, borderRadius: Radius.sm },
    currentBookCoverPlaceholder: {
      width: 70,
      height: 105,
      borderRadius: Radius.sm,
      backgroundColor: colors.border,
    },
    currentBookInfo: { flex: 1, justifyContent: 'flex-start', paddingTop: 2 },
    currentBookTitle: { fontSize: 15, fontFamily: Fonts.bookTitle, color: colors.textPrimary },
    bookSearchResult: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      padding: Spacing.md,
      gap: Spacing.md,
      alignItems: 'center',
      ...Shadow.card,
    },
    bookSearchCover: { width: 50, height: 75, borderRadius: Radius.sm },
    bookSearchCoverPlaceholder: {
      width: 50,
      height: 75,
      borderRadius: Radius.sm,
      backgroundColor: colors.border,
    },
    bookSearchInfo: { flex: 1, gap: 3 },
    searchResultPages: { fontSize: 12, fontFamily: Fonts.regular, color: colors.textTertiary },
    historyItem: { fontSize: 14, fontFamily: Fonts.regular, color: colors.textSecondary },
    discussionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: Spacing.sm,
    },
    newPostText: { color: colors.primary, fontFamily: Fonts.semiBold, fontSize: 14 },
    emptyText: { fontSize: 14, fontFamily: Fonts.regular, color: colors.textSecondary },
    postCard: {
      backgroundColor: colors.surface,
      borderRadius: Radius.md,
      padding: Spacing.md,
      gap: 4,
      ...Shadow.card,
    },
    postUsername: { fontSize: 13, fontFamily: Fonts.bold, color: colors.textPrimary },
    postBody: { fontSize: 14, fontFamily: Fonts.regular, color: colors.textSecondary, lineHeight: 20 },
    replyCount: { fontSize: 12, fontFamily: Fonts.regular, color: colors.textTertiary },
    modal: { flex: 1, backgroundColor: colors.background },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: { fontSize: 18, fontFamily: Fonts.bold, color: colors.textPrimary },
    cancelText: { color: colors.primary, fontSize: 16, fontFamily: Fonts.regular },
    modalBody: { padding: Spacing.lg, gap: Spacing.sm },
    input: {
      backgroundColor: colors.surface,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: Spacing.md,
      paddingVertical: 14,
      fontSize: 16,
      fontFamily: Fonts.regular,
      color: colors.textPrimary,
    },
    postInput: { minHeight: 120, textAlignVertical: 'top' },
    primaryBtn: {
      backgroundColor: colors.primary,
      borderRadius: Radius.md,
      paddingVertical: 16,
      alignItems: 'center',
    },
    primaryBtnText: { color: colors.surface, fontSize: 16, fontFamily: Fonts.bold },
    searchResult: {
      backgroundColor: colors.surface,
      borderRadius: Radius.md,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchResultText: { fontSize: 15, fontFamily: Fonts.semiBold, color: colors.textPrimary },
    searchResultSub: { fontSize: 13, fontFamily: Fonts.regular, color: colors.textSecondary },
    deleteBtn: {
      borderWidth: 1.5,
      borderColor: colors.error,
      borderRadius: Radius.md,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: Spacing.lg,
    },
    deleteBtnText: { color: colors.error, fontFamily: Fonts.semiBold, fontSize: 15 },
  }), [colors]);

  if (!session) return null;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!club) {
    return (
      <SafeAreaView style={styles.container}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <View style={styles.center}>
          <Text style={styles.notFound}>Club not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isOwner = club.ownerId === userId;

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={24} color={colors.primary} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{club.name}</Text>
        {club.description ? (
          <Text style={styles.description}>{club.description}</Text>
        ) : null}

        <Text style={styles.sectionTitle}>Members</Text>
        {club.members.map((m) => (
          <View key={m.userId} style={styles.memberRow}>
            <View style={styles.memberAvatar}>
              <Text style={styles.memberInitial}>{m.username.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.memberName}>{m.username}</Text>
              <Text style={styles.memberRole}>{m.role}</Text>
            </View>
            <Text style={styles.memberPct}>{pct(m.currentPage, m.pageCount)}</Text>
          </View>
        ))}

        {isOwner && (
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => setShowMemberModal(true)}
            testID="add-member-btn"
          >
            <Text style={styles.secondaryBtnText}>+ Add Member</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.sectionTitle}>Currently Reading</Text>
        {club.currentBook ? (
          <View style={styles.currentBookCard}>
            {club.currentBook.bookCoverUrl ? (
              <Image source={{ uri: club.currentBook.bookCoverUrl }} style={styles.currentBookCover} />
            ) : (
              <View style={styles.currentBookCoverPlaceholder} />
            )}
            <View style={styles.currentBookInfo}>
              <Text style={styles.currentBookTitle} numberOfLines={3}>{club.currentBook.bookTitle}</Text>
              {isOwner && (
                <TouchableOpacity onPress={() => setShowBookModal(true)} testID="change-book-btn">
                  <Text style={styles.changeBookText}>Change book</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.bookRow}>
            <Text style={styles.noBookText}>No book selected</Text>
            {isOwner && (
              <TouchableOpacity onPress={() => setShowBookModal(true)} testID="change-book-btn">
                <Text style={styles.changeBookText}>Select book</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {club.history.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Reading History</Text>
            {club.history.map((h) => (
              <Text key={h.id} style={styles.historyItem}>{h.bookTitle}</Text>
            ))}
          </>
        )}

        <View style={styles.discussionHeader}>
          <Text style={styles.sectionTitle}>Discussion</Text>
          <TouchableOpacity testID="new-post-btn" onPress={() => setShowPostModal(true)}>
            <Text style={styles.newPostText}>+ New Post</Text>
          </TouchableOpacity>
        </View>

        {posts.length === 0 ? (
          <Text style={styles.emptyText}>No posts yet. Start the conversation!</Text>
        ) : (
          posts.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={styles.postCard}
              testID={`post-card-${p.id}`}
              onPress={() => router.push(`/club/${clubId}/post/${p.id}`)}
            >
              <Text style={styles.postUsername}>{p.username}</Text>
              <Text style={styles.postBody} numberOfLines={3}>{p.body}</Text>
              <Text style={styles.replyCount}>{p.replyCount} replies</Text>
            </TouchableOpacity>
          ))
        )}

        {isOwner ? (
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={handleDeleteClub}
            testID="delete-club-btn"
          >
            <Text style={styles.deleteBtnText}>Delete Club</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={handleLeaveClub}
            testID="leave-club-btn"
          >
            <Text style={styles.deleteBtnText}>Leave Club</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* New post modal */}
      <Modal visible={showPostModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Post</Text>
            <TouchableOpacity onPress={() => setShowPostModal(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.modalBody}>
            <TextInput
              style={[styles.input, styles.postInput]}
              placeholder="Write a post..."
              placeholderTextColor={colors.textTertiary}
              value={postBody}
              onChangeText={setPostBody}
              multiline
              autoFocus
            />
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={handleSubmitPost}
              testID="submit-post-btn"
            >
              <Text style={styles.primaryBtnText}>Post</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Add member modal */}
      <Modal visible={showMemberModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Member</Text>
            <TouchableOpacity onPress={() => setShowMemberModal(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.modalBody}>
            <TextInput
              style={styles.input}
              placeholder="Search by username..."
              placeholderTextColor={colors.textTertiary}
              value={memberSearch}
              onChangeText={handleSearchMembers}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {memberResults.map((u) => (
              <TouchableOpacity
                key={u.id}
                style={styles.searchResult}
                onPress={() => handleAddMember(u)}
                testID={`add-user-${u.id}`}
              >
                <Text style={styles.searchResultText}>{u.username}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </SafeAreaView>
      </Modal>

      {/* Change book modal */}
      <Modal visible={showBookModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Book</Text>
            <TouchableOpacity onPress={() => setShowBookModal(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.modalBody}>
            <TextInput
              style={styles.input}
              placeholder="Search books..."
              placeholderTextColor={colors.textTertiary}
              value={bookSearch}
              onChangeText={handleSearchBooks}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {bookResults.map((b) => (
              <TouchableOpacity
                key={b.hardcover_id}
                style={styles.bookSearchResult}
                onPress={() => handleSetBook(b)}
                testID={`book-result-${b.hardcover_id}`}
              >
                {b.cover_url ? (
                  <Image source={{ uri: b.cover_url }} style={styles.bookSearchCover} />
                ) : (
                  <View style={styles.bookSearchCoverPlaceholder} />
                )}
                <View style={styles.bookSearchInfo}>
                  <Text style={styles.searchResultText} numberOfLines={2}>{b.title}</Text>
                  <Text style={styles.searchResultSub}>{b.author}</Text>
                  {!!b.page_count && (
                    <Text style={styles.searchResultPages}>{b.page_count} pages</Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
