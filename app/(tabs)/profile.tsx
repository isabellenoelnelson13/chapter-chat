import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  Image,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { getShelf } from '@/lib/userBooks';
import {
  getStreak,
  getYearlyGoalProgress,
  getReadingHistory,
  type YearlyGoalProgress,
} from '@/lib/stats';
import {
  getProfile,
  updateYearlyGoal,
  updatePrivacy,
  updateDisplayName,
  pickAndUploadAvatar,
  type UserProfile,
} from '@/lib/profile';
import { useTheme } from '@/lib/theme';
import { Fonts, Spacing, Radius, Shadow, Themes, type ThemeName } from '@/constants/theme';
import {
  getFollowRequests,
  getFollowing,
  getFollowers,
  approveFollowRequest,
  declineFollowRequest,
  type FollowRequest,
  type UserSearchResult,
} from '@/lib/follows';

export default function ProfileScreen() {
  const { colors, themeName, setTheme } = useTheme();
  const { session, signOut } = useAuth();
  const router = useRouter();
  const userId = session?.user.id ?? '';

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [streak, setStreak] = useState(0);
  const [yearlyGoal, setYearlyGoal] = useState<YearlyGoalProgress>({ booksRead: 0, goal: 0 });
  const [pagesThisYear, setPagesThisYear] = useState(0);
  const [shelfCounts, setShelfCounts] = useState({ reading: 0, want: 0, read: 0, dnf: 0 });
  const [followRequests, setFollowRequests] = useState<FollowRequest[]>([]);
  const [followersList, setFollowersList] = useState<UserSearchResult[]>([]);
  const [followingList, setFollowingList] = useState<UserSearchResult[]>([]);
  const [listModal, setListModal] = useState<'followers' | 'following' | null>(null);
  const [themePickerVisible, setThemePickerVisible] = useState(false);
  const [editingDisplayName, setEditingDisplayName] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      setLoading(true);
      Promise.allSettled([
        getProfile(userId),
        getStreak(userId),
        getYearlyGoalProgress(userId),
        getReadingHistory(userId, 365),
        getShelf(userId, 'reading'),
        getShelf(userId, 'want'),
        getShelf(userId, 'read'),
        getShelf(userId, 'dnf'),
        getFollowRequests(userId),
        getFollowing(userId),
        getFollowers(userId),
      ]).then(([p, s, yg, history, reading, want, read, dnf, requests, following, followers]) => {
        if (p.status === 'fulfilled') setProfile(p.value);
        if (s.status === 'fulfilled') setStreak(s.value);
        if (yg.status === 'fulfilled') setYearlyGoal(yg.value);
        if (history.status === 'fulfilled')
          setPagesThisYear(history.value.reduce((sum, d) => sum + d.pages, 0));
        setShelfCounts({
          reading: reading.status === 'fulfilled' ? reading.value.length : 0,
          want: want.status === 'fulfilled' ? want.value.length : 0,
          read: read.status === 'fulfilled' ? read.value.length : 0,
          dnf: dnf.status === 'fulfilled' ? dnf.value.length : 0,
        });
        if (requests.status === 'fulfilled') setFollowRequests(requests.value);
        if (following.status === 'fulfilled') setFollowingList(following.value);
        if (followers.status === 'fulfilled') setFollowersList(followers.value);
        setLoading(false);
      });
    }, [userId])
  );

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scroll: { padding: Spacing.lg, gap: Spacing.lg },

    header: { alignItems: 'center', gap: 8 },
    avatarWrapper: { position: 'relative' },
    avatarImage: { width: 88, height: 88, borderRadius: 44 },
    avatar: {
      width: 88, height: 88, borderRadius: 44,
      backgroundColor: colors.primary,
      justifyContent: 'center', alignItems: 'center',
    },
    initial: { fontSize: 36, fontFamily: Fonts.bold, color: colors.surface },
    avatarEditBadge: {
      position: 'absolute', bottom: 2, right: 2,
      backgroundColor: colors.primary,
      borderRadius: 12, width: 24, height: 24,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 2, borderColor: colors.background,
    },
    displayNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    displayName: { fontSize: 24, fontFamily: Fonts.bold, color: colors.textPrimary },
    displayNameInput: {
      fontSize: 22, fontFamily: Fonts.bold, color: colors.textPrimary,
      borderBottomWidth: 1.5, borderBottomColor: colors.primary,
      paddingVertical: 2, minWidth: 120,
    },
    displayNameSave: { fontSize: 15, fontFamily: Fonts.semiBold, color: colors.primary },
    handle: { fontSize: 14, fontFamily: Fonts.regular, color: colors.textTertiary, marginTop: -4 },
    bio: { fontSize: 14, fontFamily: Fonts.regular, color: colors.textSecondary, textAlign: 'center' },

    row: { flexDirection: 'row', gap: Spacing.sm },
    statCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      padding: Spacing.md,
      alignItems: 'center',
      gap: 4,
      ...Shadow.card,
    },
    statValue: { fontSize: 20, fontFamily: Fonts.bold, color: colors.textPrimary },
    statLabel: { fontSize: 11, fontFamily: Fonts.regular, color: colors.textSecondary, textAlign: 'center' },

    card: {
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      padding: Spacing.md,
      ...Shadow.card,
    },
    cardTitle: { fontSize: 15, fontFamily: Fonts.bold, color: colors.textPrimary, marginBottom: 8 },
    goalText: { fontSize: 14, fontFamily: Fonts.regular, color: colors.textSecondary, marginBottom: 8 },
    goalEmpty: { fontSize: 14, fontFamily: Fonts.regular, color: colors.textTertiary },
    progressTrack: {
      height: 8,
      backgroundColor: colors.progressTrack,
      borderRadius: 4,
      overflow: 'hidden',
    },
    progressFill: { height: 8, backgroundColor: colors.primary, borderRadius: 4 },

    pillRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
    pill: {
      borderWidth: 1.5,
      borderColor: colors.primary,
      borderRadius: Radius.xl,
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: colors.surface,
    },
    pillText: { color: colors.primary, fontSize: 13, fontFamily: Fonts.semiBold },

    sectionTitle: { fontSize: 18, fontFamily: Fonts.bold, color: colors.textPrimary },
    settingsCard: {
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      ...Shadow.card,
      overflow: 'hidden',
    },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.md,
      paddingVertical: 14,
    },
    settingLabel: { fontSize: 15, fontFamily: Fonts.regular, color: colors.textPrimary },
    divider: { height: 1, backgroundColor: colors.border, marginHorizontal: Spacing.md },
    signOut: { fontSize: 15, color: colors.error, fontFamily: Fonts.semiBold },

    requestsCard: {
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      padding: Spacing.md,
      gap: Spacing.sm,
      ...Shadow.card,
    },
    requestsTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    requestsTitle: { fontSize: 15, fontFamily: Fonts.bold, color: colors.textPrimary },
    requestsBadge: {
      color: colors.primary,
      fontFamily: Fonts.bold,
      fontSize: 15,
    },
    requestRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    requestAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    requestInitial: { fontSize: 14, fontFamily: Fonts.bold, color: colors.surface },
    requestInfo: { flex: 1 },
    requestUsername: { fontSize: 14, fontFamily: Fonts.semiBold, color: colors.textPrimary },
    requestBio: { fontSize: 12, fontFamily: Fonts.regular, color: colors.textSecondary },
    acceptBtn: {
      backgroundColor: colors.primary,
      borderRadius: Radius.md,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    acceptBtnText: { color: colors.surface, fontFamily: Fonts.bold, fontSize: 12 },
    declineBtn: {
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: Radius.md,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    declineBtnText: { color: colors.textSecondary, fontFamily: Fonts.semiBold, fontSize: 12 },

    themeOverlay: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'center', alignItems: 'center',
    },
    themeSheet: {
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      padding: Spacing.lg,
      width: 260,
      gap: Spacing.sm,
    },
    themeSheetTitle: { fontSize: 16, fontFamily: Fonts.bold, color: colors.textPrimary, marginBottom: 4 },
    themeRow: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
      paddingVertical: 10,
    },
    themeSwatch: { width: 22, height: 22, borderRadius: 11 },
    themeRowLabel: { flex: 1, fontSize: 15, fontFamily: Fonts.regular, color: colors.textSecondary },
    themeRowLabelActive: { fontFamily: Fonts.semiBold, color: colors.textPrimary },

    followStats: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
    },
    followStat: { alignItems: 'center', paddingHorizontal: Spacing.lg },
    followStatNumber: { fontSize: 18, fontFamily: Fonts.bold, color: colors.textPrimary },
    followStatLabel: { fontSize: 12, fontFamily: Fonts.regular, color: colors.textSecondary, marginTop: 1 },
    followStatDivider: { width: 1, height: 28, backgroundColor: colors.border },

    listModalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    listModalTitle: { fontSize: 17, fontFamily: Fonts.bold, color: colors.textPrimary },
    listModalContent: { padding: Spacing.lg, gap: Spacing.md },
    listModalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    listModalAvatar: { width: 44, height: 44, borderRadius: 22 },
    listModalInitial: { fontSize: 18, fontFamily: Fonts.bold, color: colors.surface },
    listModalUsername: { fontSize: 15, fontFamily: Fonts.semiBold, color: colors.textPrimary },
    listModalBio: { fontSize: 13, fontFamily: Fonts.regular, color: colors.textSecondary, marginTop: 1 },
    listModalEmpty: { fontSize: 14, fontFamily: Fonts.regular, color: colors.textSecondary, textAlign: 'center', marginTop: 24 },
  }), [colors]);

  if (!session) return null;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const initial = profile?.username.charAt(0).toUpperCase() ?? '?';
  const goalPct = yearlyGoal.goal > 0
    ? Math.min(1, yearlyGoal.booksRead / yearlyGoal.goal)
    : 0;

  const handleSetGoal = () => {
    Alert.prompt(
      'Set Reading Goal',
      `How many books do you want to read in ${new Date().getFullYear()}?`,
      async (value) => {
        const n = parseInt(value, 10);
        if (!isNaN(n) && n > 0) {
          await updateYearlyGoal(userId, n);
          setYearlyGoal({ ...yearlyGoal, goal: n });
        }
      },
      'plain-text',
      String(yearlyGoal.goal || ''),
      'number-pad'
    );
  };

  const handleThemePress = () => setThemePickerVisible(true);

  const handlePrivacyToggle = async (isPublic: boolean) => {
    const isPrivate = !isPublic;
    setProfile(prev => prev ? { ...prev, is_private: isPrivate } : prev);
    await updatePrivacy(userId, isPrivate);
  };

  const handleApproveRequest = async (requesterId: string) => {
    setFollowRequests(prev => prev.filter(r => r.requesterId !== requesterId));
    await approveFollowRequest(requesterId, userId);
  };

  const handleDeclineRequest = async (requesterId: string) => {
    setFollowRequests(prev => prev.filter(r => r.requesterId !== requesterId));
    await declineFollowRequest(requesterId, userId);
  };

  const handleAvatarPress = async () => {
    setUploadingAvatar(true);
    try {
      const url = await pickAndUploadAvatar(userId);
      if (url) setProfile(prev => prev ? { ...prev, avatar_url: url } : prev);
    } catch (e: any) {
      Alert.alert('Upload Error', e?.message ?? String(e));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveDisplayName = async () => {
    setEditingDisplayName(false);
    if (!profile) return;
    const trimmed = displayNameInput.trim();
    setProfile({ ...profile, display_name: trimmed || null });
    await updateDisplayName(userId, trimmed);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Follow requests */}
        {followRequests.length > 0 && (
          <View style={styles.requestsCard}>
            <View style={styles.requestsTitleRow}>
              <Text style={styles.requestsTitle}>Follow Requests</Text>
              <Text style={styles.requestsBadge}>{followRequests.length}</Text>
            </View>
            {followRequests.map(req => (
              <View key={req.requesterId} style={styles.requestRow}>
                <View style={styles.requestAvatar}>
                  <Text style={styles.requestInitial}>
                    {req.username.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.requestInfo}>
                  <Text style={styles.requestUsername}>{req.username}</Text>
                  {req.bio ? <Text style={styles.requestBio} numberOfLines={1}>{req.bio}</Text> : null}
                </View>
                <TouchableOpacity
                  style={styles.acceptBtn}
                  onPress={() => handleApproveRequest(req.requesterId)}
                  testID={`accept-request-${req.requesterId}`}
                >
                  <Text style={styles.acceptBtnText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.declineBtn}
                  onPress={() => handleDeclineRequest(req.requesterId)}
                  testID={`decline-request-${req.requesterId}`}
                >
                  <Text style={styles.declineBtnText}>Decline</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* User header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleAvatarPress} style={styles.avatarWrapper} disabled={uploadingAvatar}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.initial}>{initial}</Text>
              </View>
            )}
            <View style={styles.avatarEditBadge}>
              {uploadingAvatar
                ? <ActivityIndicator size="small" color={colors.surface} />
                : <Ionicons name="camera" size={12} color={colors.surface} />
              }
            </View>
          </TouchableOpacity>

          {editingDisplayName ? (
            <View style={styles.displayNameRow}>
              <TextInput
                style={styles.displayNameInput}
                value={displayNameInput}
                onChangeText={setDisplayNameInput}
                placeholder="Display name"
                placeholderTextColor={colors.textTertiary}
                autoFocus
                returnKeyType="done"
                onBlur={handleSaveDisplayName}
                onSubmitEditing={handleSaveDisplayName}
              />
              <TouchableOpacity onPress={handleSaveDisplayName}>
                <Text style={styles.displayNameSave}>Save</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.displayNameRow}
              onPress={() => {
                setDisplayNameInput(profile?.display_name ?? '');
                setEditingDisplayName(true);
              }}
            >
              <Text style={styles.displayName}>
                {profile?.display_name ?? profile?.username ?? ''}
              </Text>
              <Ionicons name="pencil-outline" size={16} color={colors.textTertiary} />
            </TouchableOpacity>
          )}

          <Text style={styles.handle}>@{profile?.username ?? ''}</Text>
          {profile?.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

          <View style={styles.followStats}>
            <TouchableOpacity style={styles.followStat} onPress={() => setListModal('followers')}>
              <Text style={styles.followStatNumber}>{followersList.length}</Text>
              <Text style={styles.followStatLabel}>Followers</Text>
            </TouchableOpacity>
            <View style={styles.followStatDivider} />
            <TouchableOpacity style={styles.followStat} onPress={() => setListModal('following')}>
              <Text style={styles.followStatNumber}>{followingList.length}</Text>
              <Text style={styles.followStatLabel}>Following</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats summary */}
        <View style={styles.row}>
          <View style={styles.statCard}>
            <Ionicons name="book" size={18} color={colors.primary} />
            <Text style={styles.statValue}>{shelfCounts.read}</Text>
            <Text style={styles.statLabel}>Books Read</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="flame" size={18} color={colors.orange} />
            <Text style={styles.statValue}>{streak}</Text>
            <Text style={styles.statLabel}>Streak</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="document-text-outline" size={18} color={colors.primary} />
            <Text style={styles.statValue}>{pagesThisYear}</Text>
            <Text style={styles.statLabel}>Pages This Year</Text>
          </View>
        </View>

        {/* Yearly goal */}
        <TouchableOpacity style={styles.card} onPress={handleSetGoal}>
          <Text style={styles.cardTitle}>{new Date().getFullYear()} Reading Goal</Text>
          {yearlyGoal.goal === 0 ? (
            <Text style={styles.goalEmpty}>Tap to set a goal</Text>
          ) : (
            <>
              <Text style={styles.goalText}>
                {yearlyGoal.booksRead} of {yearlyGoal.goal} books
              </Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.round(goalPct * 100)}%` }]} />
              </View>
            </>
          )}
        </TouchableOpacity>

        {/* Shelf counts */}
        <View style={styles.pillRow}>
          {[
            { label: 'Reading', count: shelfCounts.reading },
            { label: 'Want', count: shelfCounts.want },
            { label: 'Read', count: shelfCounts.read },
            { label: 'DNF', count: shelfCounts.dnf },
          ].map(({ label, count }) => (
            <TouchableOpacity
              key={label}
              style={styles.pill}
              onPress={() => router.push('/(tabs)/library')}
            >
              <Text style={styles.pillText}>{label} · {count}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Settings */}
        <Text style={styles.sectionTitle}>Settings</Text>
        <View style={styles.settingsCard}>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Public profile</Text>
            <Switch
              testID="privacy-switch"
              value={!(profile?.is_private ?? false)}
              onValueChange={handlePrivacyToggle}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor={colors.surface}
            />
          </View>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.settingRow} onPress={handleThemePress}>
            <Text style={styles.settingLabel}>Theme</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 14, fontFamily: Fonts.regular, color: colors.textTertiary }}>
                {Themes[themeName].label}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
            </View>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.settingRow} onPress={() => router.push('/notification-settings')}>
            <Text style={styles.settingLabel}>Notifications</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.settingRow} onPress={signOut}>
            <Text style={styles.signOut}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Followers / Following list modal */}
      <Modal visible={!!listModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setListModal(null)}>
        <SafeAreaView style={[styles.container, { paddingTop: 0 }]}>
          <View style={styles.listModalHeader}>
            <Text style={styles.listModalTitle}>
              {listModal === 'followers' ? 'Followers' : 'Following'}
            </Text>
            <TouchableOpacity onPress={() => setListModal(null)}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.listModalContent}>
            {(listModal === 'followers' ? followersList : followingList).map(user => (
              <TouchableOpacity
                key={user.id}
                style={styles.listModalRow}
                onPress={() => { setListModal(null); router.push(`/user/${user.id}`); }}
              >
                {user.avatar_url ? (
                  <Image source={{ uri: user.avatar_url }} style={styles.listModalAvatar} />
                ) : (
                  <View style={[styles.listModalAvatar, { backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={styles.listModalInitial}>{user.username.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.listModalUsername}>{user.username}</Text>
                  {user.bio ? <Text style={styles.listModalBio} numberOfLines={1}>{user.bio}</Text> : null}
                </View>
              </TouchableOpacity>
            ))}
            {(listModal === 'followers' ? followersList : followingList).length === 0 && (
              <Text style={styles.listModalEmpty}>
                {listModal === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}
              </Text>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={themePickerVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.themeOverlay} activeOpacity={1} onPress={() => setThemePickerVisible(false)}>
          <View style={styles.themeSheet}>
            <Text style={styles.themeSheetTitle}>Choose Theme</Text>
            {(Object.keys(Themes) as ThemeName[]).map((t) => (
              <TouchableOpacity
                key={t}
                style={styles.themeRow}
                onPress={() => { setTheme(t); setThemePickerVisible(false); }}
              >
                <View style={[styles.themeSwatch, { backgroundColor: Themes[t].palette.primary }]} />
                <Text style={[styles.themeRowLabel, t === themeName && styles.themeRowLabelActive]}>
                  {Themes[t].label}
                </Text>
                {t === themeName && <Ionicons name="checkmark" size={18} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}
