import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth';
import { getProfile, type UserProfile } from '@/lib/profile';
import { getShelf } from '@/lib/userBooks';
import {
  getFollowStatus,
  followUser,
  unfollowUser,
  cancelFollowRequest,
} from '@/lib/follows';
import { Colors, Spacing, Radius, Shadow } from '@/constants/theme';

export default function UserProfileScreen() {
  const { userId: targetUserId } = useLocalSearchParams<{ userId: string }>();
  const { session } = useAuth();
  const currentUserId = session?.user.id ?? '';

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [followStatus, setFollowStatus] = useState<'following' | 'requested' | 'none'>('none');
  const [shelfCounts, setShelfCounts] = useState({ reading: 0, want: 0, read: 0, dnf: 0 });

  useFocusEffect(
    useCallback(() => {
      if (!targetUserId || !currentUserId) return;
      setLoading(true);
      Promise.all([
        getProfile(targetUserId),
        getFollowStatus(currentUserId, targetUserId),
        getShelf(targetUserId, 'reading'),
        getShelf(targetUserId, 'want'),
        getShelf(targetUserId, 'read'),
        getShelf(targetUserId, 'dnf'),
      ])
        .then(([p, fs, reading, want, read, dnf]) => {
          setProfile(p);
          setFollowStatus(fs);
          setShelfCounts({
            reading: reading.length,
            want: want.length,
            read: read.length,
            dnf: dnf.length,
          });
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }, [targetUserId, currentUserId])
  );

  if (!session) return null;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  const canSeeShelf = profile && (!profile.is_private || followStatus === 'following');
  const followLabel =
    followStatus === 'following' ? 'Following' :
    followStatus === 'requested' ? 'Requested' :
    'Follow';
  const followOutlined = followStatus !== 'none';

  const handleFollow = async () => {
    if (!profile) return;
    if (followStatus === 'none') {
      setFollowStatus(profile.is_private ? 'requested' : 'following');
      await followUser(currentUserId, targetUserId, profile.is_private);
    } else if (followStatus === 'requested') {
      setFollowStatus('none');
      await cancelFollowRequest(currentUserId, targetUserId);
    } else {
      setFollowStatus('none');
      await unfollowUser(currentUserId, targetUserId);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.initial}>
              {profile?.username.charAt(0).toUpperCase() ?? '?'}
            </Text>
          </View>
          <Text style={styles.username}>{profile?.username ?? ''}</Text>
          {profile?.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
        </View>

        {/* Follow button */}
        <TouchableOpacity
          style={[styles.followBtn, followOutlined && styles.followBtnOutlined]}
          onPress={handleFollow}
          testID="follow-btn"
        >
          <Text style={[styles.followBtnText, followOutlined && styles.followBtnTextOutlined]}>
            {followLabel}
          </Text>
        </TouchableOpacity>

        {/* Shelf counts or private label */}
        {canSeeShelf ? (
          <View style={styles.pillRow}>
            {[
              { label: 'Read', count: shelfCounts.read },
              { label: 'Reading', count: shelfCounts.reading },
              { label: 'Want', count: shelfCounts.want },
              { label: 'DNF', count: shelfCounts.dnf },
            ].map(({ label, count }) => (
              <View key={label} style={styles.pill}>
                <Text style={styles.pillText}>{label} · {count}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.privateLabel}>🔒 Private profile</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: {
    padding: Spacing.lg,
    gap: Spacing.lg,
    alignItems: 'center',
  },
  header: { alignItems: 'center', gap: 8, width: '100%' },
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
  followBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.xl,
    paddingHorizontal: 32,
    paddingVertical: 10,
  },
  followBtnOutlined: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  followBtnText: { color: Colors.surface, fontWeight: '700', fontSize: 15 },
  followBtnTextOutlined: { color: Colors.primary },
  pillRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  pill: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: Radius.xl,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.surface,
  },
  pillText: { color: Colors.primary, fontSize: 13, fontWeight: '600' },
  privateLabel: { fontSize: 15, color: Colors.textSecondary },
});
