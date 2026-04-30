import { supabase } from './supabase';
import { Database } from '@/types/database';

export type BookDetails = Database['public']['Tables']['books']['Row'];

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
}

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

export async function searchBooks(query: string): Promise<BookSearchResult[]> {
  return callBooksFunction({ action: 'search', query });
}

export async function updatePageCount(bookId: string, pageCount: number): Promise<void> {
  const { error } = await supabase
    .from('books')
    .update({ page_count: pageCount })
    .eq('id', bookId);
  if (error) throw error;
}

export async function upsertBook(book: BookSearchResult): Promise<string> {
  const { data, error } = await supabase
    .from('books')
    .upsert(
      {
        hardcover_id: book.hardcover_id,
        title: book.title,
        author: book.author,
        cover_url: book.cover_url,
        page_count: book.page_count,
        genres: book.genres,
        description: book.description,
        rating: book.rating,
        users_read_count: book.users_read_count,
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
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
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

export async function getBookReviews(
  bookId: string,
  userId: string
): Promise<{ friendReviews: FriendReview[]; topReviews: SeededReview[] }> {
  // 1. Fetch IDs the current user follows
  const { data: followData } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId);

  const followingIds = (followData ?? []).map((f) => f.following_id);

  // 2. Fetch friend reviews and seeded reviews in parallel
  const [friendRes, seededRes] = await Promise.all([
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
      .limit(10),
  ]);

  if (friendRes.error) throw friendRes.error;
  if (seededRes.error) throw seededRes.error;

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

  return { friendReviews, topReviews };
}
