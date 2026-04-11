import { supabase } from './supabase';
import { Shelf, Database } from '../types/database';

type BookRow = Database['public']['Tables']['books']['Row'];

export interface UserBookWithBook {
  id: string;
  user_id: string;
  book_id: string;
  shelf: Shelf;
  current_page: number;
  rating: number | null;
  review: string | null;
  added_at: string;
  finished_at: string | null;
  book: Pick<BookRow, 'id' | 'title' | 'author' | 'cover_url' | 'page_count'> & {
    description: string | null;
  };
}

const BOOK_SELECT = '*, book:books(id, title, author, cover_url, page_count, description)';

export async function addToShelf(userId: string, bookId: string, shelf: Shelf): Promise<string> {
  const { data, error } = await supabase
    .from('user_books')
    .insert({ user_id: userId, book_id: bookId, shelf, current_page: 0 })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function moveShelf(userBookId: string, shelf: Shelf, finishedAt?: string): Promise<void> {
  const update: Record<string, unknown> = { shelf };
  if (shelf === 'read') update.finished_at = finishedAt ?? new Date().toISOString();
  const { error } = await supabase
    .from('user_books')
    .update(update)
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
