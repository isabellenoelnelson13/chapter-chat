import { supabase } from './supabase';
import { updateCurrentPage } from './userBooks';
import { Database } from '../types/database';

type SessionInsert = Database['public']['Tables']['reading_sessions']['Insert'];

export async function createSession(params: {
  userId: string;
  bookId: string;
  userBookId: string;
  startPage: number;
  endPage: number;
  durationSeconds: number;
  startedAt: Date;
}): Promise<void> {
  const { userId, bookId, userBookId, startPage, endPage, durationSeconds, startedAt } = params;

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

  await updateCurrentPage(userBookId, endPage);
}
