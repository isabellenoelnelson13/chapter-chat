import { supabase } from './supabase';

export interface TodayStats {
  pagesRead: number;
  timeSeconds: number;
  streak: number;
}

function startOfDay(date: Date = new Date()): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function startOfNextDay(date: Date = new Date()): string {
  const d = new Date(date);
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function getTodayStats(userId: string): Promise<TodayStats> {
  const { data, error } = await supabase
    .from('reading_sessions')
    .select('start_page, end_page, duration_seconds, started_at')
    .eq('user_id', userId)
    .gte('started_at', startOfDay())
    .lt('started_at', startOfNextDay());
  if (error) throw error;

  const sessions = data ?? [];
  const pagesRead = sessions.reduce((sum, s) => sum + (s.end_page - s.start_page), 0);
  const timeSeconds = sessions.reduce((sum, s) => sum + s.duration_seconds, 0);
  const streak = await getStreak(userId);
  return { pagesRead, timeSeconds, streak };
}

export async function getStreak(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('reading_sessions')
    .select('started_at')
    .eq('user_id', userId)
    .order('started_at', { ascending: false });
  if (error) throw error;
  if (!data || data.length === 0) return 0;

  const uniqueDays = Array.from(
    new Set(data.map((s) => s.started_at.slice(0, 10)))
  ).sort().reverse();

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  if (uniqueDays[0] !== today && uniqueDays[0] !== yesterday) return 0;

  let streak = 0;
  let expected = uniqueDays[0];

  for (const day of uniqueDays) {
    if (day === expected) {
      streak++;
      const d = new Date(expected);
      d.setDate(d.getDate() - 1);
      expected = d.toISOString().slice(0, 10);
    } else {
      break;
    }
  }

  return streak;
}

export function estimateDaysRemaining(
  pagesPerDay: number,
  currentPage: number,
  pageCount: number
): number | null {
  if (pagesPerDay <= 0) return null;
  const remaining = pageCount - currentPage;
  if (remaining <= 0) return 0;
  return Math.ceil(remaining / pagesPerDay);
}
