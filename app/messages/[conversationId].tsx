import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { getMessages, sendMessage, markRead, type Message } from '@/lib/messages';
import { getConversations } from '@/lib/messages';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { Fonts, Spacing, Radius } from '@/constants/theme';

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Today';
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function ConversationScreen() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const router = useRouter();
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const userId = session?.user.id ?? '';

  const [messages, setMessages] = useState<Message[]>([]);
  const [otherUsername, setOtherUsername] = useState('');
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  // Load messages and get other user's name
  useFocusEffect(
    useCallback(() => {
      if (!conversationId || !userId) return;
      setLoading(true);
      Promise.all([
        getMessages(conversationId),
        getConversations(userId),
      ]).then(([msgs, convs]) => {
        setMessages(msgs);
        const conv = convs.find(c => c.id === conversationId);
        if (conv) setOtherUsername(conv.otherUsername);
        markRead(conversationId, userId).catch(() => {});
        setLoading(false);
      }).catch(() => setLoading(false));
    }, [conversationId, userId])
  );

  // Real-time subscription for new messages
  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const m = payload.new as any;
          const newMsg: Message = {
            id: m.id, conversationId: m.conversation_id,
            senderId: m.sender_id, body: m.body,
            readAt: m.read_at, createdAt: m.created_at,
          };
          setMessages(prev => {
            if (prev.some(p => p.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          if (m.sender_id !== userId) markRead(conversationId, userId).catch(() => {});
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId, userId]);

  // Scroll to end when messages change
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100);
    }
  }, [messages.length]);

  const handleSend = async () => {
    const text = body.trim();
    if (!text || sending) return;
    setBody('');
    setSending(true);
    try {
      const msg = await sendMessage(conversationId, userId, text);
      setMessages(prev => prev.some(p => p.id === msg.id) ? prev : [...prev, msg]);
    } catch {
      setBody(text); // restore on failure
    } finally {
      setSending(false);
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
      borderBottomWidth: 1, borderBottomColor: colors.border, gap: Spacing.md,
    },
    headerName: { flex: 1, fontSize: 17, fontFamily: Fonts.semiBold, color: colors.textPrimary },
    list: { padding: Spacing.md, gap: Spacing.sm },
    dateSeparator: {
      alignSelf: 'center',
      fontSize: 12, fontFamily: Fonts.regular,
      color: colors.textTertiary, marginVertical: 8,
    },
    bubbleRow: { flexDirection: 'row', marginBottom: 4 },
    bubbleRowMe: { justifyContent: 'flex-end' },
    bubbleRowThem: { justifyContent: 'flex-start' },
    bubble: {
      maxWidth: '75%', paddingHorizontal: 14, paddingVertical: 10,
      borderRadius: Radius.lg,
    },
    bubbleMe: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
    bubbleThem: { backgroundColor: colors.surface, borderBottomLeftRadius: 4 },
    bubbleText: { fontSize: 15, fontFamily: Fonts.regular, lineHeight: 21 },
    bubbleTextMe: { color: colors.surface },
    bubbleTextThem: { color: colors.textPrimary },
    bubbleTime: { fontSize: 10, fontFamily: Fonts.regular, marginTop: 2 },
    bubbleTimeMe: { color: `${colors.surface}99`, textAlign: 'right' },
    bubbleTimeThem: { color: colors.textTertiary },
    inputRow: {
      flexDirection: 'row', alignItems: 'flex-end',
      padding: Spacing.md, gap: Spacing.sm,
      borderTopWidth: 1, borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
    input: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: Radius.xl,
      paddingHorizontal: Spacing.md,
      paddingVertical: 10,
      fontSize: 15, fontFamily: Fonts.regular,
      color: colors.textPrimary,
      maxHeight: 120,
    },
    sendBtn: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: colors.primary,
      justifyContent: 'center', alignItems: 'center',
    },
    sendBtnDisabled: { opacity: 0.4 },
  }), [colors]);

  // Group messages by date for separators
  const renderItem = ({ item, index }: { item: Message; index: number }) => {
    const isMe = item.senderId === userId;
    const prevMsg = messages[index - 1];
    const showDate = !prevMsg || formatDate(prevMsg.createdAt) !== formatDate(item.createdAt);

    return (
      <>
        {showDate && <Text style={styles.dateSeparator}>{formatDate(item.createdAt)}</Text>}
        <View style={[styles.bubbleRow, isMe ? styles.bubbleRowMe : styles.bubbleRowThem]}>
          <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
            <Text style={[styles.bubbleText, isMe ? styles.bubbleTextMe : styles.bubbleTextThem]}>
              {item.body}
            </Text>
            <Text style={[styles.bubbleTime, isMe ? styles.bubbleTimeMe : styles.bubbleTimeThem]}>
              {formatTime(item.createdAt)}
            </Text>
          </View>
        </View>
      </>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerName}>{otherUsername}</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={m => m.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={body}
            onChangeText={setBody}
            placeholder="Message..."
            placeholderTextColor={colors.textTertiary}
            multiline
            returnKeyType="default"
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!body.trim() || sending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!body.trim() || sending}
          >
            <Ionicons name="send" size={18} color={colors.surface} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
