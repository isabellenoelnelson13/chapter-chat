import { supabase } from './supabase';
import { updateCurrentPage } from './userBooks';
import { Database } from '../types/database';

/** Marks a book as read on a given day without changing current page or progress. */
export async function createQuickLog(params: {
  userId: string;
  bookId: string;
  page: number;
  date: Date;
}): Promise<void> {
  const { userId, bookId, page, date } = params;
  const { error } = await (supabase.from('reading_sessions') as any).insert({
    user_id: userId,
    book_id: bookId,
    start_page: page,
    end_page: page,
    duration_seconds: 0,
    started_at: date.toISOString(),
  });
  if (error) throw error;
}

export type ReadingSession = Database['public']['Tables']['reading_sessions']['Row'];

export async function getReadingSessions(userId: string, bookId: string): Promise<ReadingSession[]> {
  const { data, error } = await (supabase.from('reading_sessions') as any)
    .select('*')
    .eq('user_id', userId)
    .eq('book_id', bookId)
    .order('started_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

type SessionInsert = Database['public']['Tables']['reading_sessions']['Insert'];

export async function createSession(params: {
  userId: string;
  bookId: string;
  userBookId: string;
  startPage: number;
  endPage: number;
  durationSeconds: number;
  startedAt: Date;
  skipProgressUpdate?: boolean;
}): Promise<void> {
  const { userId, bookId, userBookId, startPage, endPage, durationSeconds, startedAt, skipProgressUpdate } = params;

  const insert: SessionInsert = {
    user_id: userId,
    book_id: bookId,
    start_page: startPage,
    end_page: endPage,
    duration_seconds: durationSeconds,
    started_at: startedAt.toISOString(),
  };

  // reading_sessions has Update: never in database types, which causes TS2769
  // when chaining off .from(). The `as any` cast is intentional here.
  const { error } = await (supabase.from('reading_sessions') as any).insert(insert);
  if (error) throw error;

  if (!skipProgressUpdate) {
    await updateCurrentPage(userBookId, endPage);
  }
}

export async function updateSession(id: string, params: {
  startPage: number;
  endPage: number;
  durationSeconds: number;
  startedAt: Date;
}): Promise<void> {
  const { startPage, endPage, durationSeconds, startedAt } = params;
  const { error } = await (supabase.from('reading_sessions') as any)
    .update({ start_page: startPage, end_page: endPage, duration_seconds: durationSeconds, started_at: startedAt.toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteSession(id: string): Promise<void> {
  const { error } = await (supabase.from('reading_sessions') as any)
    .delete()
    .eq('id', id);
  if (error) throw error;
}
