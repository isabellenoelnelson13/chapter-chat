import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { getConversations, deleteConversation, type Conversation } from '@/lib/messages';
import { useTheme } from '@/lib/theme';
import { Fonts, Spacing, Radius, Shadow } from '@/constants/theme';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default function MessagesScreen() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const router = useRouter();
  const userId = session?.user.id ?? '';

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      setLoading(true);
      getConversations(userId)
        .then(setConversations)
        .catch(() => {})
        .finally(() => setLoading(false));
    }, [userId])
  );

  const handleDelete = (conv: Conversation) => {
    Alert.alert(
      'Delete conversation',
      `Remove your conversation with ${conv.otherUsername}? They won't be notified.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setConversations(prev => prev.filter(c => c.id !== conv.id));
            await deleteConversation(conv.id, userId);
          },
        },
      ]
    );
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    backBtn: { marginRight: Spacing.md },
    title: { flex: 1, fontSize: 20, fontFamily: Fonts.bold, color: colors.textPrimary },
    row: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
      gap: Spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    avatar: {
      width: 48, height: 48, borderRadius: 24,
      backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
    },
    avatarImg: { width: 48, height: 48, borderRadius: 24 },
    avatarInitial: { fontSize: 18, fontFamily: Fonts.bold, color: colors.surface },
    info: { flex: 1 },
    nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    username: { fontSize: 15, fontFamily: Fonts.semiBold, color: colors.textPrimary },
    timestamp: { fontSize: 12, fontFamily: Fonts.regular, color: colors.textTertiary },
    preview: { fontSize: 14, fontFamily: Fonts.regular, color: colors.textSecondary, marginTop: 2 },
    previewUnread: { color: colors.textPrimary, fontFamily: Fonts.semiBold },
    unreadDot: {
      width: 9, height: 9, borderRadius: 5,
      backgroundColor: colors.primary, marginTop: 4, alignSelf: 'flex-start',
    },
    empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
    emptyText: { fontSize: 16, fontFamily: Fonts.regular, color: colors.textSecondary },
    emptySubText: { fontSize: 13, fontFamily: Fonts.regular, color: colors.textTertiary },
  }), [colors]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Messages</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : conversations.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="chatbubbles-outline" size={48} color={colors.textTertiary} />
          <Text style={styles.emptyText}>No messages yet</Text>
          <Text style={styles.emptySubText}>Message someone from their profile</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={c => c.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => router.push(`/messages/${item.id}`)}
              onLongPress={() => handleDelete(item)}
              delayLongPress={400}
            >
              {item.otherAvatarUrl ? (
                <Image source={{ uri: item.otherAvatarUrl }} style={styles.avatarImg} />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarInitial}>
                    {item.otherUsername.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.info}>
                <View style={styles.nameRow}>
                  <Text style={styles.username}>{item.otherUsername}</Text>
                  <Text style={styles.timestamp}>{timeAgo(item.lastMessageAt)}</Text>
                </View>
                {item.lastMessageBody ? (
                  <Text
                    style={[styles.preview, item.unreadCount > 0 && styles.previewUnread]}
                    numberOfLines={1}
                  >
                    {item.lastMessageBody}
                  </Text>
                ) : null}
              </View>
              {item.unreadCount > 0 && <View style={styles.unreadDot} />}
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}
