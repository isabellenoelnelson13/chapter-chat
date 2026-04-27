import { supabase } from './supabase';
import { type BookSearchResult } from './books';

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
): Promise<{ books: BookSearchResult[]; personalized: boolean }> {
  // Load user's read + reading books to check if they have any shelf activity
  const { data: userBooks } = await supabase
    .from('user_books')
    .select('books(hardcover_id)')
    .eq('user_id', userId)
    .in('shelf', ['read', 'reading']);

  if (!userBooks || userBooks.length < 3) {
    return { books: [], personalized: false };
  }

  // Fetch trending, filtering out books already on the user's shelf
  const shelfIds = new Set(
    userBooks.map((ub) => (ub as any).books?.hardcover_id).filter(Boolean)
  );
  const trending = await getTrending('all_time', 40);
  const filtered = trending.filter((b) => !shelfIds.has(b.hardcover_id)).slice(0, 20);

  return { books: filtered, personalized: true };
}
