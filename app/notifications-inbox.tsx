import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import {
  getInboxNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type InboxNotification,
} from '@/lib/notifications';
import { useTheme } from '@/lib/theme';
import { Fonts, Spacing, Radius, Shadow } from '@/constants/theme';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationsInboxScreen() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const router = useRouter();
  const userId = session!.user.id;

  const [notifications, setNotifications] = useState<InboxNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      getInboxNotifications(userId)
        .then(setNotifications)
        .finally(() => setLoading(false));
    }, [userId])
  );

  const handlePress = async (item: InboxNotification) => {
    if (!item.read) {
      await markNotificationRead(item.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
      );
    }
    // Navigate based on notification data
    const data = item.data ?? {};
    if (data.eventId) router.push(`/activity/${data.eventId}`);
    else if (data.clubId) router.push(`/club/${data.clubId}`);
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead(userId);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    title: { fontSize: 24, fontFamily: Fonts.bold, color: colors.primary },
    markAll: { fontSize: 13, fontFamily: Fonts.semiBold, color: colors.primary },
    markAllDisabled: { color: colors.textTertiary },
    list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg, gap: Spacing.sm },
    card: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.md,
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      padding: Spacing.md,
      ...Shadow.card,
    },
    cardUnread: {
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
      marginTop: 6,
    },
    dotRead: { backgroundColor: 'transparent' },
    cardBody: { flex: 1, gap: 3 },
    cardTitle: { fontSize: 14, fontFamily: Fonts.bold, color: colors.textPrimary },
    cardMessage: { fontSize: 13, fontFamily: Fonts.regular, color: colors.textSecondary, lineHeight: 18 },
    cardTime: { fontSize: 11, fontFamily: Fonts.regular, color: colors.textTertiary },
    empty: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingBottom: 80,
    },
    emptyText: { fontSize: 16, fontFamily: Fonts.semiBold, color: colors.textPrimary },
    emptySubtext: { fontSize: 13, fontFamily: Fonts.regular, color: colors.textSecondary },
  }), [colors]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.title}>Notifications</Text>
        </View>
        <TouchableOpacity onPress={handleMarkAllRead} disabled={unreadCount === 0}>
          <Text style={[styles.markAll, unreadCount === 0 && styles.markAllDisabled]}>
            Mark all read
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={notifications.length === 0 ? styles.empty : styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.card, !item.read && styles.cardUnread]}
              onPress={() => handlePress(item)}
              activeOpacity={0.75}
            >
              <View style={[styles.dot, item.read && styles.dotRead]} />
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardMessage}>{item.body}</Text>
                <Text style={styles.cardTime}>{timeAgo(item.createdAt)}</Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <>
              <Ionicons name="notifications-outline" size={48} color={colors.textTertiary} />
              <Text style={styles.emptyText}>No notifications yet</Text>
              <Text style={styles.emptySubtext}>Activity from friends and clubs will appear here</Text>
            </>
          }
        />
      )}
    </SafeAreaView>
  );
}
