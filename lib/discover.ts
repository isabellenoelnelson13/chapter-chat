import { type BookSearchResult } from './books';
import { getAIRecommendations } from './agents/recommend';
import { type Recommendation } from './agents/types';

async function callBooksFunction(body: object): Promise<BookSearchResult[]> {
  const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/books`;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Books function error: ${res.status}`);
  return res.json();
}

export type TrendingPeriod = 'last_month' | '3_months' | '1_year' | 'all_time';

export async function getTrending(
  period: TrendingPeriod = 'all_time',
  limit = 20
): Promise<BookSearchResult[]> {
  return callBooksFunction({ action: 'trending', period, limit });
}

export async function getRecommended(
  userId: string
): Promise<{ books: Recommendation[]; personalized: boolean }> {
  return getAIRecommendations(userId);
}
