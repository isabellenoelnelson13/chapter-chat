import { supabase } from './supabase';
import { Database } from '@/types/database';

export type BookDetails = Database['public']['Tables']['books']['Row'];

export interface BookSummary {
  id: string;
  title: string;
  author: string;
  cover_url: string | null;
  genres: string[] | null;
}

export interface BookSearchResult {
  hardcover_id: string;
  title: string;
  author: string;
  cover_url: string | null;
  page_count: number | null;
  genres: string[] | null;
  description: string | null;
  rating: number | null;
  users_read_count: number;
  series_id: string | null;
  series_name: string | null;
  series_position: number | null;
}

async function callBooksFunction(body: object): Promise<BookSearchResult[]> {
  const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/books`;
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
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Books function error: ${res.status}`);
  return res.json();
}

export async function searchBooks(query: string): Promise<BookSearchResult[]> {
  return callBooksFunction({ action: 'search', query });
}

async function fetchGoogleBooksGenres(title: string, author: string): Promise<string[] | null> {
  try {
    const apiKey = process.env.EXPO_PUBLIC_GOOGLE_BOOKS_API_KEY ?? '';
    const q = encodeURIComponent(`intitle:${title} inauthor:${author}`);
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=5&key=${apiKey}`);
    if (!res.ok) return null;
    const json = await res.json();
    const categories: string[] = [];
    for (const item of json.items ?? []) {
      for (const cat of item.volumeInfo?.categories ?? []) {
        // "Juvenile Fiction / Fantasy & Magic" → "Fantasy & Magic", dedupe
        const top = (cat as string).split('/').pop()!.trim();
        if (top && !categories.includes(top)) categories.push(top);
      }
    }
    return categories.length > 0 ? categories : null;
  } catch {
    return null;
  }
}

export async function refreshBookGenres(bookId: string, title: string, author: string): Promise<void> {
  const genres = await fetchGoogleBooksGenres(title, author);
  if (!genres) return;
  await supabase.from('books').update({ genres }).eq('id', bookId);
}

export async function searchGoogleImages(query: string): Promise<string[]> {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_BOOKS_API_KEY ?? '';
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=20&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Google Books image search error: ${res.status}`);
  const json = await res.json();
  return (json.items ?? [])
    .map((item: any) => {
      const links = item.volumeInfo?.imageLinks;
      return links?.large ?? links?.medium ?? links?.thumbnail ?? null;
    })
    .filter(Boolean)
    .map((url: string) => url.replace('http://', 'https://'));
}

export async function updateBookGenres(bookId: string, genres: string[]): Promise<void> {
  const { error } = await supabase
    .from('books')
    .update({ genres })
    .eq('id', bookId);
  if (error) throw error;
}

export async function updateCoverUrl(bookId: string, coverUrl: string): Promise<void> {
  const { error } = await supabase
    .from('books')
    .update({ cover_url: coverUrl })
    .eq('id', bookId);
  if (error) throw error;
}

export async function updatePageCount(bookId: string, pageCount: number): Promise<void> {
  const { error } = await supabase
    .from('books')
    .update({ page_count: pageCount })
    .eq('id', bookId);
  if (error) throw error;
}

export async function upsertBook(book: BookSearchResult): Promise<string> {
  const googleGenres = await fetchGoogleBooksGenres(book.title, book.author);
  const { data, error } = await supabase
    .from('books')
    .upsert(
      {
        hardcover_id: book.hardcover_id,
        title: book.title,
        author: book.author,
        cover_url: book.cover_url,
        page_count: book.page_count,
        genres: googleGenres ?? book.genres,
        description: book.description,
        rating: book.rating,
        users_read_count: book.users_read_count,
        series_id: book.series_id,
        series_name: book.series_name,
        series_position: book.series_position,
      },
      { onConflict: 'hardcover_id' }
    )
    .select('id')
    .single();
  if (error) throw error;
  if (!data) throw new Error('upsertBook: no data returned from Supabase');
  return data.id;
}

export interface HardcoverReview {
  rating: number | null;
  review: string;
  username: string;
}

export interface FriendReview {
  userId: string;
  username: string;
  avatarUrl: string | null;
  rating: number | null;
  review: string;
  finishedAt: string | null;
}

export interface RatingBreakdown {
  5: number; 4: number; 3: number; 2: number; 1: number;
}

export interface SeededReview {
  id: string;
  reviewerName: string | null;
  rating: number | null;
  body: string;
  dateAdded: string | null;
  helpfulVotes: number;
}

export async function getHardcoverReviews(
  hardcoverId: string,
  limit = 10
): Promise<HardcoverReview[]> {
  const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/books`;
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
    body: JSON.stringify({ action: 'reviews', hardcover_id: hardcoverId, limit }),
  });
  if (!res.ok) throw new Error(`Books function error: ${res.status}`);
  return res.json();
}

export async function getBookById(bookId: string): Promise<BookDetails | null> {
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .eq('id', bookId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createManualBook(params: {
  title: string;
  author?: string;
  pageCount?: number;
  coverUrl?: string;
  description?: string;
}): Promise<string> {
  const { data, error } = await supabase
    .from('books')
    .insert({
      hardcover_id: null,
      title: params.title,
      author: params.author ?? null,
      page_count: params.pageCount ?? null,
      cover_url: params.coverUrl ?? null,
      description: params.description ?? null,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function getSeriesBooks(seriesId: string): Promise<BookSearchResult[]> {
  return callBooksFunction({ action: 'series', series_id: seriesId });
}

/** Fetches series fields from Hardcover for a book already in the DB and writes them back. */
export async function refreshBookSeries(bookId: string, hardcoverId: string): Promise<void> {
  const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/books`;
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
    body: JSON.stringify({ action: 'book', hardcover_id: hardcoverId }),
  });
  if (!res.ok) return;
  const result: BookSearchResult | null = await res.json();
  if (!result) return;
  await supabase
    .from('books')
    .update({
      series_id: result.series_id,
      series_name: result.series_name,
      series_position: result.series_position,
    })
    .eq('id', bookId);
}

export async function getBookReviews(
  bookId: string,
  userId: string
): Promise<{ friendReviews: FriendReview[]; topReviews: SeededReview[]; communityReviews: FriendReview[]; ratingBreakdown: RatingBreakdown }> {
  // 1. Fetch IDs the current user follows
  const { data: followData, error: followError } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId);
  if (followError) throw followError;

  const followingIds = (followData ?? []).map((f) => f.following_id);

  // 2. Fetch friend reviews, seeded reviews, and all other user reviews in parallel
  const [friendRes, seededRes, communityRes] = await Promise.all([
    followingIds.length > 0
      ? supabase
          .from('user_books')
          .select('user_id, rating, review, finished_at, profiles(username, avatar_url)')
          .eq('book_id', bookId)
          .not('review', 'is', null)
          .in('user_id', followingIds)
      : Promise.resolve({ data: [] as any[], error: null }),
    supabase
      .from('book_reviews')
      .select('*')
      .eq('book_id', bookId)
      .order('helpful_votes', { ascending: false })
      .limit(20),
    supabase
      .from('user_books')
      .select('user_id, rating, review, finished_at, profiles(username, avatar_url)')
      .eq('book_id', bookId)
      .not('review', 'is', null)
      .neq('user_id', userId)
      .order('finished_at', { ascending: false })
      .limit(20),
  ]);

  if (friendRes.error) throw friendRes.error;
  if (seededRes.error) throw seededRes.error;

  const followingIdSet = new Set(followingIds);

  const friendReviews: FriendReview[] = (friendRes.data ?? []).map((row: any) => ({
    userId: row.user_id,
    username: (row.profiles as any)?.username ?? 'Unknown',
    avatarUrl: (row.profiles as any)?.avatar_url ?? null,
    rating: row.rating,
    review: row.review as string,
    finishedAt: row.finished_at,
  }));

  const topReviews: SeededReview[] = (seededRes.data ?? []).map((row) => ({
    id: row.id,
    reviewerName: row.reviewer_name,
    rating: row.rating != null ? Number(row.rating) : null,
    body: row.body ?? '',
    dateAdded: row.date_added,
    helpfulVotes: row.helpful_votes,
  }));

  // Community reviews = all other users except self and friends (already shown above)
  const communityReviews: FriendReview[] = (communityRes.data ?? [])
    .filter((row: any) => !followingIdSet.has(row.user_id))
    .map((row: any) => ({
      userId: row.user_id,
      username: (row.profiles as any)?.username ?? 'Unknown',
      avatarUrl: (row.profiles as any)?.avatar_url ?? null,
      rating: row.rating,
      review: row.review as string,
      finishedAt: row.finished_at,
    }));

  const ratingBreakdown: RatingBreakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  for (const r of topReviews) {
    if (r.rating != null) {
      const star = Math.round(r.rating) as 1 | 2 | 3 | 4 | 5;
      if (star >= 1 && star <= 5) ratingBreakdown[star]++;
    }
  }

  return { friendReviews, topReviews, communityReviews, ratingBreakdown };
}

export async function getSimilarBooks(
  bookId: string,
  userId: string,
  genres: string[],
): Promise<BookSummary[]> {
  // Books the user already has in their library — we exclude these
  const { data: userBooks } = await supabase
    .from('user_books')
    .select('book_id')
    .eq('user_id', userId);

  const excludeIds = new Set([bookId, ...(userBooks?.map(b => b.book_id) ?? [])]);

  if (genres.length === 0) return [];

  const { data, error } = await supabase
    .from('books')
    .select('id, title, author, cover_url, genres')
    .overlaps('genres', genres)
    .neq('id', bookId)
    .limit(20);

  if (error) return [];

  return (data ?? [])
    .filter(row => !excludeIds.has(row.id))
    .map(row => ({
      id: row.id,
      title: row.title,
      author: row.author,
      cover_url: row.cover_url ?? null,
      genres: row.genres ?? null,
    }))
    .slice(0, 12);
}
