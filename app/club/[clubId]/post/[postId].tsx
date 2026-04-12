import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { getThread, addPost, type ClubPost } from '@/lib/clubs';
import { Colors, Spacing, Radius, Shadow } from '@/constants/theme';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function ClubPostScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const { clubId, postId } = useLocalSearchParams<{ clubId: string; postId: string }>();
  const userId = session?.user.id ?? '';

  const [parent, setParent] = useState<ClubPost | null>(null);
  const [replies, setReplies] = useState<ClubPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');

  useEffect(() => {
    getThread(postId)
      .then(({ parent: p, replies: r }) => {
        setParent(p);
        setReplies(r);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [postId]);

  const handleSendReply = async () => {
    if (!replyText.trim()) return;
    const body = replyText.trim();
    setReplyText('');
    const newReply = await addPost(clubId, userId, body, postId);
    setReplies((prev) => [...prev, newReply]);
  };

  if (!session) return null;

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={24} color={Colors.primary} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
          >
            {parent && (
              <View style={styles.parentCard}>
                <Text style={styles.postUsername}>{parent.username}</Text>
                <Text style={styles.parentBody}>{parent.body}</Text>
                <Text style={styles.timestamp}>{timeAgo(parent.createdAt)}</Text>
              </View>
            )}

            {replies.length === 0 ? (
              <Text style={styles.emptyText}>No replies yet.</Text>
            ) : (
              replies.map((r) => (
                <View key={r.id} style={styles.replyCard}>
                  <Text style={styles.postUsername}>{r.username}</Text>
                  <Text style={styles.replyBody}>{r.body}</Text>
                  <Text style={styles.timestamp}>{timeAgo(r.createdAt)}</Text>
                </View>
              ))
            )}
          </ScrollView>
        )}

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Write a reply..."
            placeholderTextColor={Colors.textTertiary}
            value={replyText}
            onChangeText={setReplyText}
          />
          <TouchableOpacity onPress={handleSendReply} testID="send-reply-btn">
            <Ionicons name="send" size={22} color={Colors.primary} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    gap: 4,
  },
  backText: { color: Colors.primary, fontSize: 16, fontWeight: '600' },
  scroll: { padding: Spacing.lg, gap: Spacing.md },
  parentCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: 6,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
    ...Shadow.card,
  },
  replyCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: 4,
    marginLeft: Spacing.lg,
    ...Shadow.card,
  },
  postUsername: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  parentBody: { fontSize: 16, color: Colors.textPrimary, lineHeight: 22 },
  replyBody: { fontSize: 14, color: Colors.textPrimary, lineHeight: 20 },
  timestamp: { fontSize: 11, color: Colors.textTertiary },
  emptyText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginTop: 24 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
});
