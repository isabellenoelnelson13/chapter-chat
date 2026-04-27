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

export async function getBookReviews(
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
