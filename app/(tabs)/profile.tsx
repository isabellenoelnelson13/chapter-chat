import { useCallback, useState } from 'react';
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
  type UserProfile,
} from '@/lib/profile';
import { Colors, Spacing, Radius, Shadow } from '@/constants/theme';
import {
  getFollowRequests,
  approveFollowRequest,
  declineFollowRequest,
  type FollowRequest,
} from '@/lib/follows';

export default function ProfileScreen() {
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

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      setLoading(true);
      Promise.all([
        getProfile(userId),
        getStreak(userId),
        getYearlyGoalProgress(userId),
        getReadingHistory(userId, 365),
        getShelf(userId, 'reading'),
        getShelf(userId, 'want'),
        getShelf(userId, 'read'),
        getShelf(userId, 'dnf'),
        getFollowRequests(userId),
      ])
        .then(([p, s, yg, history, reading, want, read, dnf, requests]) => {
          setProfile(p);
          setStreak(s);
          setYearlyGoal(yg);
          setPagesThisYear(history.reduce((sum, d) => sum + d.pages, 0));
          setShelfCounts({
            reading: reading.length,
            want: want.length,
            read: read.length,
            dnf: dnf.length,
          });
          setFollowRequests(requests);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }, [userId])
  );

  if (!session) return null;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} />
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

  return (
    <SafeAreaView style={styles.container}>
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
          <View style={styles.avatar}>
            <Text style={styles.initial}>{initial}</Text>
          </View>
          <Text style={styles.username}>{profile?.username ?? ''}</Text>
          {profile?.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
        </View>

        {/* Stats summary */}
        <View style={styles.row}>
          <View style={styles.statCard}>
            <Ionicons name="book" size={18} color={Colors.primary} />
            <Text style={styles.statValue}>{shelfCounts.read}</Text>
            <Text style={styles.statLabel}>Books Read</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="flame" size={18} color={Colors.orange} />
            <Text style={styles.statValue}>{streak}</Text>
            <Text style={styles.statLabel}>Streak</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="document-text-outline" size={18} color={Colors.primary} />
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
              trackColor={{ true: Colors.primary, false: Colors.border }}
              thumbColor={Colors.surface}
            />
          </View>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.settingRow} onPress={signOut}>
            <Text style={styles.signOut}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: Spacing.lg, gap: Spacing.lg },

  header: { alignItems: 'center', gap: 8 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initial: { fontSize: 32, fontWeight: '700', color: Colors.surface },
  username: { fontSize: 24, fontWeight: '700', color: Colors.textPrimary },
  bio: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },

  row: { flexDirection: 'row', gap: Spacing.sm },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 4,
    ...Shadow.card,
  },
  statValue: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary },
  statLabel: { fontSize: 11, color: Colors.textSecondary, textAlign: 'center' },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    ...Shadow.card,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  goalText: { fontSize: 14, color: Colors.textSecondary, marginBottom: 8 },
  goalEmpty: { fontSize: 14, color: Colors.textTertiary },
  progressTrack: {
    height: 8,
    backgroundColor: Colors.progressTrack,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: { height: 8, backgroundColor: Colors.primary, borderRadius: 4 },

  pillRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  pill: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: Radius.xl,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.surface,
  },
  pillText: { color: Colors.primary, fontSize: 13, fontWeight: '600' },

  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  settingsCard: {
    backgroundColor: Colors.surface,
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
  settingLabel: { fontSize: 15, color: Colors.textPrimary },
  divider: { height: 1, backgroundColor: Colors.border, marginHorizontal: Spacing.md },
  signOut: { fontSize: 15, color: Colors.error, fontWeight: '600' },

  requestsCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
    ...Shadow.card,
  },
  requestsTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  requestsTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  requestsBadge: {
    color: Colors.primary,
    fontWeight: '700',
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
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  requestInitial: { fontSize: 14, fontWeight: '700', color: Colors.surface },
  requestInfo: { flex: 1 },
  requestUsername: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  requestBio: { fontSize: 12, color: Colors.textSecondary },
  acceptBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  acceptBtnText: { color: Colors.surface, fontWeight: '700', fontSize: 12 },
  declineBtn: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  declineBtnText: { color: Colors.textSecondary, fontWeight: '600', fontSize: 12 },
});
