import { supabase } from './supabase';

export type EventType =
  | 'started_book'
  | 'finished_book'
  | 'added_to_shelf'
  | 'shared_session';

export interface ActivityEvent {
  id: string;
  actorId: string;
  actorUsername: string;
  eventType: EventType;
  bookId: string;
  bookTitle: string;
  bookCoverUrl: string | null;
  metadata: Record<string, any>;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
}

export interface ActivityComment {
  id: string;
  userId: string;
  username: string;
  body: string;
  createdAt: string;
}

export async function getFeed(userId: string): Promise<ActivityEvent[]> {
  // 1. Get following IDs
  const { data: followsData, error: followsError } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId);
  if (followsError) throw followsError;
  const followingIds = (followsData ?? []).map((r: any) => r.following_id);
  const actorIds = [...new Set([...followingIds, userId])];

  // 2. Get events from followed users + self
  const { data: eventsData, error: eventsError } = await supabase
    .from('activity_events')
    .select(
      `id, event_type, book_id, metadata, created_at,
       actor:profiles!actor_id(id, username),
       book:books!book_id(id, title, cover_url),
       likes:activity_likes(count),
       comments:activity_comments(count)`
    )
    .in('actor_id', actorIds)
    .order('created_at', { ascending: false })
    .limit(50);
  if (eventsError) throw eventsError;
  const events = eventsData ?? [];

  if (events.length === 0) return [];

  // 3. Get liked event IDs for current user
  const eventIds = events.map((e: any) => e.id);
  const { data: likesData, error: likesError } = await supabase
    .from('activity_likes')
    .select('event_id')
    .eq('user_id', userId)
    .in('event_id', eventIds);
  if (likesError) throw likesError;
  const likedSet = new Set((likesData ?? []).map((r: any) => r.event_id));

  return events.map((e: any) => ({
    id: e.id,
    actorId: e.actor.id,
    actorUsername: e.actor.username,
    eventType: e.event_type as EventType,
    bookId: e.book_id,
    bookTitle: e.book.title,
    bookCoverUrl: e.book.cover_url,
    metadata: e.metadata,
    createdAt: e.created_at,
    likeCount: e.likes?.[0]?.count ?? 0,
    commentCount: e.comments?.[0]?.count ?? 0,
    likedByMe: likedSet.has(e.id),
  }));
}

export async function getFriendsFeed(userId: string, limit = 5): Promise<ActivityEvent[]> {
  const { data: followsData } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId);
  const followingIds = (followsData ?? []).map((r: any) => r.following_id);
  if (followingIds.length === 0) return [];

  const { data, error } = await supabase
    .from('activity_events')
    .select(
      `id, event_type, book_id, metadata, created_at,
       actor:profiles!actor_id(id, username),
       book:books!book_id(id, title, cover_url)`
    )
    .in('actor_id', followingIds)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;

  return (data ?? []).map((e: any) => ({
    id: e.id,
    actorId: e.actor.id,
    actorUsername: e.actor.username,
    eventType: e.event_type as EventType,
    bookId: e.book_id,
    bookTitle: e.book.title,
    bookCoverUrl: e.book.cover_url,
    metadata: e.metadata,
    createdAt: e.created_at,
    likeCount: 0,
    commentCount: 0,
    likedByMe: false,
  }));
}

export interface ActivityLike {
  userId: string;
  username: string;
}

export async function getEventById(eventId: string, userId: string): Promise<ActivityEvent | null> {
  const { data, error } = await supabase
    .from('activity_events')
    .select(
      `id, event_type, book_id, metadata, created_at,
       actor:profiles!actor_id(id, username),
       book:books!book_id(id, title, cover_url),
       likes:activity_likes(count),
       comments:activity_comments(count)`
    )
    .eq('id', eventId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const { data: likedData } = await supabase
    .from('activity_likes')
    .select('event_id')
    .eq('user_id', userId)
    .eq('event_id', eventId);
  const likedByMe = (likedData ?? []).length > 0;

  const e = data as any;
  return {
    id: e.id,
    actorId: e.actor.id,
    actorUsername: e.actor.username,
    eventType: e.event_type as EventType,
    bookId: e.book_id,
    bookTitle: e.book.title,
    bookCoverUrl: e.book.cover_url,
    metadata: e.metadata,
    createdAt: e.created_at,
    likeCount: e.likes?.[0]?.count ?? 0,
    commentCount: e.comments?.[0]?.count ?? 0,
    likedByMe,
  };
}

export async function getEventLikes(eventId: string): Promise<ActivityLike[]> {
  const { data, error } = await supabase
    .from('activity_likes')
    .select('user_id, user:profiles!user_id(username)')
    .eq('event_id', eventId);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    userId: r.user_id,
    username: r.user.username,
  }));
}

export async function createEvent(
  actorId: string,
  eventType: EventType,
  bookId: string,
  metadata: Record<string, any>
): Promise<void> {
  const { error } = await supabase
    .from('activity_events')
    .insert({ actor_id: actorId, event_type: eventType, book_id: bookId, metadata });
  if (error) throw error;
}

export async function likeEvent(userId: string, eventId: string): Promise<void> {
  const { error } = await supabase
    .from('activity_likes')
    .insert({ event_id: eventId, user_id: userId });
  if (error) throw error;
}

export async function unlikeEvent(userId: string, eventId: string): Promise<void> {
  const { error } = await supabase
    .from('activity_likes')
    .delete()
    .eq('event_id', eventId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function getComments(eventId: string): Promise<ActivityComment[]> {
  const { data, error } = await supabase
    .from('activity_comments')
    .select('id, user_id, body, created_at, user:profiles!user_id(username)')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    userId: r.user_id,
    username: r.user.username,
    body: r.body,
    createdAt: r.created_at,
  }));
}

export async function addComment(
  userId: string,
  eventId: string,
  body: string
): Promise<ActivityComment> {
  const { data, error } = await supabase
    .from('activity_comments')
    .insert({ event_id: eventId, user_id: userId, body })
    .select('id, user_id, body, created_at, user:profiles!user_id(username)')
    .single();
  if (error) throw error;
  return {
    id: data.id,
    userId: data.user_id,
    username: data.user.username,
    body: data.body,
    createdAt: data.created_at,
  };
}
