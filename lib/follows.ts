import { supabase } from './supabase';

export interface UserSearchResult {
  id: string;
  username: string;
  bio: string | null;
  is_private: boolean;
  avatar_url: string | null;
  followStatus: 'following' | 'requested' | 'none';
}

export interface FollowRequest {
  requesterId: string;
  username: string;
  bio: string | null;
}

export async function getFollowStatus(
  followerId: string,
  targetId: string
): Promise<'following' | 'requested' | 'none'> {
  const { data: followData } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('follower_id', followerId)
    .eq('following_id', targetId)
    .maybeSingle();
  if (followData) return 'following';

  const { data: requestData } = await supabase
    .from('follow_requests')
    .select('requester_id')
    .eq('requester_id', followerId)
    .eq('target_id', targetId)
    .maybeSingle();
  if (requestData) return 'requested';

  return 'none';
}

/** Lightweight search returning just id + username — for @mention autocomplete. */
export async function searchUsernames(
  query: string,
  currentUserId: string,
): Promise<{ id: string; username: string }[]> {
  const { data } = await supabase
    .from('profiles')
    .select('id, username')
    .ilike('username', `${query}%`)
    .neq('id', currentUserId)
    .limit(6);
  return (data ?? []) as { id: string; username: string }[];
}

/** Look up user IDs for a list of usernames (for mention notifications). */
export async function getUserIdsByUsernames(
  usernames: string[],
): Promise<{ id: string; username: string }[]> {
  if (usernames.length === 0) return [];
  const { data } = await supabase
    .from('profiles')
    .select('id, username')
    .in('username', usernames);
  return (data ?? []) as { id: string; username: string }[];
}

export async function searchUsers(
  query: string,
  currentUserId: string
): Promise<UserSearchResult[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, bio, is_private, avatar_url')
    .ilike('username', `${query}%`)
    .neq('id', currentUserId)
    .limit(20);
  if (error) throw error;

  const results = await Promise.all(
    (data ?? []).map(async (profile: any) => ({
      id: profile.id,
      username: profile.username,
      bio: profile.bio,
      is_private: profile.is_private,
      avatar_url: profile.avatar_url ?? null,
      followStatus: await getFollowStatus(currentUserId, profile.id),
    }))
  );
  return results;
}

export async function followUser(
  followerId: string,
  targetId: string,
  isPrivate: boolean
): Promise<void> {
  if (isPrivate) {
    const { error } = await supabase
      .from('follow_requests')
      .insert({ requester_id: followerId, target_id: targetId });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('follows')
      .insert({ follower_id: followerId, following_id: targetId });
    if (error) throw error;
  }
}

export async function unfollowUser(
  followerId: string,
  targetId: string
): Promise<void> {
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', targetId);
  if (error) throw error;
}

export async function cancelFollowRequest(
  requesterId: string,
  targetId: string
): Promise<void> {
  const { error } = await supabase
    .from('follow_requests')
    .delete()
    .eq('requester_id', requesterId)
    .eq('target_id', targetId);
  if (error) throw error;
}

export async function getFollowing(userId: string): Promise<UserSearchResult[]> {
  const { data, error } = await supabase
    .from('follows')
    .select('profile:profiles!following_id(id, username, bio, is_private, avatar_url)')
    .eq('follower_id', userId);
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    ...row.profile,
    avatar_url: row.profile.avatar_url ?? null,
    followStatus: 'following' as const,
  }));
}

export async function getFollowers(userId: string): Promise<UserSearchResult[]> {
  const { data, error } = await supabase
    .from('follows')
    .select('profile:profiles!follower_id(id, username, bio, is_private, avatar_url)')
    .eq('following_id', userId);
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    ...row.profile,
    avatar_url: row.profile.avatar_url ?? null,
    followStatus: 'none' as const,
  }));
}

export async function getFollowRequests(userId: string): Promise<FollowRequest[]> {
  const { data, error } = await supabase
    .from('follow_requests')
    .select('profile:profiles!requester_id(id, username, bio)')
    .eq('target_id', userId);
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    requesterId: row.profile.id,
    username: row.profile.username,
    bio: row.profile.bio,
  }));
}

export async function approveFollowRequest(
  requesterId: string,
  targetId: string
): Promise<void> {
  const { error: deleteError } = await supabase
    .from('follow_requests')
    .delete()
    .eq('requester_id', requesterId)
    .eq('target_id', targetId);
  if (deleteError) throw deleteError;

  const { error: insertError } = await supabase
    .from('follows')
    .insert({ follower_id: requesterId, following_id: targetId });
  if (insertError) throw insertError;
}

export async function declineFollowRequest(
  requesterId: string,
  targetId: string
): Promise<void> {
  const { error } = await supabase
    .from('follow_requests')
    .delete()
    .eq('requester_id', requesterId)
    .eq('target_id', targetId);
  if (error) throw error;
}
