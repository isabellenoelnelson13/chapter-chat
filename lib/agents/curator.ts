import { supabase } from '../supabase';
import { CuratorResult } from './types';

export async function curateReadingList(
  userId: string,
  goal?: string,
): Promise<CuratorResult> {
  const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/curator`;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? anonKey;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ userId, goal }),
  });

  if (!res.ok) throw new Error(`Curator function error: ${res.status}`);
  return res.json();
}
