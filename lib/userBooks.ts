import { supabase } from './supabase';
import { Shelf, Database } from '../types/database';

type BookRow = Database['public']['Tables']['books']['Row'];

export type BookFormat = 'physical' | 'ebook' | 'audiobook';

export interface UserBookWithBook {
  id: string;
  user_id: string;
  book_id: string;
  shelf: Shelf;
  current_page: number;
  rating: number | null;
  review: string | null;
  added_at: string;
  started_at: string | null;
  finished_at: string | null;
  format: BookFormat;
  progress_percent: number | null;
  book: Pick<BookRow, 'id' | 'title' | 'author' | 'cover_url' | 'page_count' | 'rating' | 'users_read_count'> & {
    description: string | null;
  };
}

const BOOK_SELECT = '*, book:books(id, title, author, cover_url, page_count, description, rating, users_read_count)';

export async function removeFromShelf(userBookId: string): Promise<void> {
  const { error } = await supabase
    .from('user_books')
    .delete()
    .eq('id', userBookId);
  if (error) throw error;
}

export async function addToShelf(userId: string, bookId: string, shelf: Shelf, format?: BookFormat): Promise<string> {
  const now = new Date().toISOString();
  const row: Record<string, unknown> = { user_id: userId, book_id: bookId, shelf, current_page: 0 };
  if (format) row.format = format;
  if (shelf === 'reading') row.started_at = now;
  if (shelf === 'read') { row.started_at = now; row.finished_at = now; }
  const { data, error } = await supabase
    .from('user_books')
    .insert(row)
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function moveShelf(userBookId: string, shelf: Shelf): Promise<void> {
  const now = new Date().toISOString();
  const update: Record<string, unknown> = { shelf };
  if (shelf === 'reading') update.started_at = now;
  if (shelf === 'read') update.finished_at = now;
  const { error } = await supabase
    .from('user_books')
    .update(update)
    .eq('id', userBookId);
  if (error) throw error;
}

export async function updateReadDates(
  userBookId: string,
  startedAt: string | null,
  finishedAt: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('user_books')
    .update({ started_at: startedAt, finished_at: finishedAt })
    .eq('id', userBookId);
  if (error) throw error;
}

export async function updateCurrentPage(userBookId: string, currentPage: number): Promise<void> {
  const { error } = await supabase
    .from('user_books')
    .update({ current_page: currentPage })
    .eq('id', userBookId);
  if (error) throw error;
}

export async function updateFormat(userBookId: string, format: BookFormat): Promise<void> {
  const { error } = await supabase
    .from('user_books')
    .update({ format })
    .eq('id', userBookId);
  if (error) throw error;
}

export async function updateProgressPercent(userBookId: string, percent: number): Promise<void> {
  const { error } = await supabase
    .from('user_books')
    .update({ progress_percent: Math.min(100, Math.max(0, percent)) })
    .eq('id', userBookId);
  if (error) throw error;
}

export async function rateBook(userBookId: string, rating: number, review?: string): Promise<void> {
  const { error } = await supabase
    .from('user_books')
    .update({ rating, review: review ?? null })
    .eq('id', userBookId);
  if (error) throw error;
}

export async function getShelf(userId: string, shelf: Shelf): Promise<UserBookWithBook[]> {
  const { data, error } = await supabase
    .from('user_books')
    .select(BOOK_SELECT)
    .eq('user_id', userId)
    .eq('shelf', shelf)
    .order('added_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as UserBookWithBook[];
}

export async function getCurrentBook(userId: string): Promise<UserBookWithBook | null> {
  const { data, error } = await supabase
    .from('user_books')
    .select(BOOK_SELECT)
    .eq('user_id', userId)
    .eq('shelf', 'reading')
    .order('added_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as UserBookWithBook | null;
}

export async function getUserBook(userId: string, bookId: string): Promise<UserBookWithBook | null> {
  const { data, error } = await supabase
    .from('user_books')
    .select(BOOK_SELECT)
    .eq('user_id', userId)
    .eq('book_id', bookId)
    .maybeSingle();
  if (error) throw error;
  return data as UserBookWithBook | null;
}
