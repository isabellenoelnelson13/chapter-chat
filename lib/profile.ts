import { supabase } from './supabase';

export interface UserProfile {
  id: string;
  username: string;
  bio: string | null;
  is_private: boolean;
  yearly_goal: number;
}

export async function getProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, bio, is_private, yearly_goal')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data as UserProfile | null;
}

export async function updateYearlyGoal(userId: string, goal: number): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ yearly_goal: goal })
    .eq('id', userId);
  if (error) throw error;
}

export async function updatePrivacy(userId: string, isPrivate: boolean): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ is_private: isPrivate })
    .eq('id', userId);
  if (error) throw error;
}
