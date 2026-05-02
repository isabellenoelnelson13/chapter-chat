import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@/lib/auth';
import { getMyClubs, createClub, type ClubSummary } from '@/lib/clubs';
import { useTheme } from '@/lib/theme';
import { Fonts, Spacing, Radius, Shadow } from '@/constants/theme';

export default function ClubsScreen() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const router = useRouter();
  const userId = session?.user.id ?? '';

  const [clubs, setClubs] = useState<ClubSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [clubName, setClubName] = useState('');
  const [clubDesc, setClubDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const loadClubs = useCallback(() => {
    if (!userId) return;
    setLoading(true);
    getMyClubs(userId)
      .then(setClubs)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      loadClubs();
    }, [loadClubs])
  );

  const handleCreate = async () => {
    if (!clubName.trim()) return;
    setCreating(true);
    try {
      await createClub(userId, clubName.trim(), clubDesc.trim());
      setShowCreate(false);
      setClubName('');
      setClubDesc('');
      loadClubs();
    } finally {
      setCreating(false);
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.sm,
    },
    title: { fontSize: 24, fontFamily: Fonts.bold, color: colors.textPrimary },
    newBtn: {
      backgroundColor: colors.primary,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: 8,
    },
    newBtnText: { color: colors.surface, fontFamily: Fonts.semiBold, fontSize: 14 },
    list: { padding: Spacing.lg, gap: Spacing.sm },
    card: {
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      padding: Spacing.md,
      gap: 4,
      ...Shadow.card,
    },
    clubName: { fontSize: 16, fontFamily: Fonts.bold, color: colors.textPrimary },
    currentBook: { fontSize: 14, fontFamily: Fonts.regular, color: colors.primary },
    noBook: { fontSize: 14, fontFamily: Fonts.regular, color: colors.textTertiary },
    memberCount: { fontSize: 12, fontFamily: Fonts.regular, color: colors.textSecondary },
    emptyText: {
      textAlign: 'center',
      marginTop: 48,
      color: colors.textSecondary,
      fontSize: 15,
      fontFamily: Fonts.regular,
    },
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
    form: { padding: Spacing.lg, gap: Spacing.sm },
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
    descInput: { minHeight: 80, textAlignVertical: 'top' },
    primaryBtn: {
      backgroundColor: colors.primary,
      borderRadius: Radius.md,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: Spacing.sm,
    },
    primaryBtnText: { color: colors.surface, fontSize: 16, fontFamily: Fonts.bold },
  }), [colors]);

  if (!session) return null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Clubs</Text>
        <TouchableOpacity
          style={styles.newBtn}
          onPress={() => setShowCreate(true)}
          testID="new-club-btn"
        >
          <Text style={styles.newBtnText}>+ New Club</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
      ) : clubs.length === 0 ? (
        <Text style={styles.emptyText}>You're not in any clubs yet.</Text>
      ) : (
        <FlatList
          data={clubs}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/club/${item.id}`)}
              testID={`club-card-${item.id}`}
            >
              <Text style={styles.clubName}>{item.name}</Text>
              {item.currentBookTitle ? (
                <Text style={styles.currentBook}>{item.currentBookTitle}</Text>
              ) : (
                <Text style={styles.noBook}>No book selected</Text>
              )}
              <Text style={styles.memberCount}>{item.memberCount} members</Text>
            </TouchableOpacity>
          )}
        />
      )}

      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Club</Text>
            <TouchableOpacity onPress={() => setShowCreate(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Club name"
              placeholderTextColor={colors.textTertiary}
              value={clubName}
              onChangeText={setClubName}
            />
            <TextInput
              style={[styles.input, styles.descInput]}
              placeholder="Description (optional)"
              placeholderTextColor={colors.textTertiary}
              value={clubDesc}
              onChangeText={setClubDesc}
              multiline
            />
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={handleCreate}
              disabled={creating}
              testID="create-club-btn"
            >
              <Text style={styles.primaryBtnText}>
                {creating ? 'Creating...' : 'Create Club'}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

