import { supabase } from './supabase';

export interface ClubSummary {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  memberCount: number;
  currentBookTitle: string | null;
  currentBookCoverUrl: string | null;
}

export interface ClubMemberProgress {
  userId: string;
  username: string;
  role: 'owner' | 'member';
  currentPage: number;
  pageCount: number | null;
}

export interface ClubBook {
  id: string;
  bookId: string;
  bookTitle: string;
  bookCoverUrl: string | null;
  startedAt: string;
  endedAt: string | null;
}

export interface ClubDetail {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  currentBook: ClubBook | null;
  members: ClubMemberProgress[];
  history: ClubBook[];
}

export interface ClubPost {
  id: string;
  clubId: string;
  userId: string;
  username: string;
  body: string;
  parentId: string | null;
  replyCount: number;
  createdAt: string;
}

export async function getMyClubs(userId: string): Promise<ClubSummary[]> {
  const { data: memberships, error: membershipsError } = await supabase
    .from('club_members')
    .select('club_id, club:book_clubs(id, name, description, owner_id, members:club_members(count))')
    .eq('user_id', userId);
  if (membershipsError) throw membershipsError;

  const clubs = (memberships ?? []).map((m: any) => m.club).filter(Boolean);
  if (clubs.length === 0) return [];

  const clubIds = clubs.map((c: any) => c.id);

  const { data: currentBooks, error: cbError } = await supabase
    .from('club_books')
    .select('club_id, book:books(title, cover_url)')
    .in('club_id', clubIds)
    .is('ended_at', null);
  if (cbError) throw cbError;

  const currentBookMap = new Map(
    (currentBooks ?? []).map((cb: any) => [cb.club_id, cb.book])
  );

  return clubs.map((c: any) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    ownerId: c.owner_id,
    memberCount: c.members?.[0]?.count ?? 0,
    currentBookTitle: currentBookMap.get(c.id)?.title ?? null,
    currentBookCoverUrl: currentBookMap.get(c.id)?.cover_url ?? null,
  }));
}

export async function getClub(clubId: string): Promise<ClubDetail | null> {
  const { data: club, error: clubError } = await supabase
    .from('book_clubs')
    .select('id, name, description, owner_id')
    .eq('id', clubId)
    .maybeSingle();
  if (clubError) throw clubError;
  if (!club) return null;

  const { data: members, error: membersError } = await supabase
    .from('club_members')
    .select('user_id, role, user:profiles!user_id(username)')
    .eq('club_id', clubId);
  if (membersError) throw membersError;

  const { data: currentBookRow, error: cbError } = await supabase
    .from('club_books')
    .select('id, book_id, started_at, ended_at, book:books!book_id(title, cover_url, page_count)')
    .eq('club_id', clubId)
    .is('ended_at', null)
    .maybeSingle();
  if (cbError) throw cbError;

  const { data: historyRows, error: histError } = await supabase
    .from('club_books')
    .select('id, book_id, started_at, ended_at, book:books!book_id(title, cover_url)')
    .eq('club_id', clubId)
    .not('ended_at', 'is', null)
    .order('ended_at', { ascending: false });
  if (histError) throw histError;

  const memberIds = (members ?? []).map((m: any) => m.user_id);
  const progressMap = new Map<string, number>();
  if (currentBookRow && memberIds.length > 0) {
    const { data: userBooks, error: ubError } = await supabase
      .from('user_books')
      .select('user_id, current_page')
      .eq('book_id', (currentBookRow as any).book_id)
      .in('user_id', memberIds);
    if (ubError) throw ubError;
    (userBooks ?? []).forEach((ub: any) => progressMap.set(ub.user_id, ub.current_page));
  }

  const pageCount = (currentBookRow as any)?.book?.page_count ?? null;

  return {
    id: (club as any).id,
    name: (club as any).name,
    description: (club as any).description,
    ownerId: (club as any).owner_id,
    currentBook: currentBookRow
      ? {
          id: (currentBookRow as any).id,
          bookId: (currentBookRow as any).book_id,
          bookTitle: (currentBookRow as any).book.title,
          bookCoverUrl: (currentBookRow as any).book.cover_url,
          startedAt: (currentBookRow as any).started_at,
          endedAt: null,
        }
      : null,
    members: (members ?? []).map((m: any) => ({
      userId: m.user_id,
      username: m.user.username,
      role: m.role as 'owner' | 'member',
      currentPage: progressMap.get(m.user_id) ?? 0,
      pageCount,
    })),
    history: (historyRows ?? []).map((h: any) => ({
      id: h.id,
      bookId: h.book_id,
      bookTitle: h.book.title,
      bookCoverUrl: h.book.cover_url,
      startedAt: h.started_at,
      endedAt: h.ended_at,
    })),
  };
}

export async function createClub(
  userId: string,
  name: string,
  description?: string
): Promise<string> {
  const { data, error } = await supabase
    .from('book_clubs')
    .insert({ owner_id: userId, name, description: description ?? null })
    .select('id')
    .single();
  if (error) throw error;

  await supabase
    .from('club_members')
    .insert({ club_id: (data as any).id, user_id: userId, role: 'owner' });

  return (data as any).id;
}

export async function addMember(clubId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('club_members')
    .insert({ club_id: clubId, user_id: userId, role: 'member' });
  if (error) throw error;
}

export async function removeMember(clubId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('club_members')
    .delete()
    .eq('club_id', clubId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function setCurrentBook(
  clubId: string,
  bookId: string,
  addedBy: string
): Promise<void> {
  await supabase
    .from('club_books')
    .update({ ended_at: new Date().toISOString() })
    .eq('club_id', clubId)
    .is('ended_at', null);

  const { error } = await supabase
    .from('club_books')
    .insert({ club_id: clubId, book_id: bookId, added_by: addedBy });
  if (error) throw error;
}

export async function getPosts(clubId: string): Promise<ClubPost[]> {
  const { data, error } = await supabase
    .from('club_posts')
    .select(
      'id, club_id, user_id, body, parent_id, created_at, user:profiles!user_id(username), replies:club_posts!parent_id(count)'
    )
    .eq('club_id', clubId)
    .is('parent_id', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((p: any) => ({
    id: p.id,
    clubId: p.club_id,
    userId: p.user_id,
    username: p.user.username,
    body: p.body,
    parentId: null,
    replyCount: p.replies?.[0]?.count ?? 0,
    createdAt: p.created_at,
  }));
}

export async function getThread(
  postId: string
): Promise<{ parent: ClubPost; replies: ClubPost[] }> {
  const { data: parent, error: parentError } = await supabase
    .from('club_posts')
    .select('id, club_id, user_id, body, parent_id, created_at, user:profiles!user_id(username)')
    .eq('id', postId)
    .single();
  if (parentError) throw parentError;

  const { data: replies, error: repliesError } = await supabase
    .from('club_posts')
    .select('id, club_id, user_id, body, parent_id, created_at, user:profiles!user_id(username)')
    .eq('parent_id', postId)
    .order('created_at', { ascending: true });
  if (repliesError) throw repliesError;

  const mapPost = (p: any): ClubPost => ({
    id: p.id,
    clubId: p.club_id,
    userId: p.user_id,
    username: p.user.username,
    body: p.body,
    parentId: p.parent_id,
    replyCount: 0,
    createdAt: p.created_at,
  });

  return {
    parent: mapPost(parent),
    replies: (replies ?? []).map(mapPost),
  };
}

export async function addPost(
  clubId: string,
  userId: string,
  body: string,
  parentId?: string
): Promise<ClubPost> {
  const { data, error } = await supabase
    .from('club_posts')
    .insert({ club_id: clubId, user_id: userId, body, parent_id: parentId ?? null })
    .select('id, club_id, user_id, body, parent_id, created_at, user:profiles!user_id(username)')
    .single();
  if (error) throw error;
  return {
    id: (data as any).id,
    clubId: (data as any).club_id,
    userId: (data as any).user_id,
    username: (data as any).user.username,
    body: (data as any).body,
    parentId: (data as any).parent_id,
    replyCount: 0,
    createdAt: (data as any).created_at,
  };
}

export async function deletePost(postId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('club_posts')
    .delete()
    .eq('id', postId)
    .eq('user_id', userId);
  if (error) throw error;
}
