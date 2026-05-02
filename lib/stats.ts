import { supabase } from './supabase';

export interface TodayStats {
  pagesRead: number;
  timeSeconds: number;
  streak: number;
}

function startOfDay(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

function startOfNextDay(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString();
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
      // Step back one UTC day using UTC arithmetic to avoid DST/timezone issues
      const d = new Date(expected + 'T00:00:00.000Z');
      d.setUTCDate(d.getUTCDate() - 1);
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

export interface DailyReading {
  date: string;
  pages: number;
}

export async function getReadingHistory(userId: string, days: number): Promise<DailyReading[]> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days + 1);
  since.setUTCHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('reading_sessions')
    .select('start_page, end_page, started_at')
    .eq('user_id', userId)
    .gte('started_at', since.toISOString())
    .order('started_at', { ascending: true });
  if (error) throw error;

  const map: Record<string, number> = {};
  for (const session of data ?? []) {
    const date = session.started_at.slice(0, 10);
    map[date] = (map[date] ?? 0) + (session.end_page - session.start_page);
  }

  const result: DailyReading[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setUTCDate(d.getUTCDate() + i);
    const date = d.toISOString().slice(0, 10);
    result.push({ date, pages: map[date] ?? 0 });
  }
  return result;
}

export interface MonthlyBooks {
  month: string;
  count: number;
}

export async function getMonthlyBooks(userId: string, year: number): Promise<MonthlyBooks[]> {
  const yearStart = `${year}-01-01T00:00:00.000Z`;
  const yearEnd = `${year + 1}-01-01T00:00:00.000Z`;

  const { data, error } = await supabase
    .from('user_books')
    .select('finished_at')
    .eq('user_id', userId)
    .eq('shelf', 'read')
    .gte('finished_at', yearStart)
    .lt('finished_at', yearEnd);
  if (error) throw error;

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const counts: number[] = new Array(12).fill(0);
  for (const row of data ?? []) {
    if (row.finished_at) {
      counts[new Date(row.finished_at).getUTCMonth()]++;
    }
  }
  return MONTHS.map((month, i) => ({ month, count: counts[i] }));
}

export interface GenreCount {
  genre: string;
  count: number;
}

export async function getGenreBreakdown(userId: string): Promise<GenreCount[]> {
  const { data, error } = await supabase
    .from('user_books')
    .select('book:books(genres)')
    .eq('user_id', userId)
    .eq('shelf', 'read');
  if (error) throw error;

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const genre = (row.book as any)?.genres?.[0];
    if (genre) counts[genre] = (counts[genre] ?? 0) + 1;
  }
  return Object.entries(counts)
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count);
}

export interface YearlyReadingStats {
  totalPages: number;
  totalHours: number;
  totalSessions: number;
  avgPagesPerSession: number;
}

export async function getYearlyReadingStats(userId: string): Promise<YearlyReadingStats> {
  const year = new Date().getFullYear();
  const yearStart = `${year}-01-01T00:00:00.000Z`;
  const yearEnd = `${year + 1}-01-01T00:00:00.000Z`;

  const { data, error } = await supabase
    .from('reading_sessions')
    .select('start_page, end_page, duration_seconds')
    .eq('user_id', userId)
    .gte('started_at', yearStart)
    .lt('started_at', yearEnd);
  if (error) throw error;

  const sessions = data ?? [];
  const totalPages = sessions.reduce((sum, s) => sum + (s.end_page - s.start_page), 0);
  const totalSeconds = sessions.reduce((sum, s) => sum + s.duration_seconds, 0);
  const totalSessions = sessions.length;
  return {
    totalPages,
    totalHours: Math.round(totalSeconds / 3600 * 10) / 10,
    totalSessions,
    avgPagesPerSession: totalSessions > 0 ? Math.round(totalPages / totalSessions) : 0,
  };
}

export async function getReadingByDayOfWeek(userId: string): Promise<{ day: string; pages: number }[]> {
  const { data, error } = await supabase
    .from('reading_sessions')
    .select('start_page, end_page, started_at')
    .eq('user_id', userId);
  if (error) throw error;

  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const totals = new Array(7).fill(0);
  const counts = new Array(7).fill(0);

  for (const s of data ?? []) {
    const dow = new Date(s.started_at).getDay();
    totals[dow] += s.end_page - s.start_page;
    counts[dow]++;
  }

  return DAY_NAMES.map((day, i) => ({
    day,
    pages: counts[i] > 0 ? Math.round(totals[i] / counts[i]) : 0,
  }));
}

export interface RatingStats {
  average: number;
  distribution: { stars: number; count: number }[];
  totalRated: number;
}

export async function getRatingStats(userId: string): Promise<RatingStats> {
  const { data, error } = await supabase
    .from('user_books')
    .select('rating')
    .eq('user_id', userId)
    .not('rating', 'is', null);
  if (error) throw error;

  const ratings = (data ?? []).map(r => r.rating as number);
  const distribution = [1, 2, 3, 4, 5].map(stars => ({
    stars,
    count: ratings.filter(r => Math.max(1, Math.min(5, Math.round(r))) === stars).length,
  }));
  const average = ratings.length > 0
    ? Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 10) / 10
    : 0;
  return { average, distribution, totalRated: ratings.length };
}

export async function getWeeklyPace(userId: string): Promise<number> {
  const history = await getReadingHistory(userId, 7);
  const total = history.reduce((sum, d) => sum + d.pages, 0);
  return Math.round(total / 7);
}

export interface YearlyGoalProgress {
  booksRead: number;
  goal: number;
}

export async function getYearlyGoalProgress(userId: string): Promise<YearlyGoalProgress> {
  const year = new Date().getFullYear();
  const yearStart = `${year}-01-01T00:00:00.000Z`;
  const yearEnd = `${year + 1}-01-01T00:00:00.000Z`;

  const { data: books, error: booksError } = await supabase
    .from('user_books')
    .select('id')
    .eq('user_id', userId)
    .eq('shelf', 'read')
    .gte('finished_at', yearStart)
    .lt('finished_at', yearEnd);
  if (booksError) throw booksError;

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('yearly_goal')
    .eq('id', userId)
    .single();
  if (profileError) throw profileError;

  return {
    booksRead: books?.length ?? 0,
    goal: profile?.yearly_goal ?? 0,
  };
}
