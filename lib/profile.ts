import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from './supabase';

export interface UserProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_private: boolean;
  yearly_goal: number;
}

export async function getProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, bio, is_private, yearly_goal')
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

export async function updateUsername(userId: string, username: string): Promise<string | null> {
  const clean = username.trim().toLowerCase();

  if (!/^[a-z0-9_]{3,20}$/.test(clean)) {
    return 'Username must be 3–20 characters and can only contain letters, numbers, and underscores.';
  }

  // Check availability
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', clean)
    .neq('id', userId)
    .maybeSingle();

  if (existing) return 'That username is already taken.';

  const { error } = await supabase
    .from('profiles')
    .update({ username: clean })
    .eq('id', userId);

  if (error) return error.message;
  return null; // null = success
}

export async function updateDisplayName(userId: string, displayName: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ display_name: displayName.trim() || null })
    .eq('id', userId);
  if (error) throw error;
}

export async function pickAndUploadAvatar(userId: string): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });

  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  const ext = asset.uri.split('.').pop() ?? 'jpg';
  const path = `${userId}/avatar.${ext}`;

  const base64 = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: 'base64',
  });
  const arrayBuffer = Uint8Array.from(atob(base64), c => c.charCodeAt(0)).buffer;

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, arrayBuffer, { upsert: true, contentType: `image/${ext}` });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  const publicUrl = `${data.publicUrl}?t=${Date.now()}`;

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ avatar_url: publicUrl })
    .eq('id', userId);
  if (updateError) throw updateError;

  return publicUrl;
}
