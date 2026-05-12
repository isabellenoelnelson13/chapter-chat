import { supabase } from './supabase';

export interface Conversation {
  id: string;
  otherUserId: string;
  otherUsername: string;
  otherAvatarUrl: string | null;
  lastMessageBody: string | null;
  lastMessageAt: string;
  unreadCount: number;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export async function getOrCreateConversation(
  currentUserId: string,
  otherUserId: string
): Promise<string> {
  const [p1, p2] = orderedPair(currentUserId, otherUserId);

  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('participant_1', p1)
    .eq('participant_2', p2)
    .maybeSingle();

  if (existing) return existing.id;

  const { data, error } = await supabase
    .from('conversations')
    .insert({ participant_1: p1, participant_2: p2 })
    .select('id')
    .single();

  if (error) throw error;
  return (data as any).id;
}

export async function getConversations(userId: string): Promise<Conversation[]> {
  const { data: rows, error } = await supabase
    .from('conversations')
    .select(`
      id, last_message_at, last_message_body,
      participant_1, participant_2,
      p1:profiles!participant_1(id, username, avatar_url),
      p2:profiles!participant_2(id, username, avatar_url)
    `)
    .or(`participant_1.eq.${userId},participant_2.eq.${userId}`)
    .not('deleted_for', 'cs', `{${userId}}`)
    .order('last_message_at', { ascending: false });

  if (error) throw error;
  if (!rows || rows.length === 0) return [];

  const convIds = rows.map((r: any) => r.id);
  const { data: unreadRows } = await supabase
    .from('messages')
    .select('conversation_id')
    .in('conversation_id', convIds)
    .neq('sender_id', userId)
    .is('read_at', null);

  const unreadMap = new Map<string, number>();
  for (const m of unreadRows ?? []) {
    unreadMap.set(m.conversation_id, (unreadMap.get(m.conversation_id) ?? 0) + 1);
  }

  return rows.map((r: any) => {
    const isP1 = r.participant_1 === userId;
    const other = isP1 ? r.p2 : r.p1;
    return {
      id: r.id,
      otherUserId:    other.id,
      otherUsername:  other.username,
      otherAvatarUrl: other.avatar_url ?? null,
      lastMessageBody: r.last_message_body ?? null,
      lastMessageAt:   r.last_message_at,
      unreadCount:     unreadMap.get(r.id) ?? 0,
    };
  });
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('id, conversation_id, sender_id, body, read_at, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []).map((m: any) => ({
    id: m.id,
    conversationId: m.conversation_id,
    senderId: m.sender_id,
    body: m.body,
    readAt: m.read_at,
    createdAt: m.created_at,
  }));
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  body: string
): Promise<Message> {
  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, body })
    .select('id, conversation_id, sender_id, body, read_at, created_at')
    .single();

  if (error) throw error;

  // Update last message and restore conversation for both participants if it was deleted
  await supabase
    .from('conversations')
    .update({
      last_message_at: (data as any).created_at,
      last_message_body: body,
      deleted_for: [],
    })
    .eq('id', conversationId);

  return {
    id: (data as any).id,
    conversationId: (data as any).conversation_id,
    senderId: (data as any).sender_id,
    body: (data as any).body,
    readAt: (data as any).read_at,
    createdAt: (data as any).created_at,
  };
}

export async function deleteConversation(conversationId: string, userId: string): Promise<void> {
  // Soft delete: append userId to deleted_for using Postgres array append
  const { data: conv } = await supabase
    .from('conversations')
    .select('deleted_for')
    .eq('id', conversationId)
    .single();

  const current: string[] = (conv as any)?.deleted_for ?? [];
  if (current.includes(userId)) return;

  await supabase
    .from('conversations')
    .update({ deleted_for: [...current, userId] })
    .eq('id', conversationId);
}

export async function markRead(conversationId: string, userId: string): Promise<void> {
  await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .neq('sender_id', userId)
    .is('read_at', null);
}

export async function getTotalUnread(userId: string): Promise<number> {
  const { data: convs } = await supabase
    .from('conversations')
    .select('id')
    .or(`participant_1.eq.${userId},participant_2.eq.${userId}`);

  if (!convs?.length) return 0;

  const { count } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .in('conversation_id', convs.map(c => c.id))
    .neq('sender_id', userId)
    .is('read_at', null);

  return count ?? 0;
}
