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

export async function getTrending(limit = 20): Promise<BookSearchResult[]> {
  return callBooksFunction({ action: 'trending', limit });
}

export async function getBooksByGenre(
  genre: string,
  limit = 20
): Promise<BookSearchResult[]> {
  return callBooksFunction({ action: 'by_genre', genre, limit });
}

export async function getRecommended(
  userId: string
): Promise<{ books: BookSearchResult[]; personalized: boolean }> {
  // 1. Load user's read + reading books with genres and hardcover_id
  const { data: userBooks } = await supabase
    .from('user_books')
    .select('books(genres, hardcover_id)')
    .eq('user_id', userId)
    .in('shelf', ['read', 'reading']);

  if (!userBooks || userBooks.length < 3) {
    const books = await getTrending(20);
    return { books, personalized: false };
  }

  // 2. Count genre frequency and collect shelf hardcover IDs
  const genreCount: Record<string, number> = {};
  const shelfHardcoverIds = new Set<string>();

  for (const ub of userBooks) {
    const book = (ub as any).books;
    if (book?.hardcover_id) shelfHardcoverIds.add(book.hardcover_id);
    for (const g of (book?.genres ?? [])) {
      genreCount[g] = (genreCount[g] ?? 0) + 1;
    }
  }

  const topGenres = Object.entries(genreCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([g]) => g);

  if (topGenres.length === 0) {
    const books = await getTrending(20);
    return { books, personalized: false };
  }

  // 3. Fetch by top genres, merge, deduplicate, filter shelf books
  const results = await Promise.all(topGenres.map((g) => getBooksByGenre(g, 20)));

  const seen = new Set<string>();
  const merged: BookSearchResult[] = [];

  for (const genreBooks of results) {
    for (const book of genreBooks) {
      if (!seen.has(book.hardcover_id) && !shelfHardcoverIds.has(book.hardcover_id)) {
        seen.add(book.hardcover_id);
        merged.push(book);
      }
    }
  }

  return { books: merged.slice(0, 20), personalized: true };
}
