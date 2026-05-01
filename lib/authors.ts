import { supabase } from './supabase';
import { Database } from '@/types/database';

export type Author = Database['public']['Tables']['authors']['Row'];
export type AuthorBook = Database['public']['Tables']['books']['Row'];

export async function getAuthor(goodreadsAuthorId: string): Promise<Author | null> {
  const { data, error } = await supabase
    .from('authors')
    .select('*')
    .eq('goodreads_author_id', goodreadsAuthorId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getAuthorBooks(goodreadsAuthorId: string): Promise<AuthorBook[]> {
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .eq('goodreads_author_id', goodreadsAuthorId)
    .order('users_read_count', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
