import { supabase } from '../supabase';
import { Recommendation } from './types';

export async function getAIRecommendations(
  userId: string,
): Promise<{ recommendations: Recommendation[]; personalized: boolean }> {
  const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/recommend`;
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
    body: JSON.stringify({ userId }),
  });

  if (!res.ok) throw new Error(`Recommend function error: ${res.status}`);
  return res.json();
}
