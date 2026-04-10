-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique not null,
  avatar_url text,
  bio text,
  is_private boolean not null default false,
  yearly_goal integer not null default 52,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by everyone"
  on public.profiles for select
  using (not is_private or auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, username)
  values (new.id, new.raw_user_meta_data->>'username');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- BOOKS
-- ============================================================
create table public.books (
  id uuid primary key default gen_random_uuid(),
  google_books_id text unique,
  title text not null,
  author text not null,
  cover_url text,
  page_count integer,
  genres text[],
  created_at timestamptz not null default now()
);

alter table public.books enable row level security;

create policy "Books are viewable by all authenticated users"
  on public.books for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert books"
  on public.books for insert
  with check (auth.role() = 'authenticated');

-- ============================================================
-- USER_BOOKS (shelves)
-- ============================================================
create table public.user_books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  shelf text not null check (shelf in ('reading', 'want', 'read', 'dnf')),
  current_page integer not null default 0,
  rating integer check (rating between 1 and 5),
  review text,
  added_at timestamptz not null default now(),
  finished_at timestamptz,
  unique(user_id, book_id)
);

alter table public.user_books enable row level security;

create policy "Users can view their own shelves"
  on public.user_books for select
  using (auth.uid() = user_id);

create policy "Users can manage their own shelves"
  on public.user_books for all
  using (auth.uid() = user_id);

-- ============================================================
-- READING_SESSIONS
-- ============================================================
create table public.reading_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  start_page integer not null,
  end_page integer not null,
  duration_seconds integer not null,
  started_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.reading_sessions enable row level security;

create policy "Users can view their own sessions"
  on public.reading_sessions for select
  using (auth.uid() = user_id);

create policy "Users can manage their own sessions"
  on public.reading_sessions for all
  using (auth.uid() = user_id);

-- ============================================================
-- FOLLOWS
-- ============================================================
create table public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id)
);

alter table public.follows enable row level security;

create policy "Follows are viewable by authenticated users"
  on public.follows for select
  using (auth.role() = 'authenticated');

create policy "Users can manage their own follows"
  on public.follows for all
  using (auth.uid() = follower_id);

-- ============================================================
-- BOOK_CLUBS
-- ============================================================
create table public.book_clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  current_book_id uuid references public.books(id),
  created_at timestamptz not null default now()
);

alter table public.book_clubs enable row level security;

create policy "Book clubs are viewable by authenticated users"
  on public.book_clubs for select
  using (auth.role() = 'authenticated');

create policy "Owners can manage their clubs"
  on public.book_clubs for all
  using (auth.uid() = owner_id);

-- ============================================================
-- CLUB_MEMBERS
-- ============================================================
create table public.club_members (
  club_id uuid not null references public.book_clubs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'member')) default 'member',
  joined_at timestamptz not null default now(),
  primary key (club_id, user_id)
);

alter table public.club_members enable row level security;

create policy "Club members are viewable by authenticated users"
  on public.club_members for select
  using (auth.role() = 'authenticated');

create policy "Users can manage their own membership"
  on public.club_members for all
  using (auth.uid() = user_id);

-- ============================================================
-- CLUB_POSTS
-- ============================================================
create table public.club_posts (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.book_clubs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  parent_id uuid references public.club_posts(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.club_posts enable row level security;

create policy "Posts viewable by authenticated users"
  on public.club_posts for select
  using (auth.role() = 'authenticated');

create policy "Users can manage their own posts"
  on public.club_posts for all
  using (auth.uid() = user_id);

-- ============================================================
-- CHALLENGES
-- ============================================================
create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  goal integer not null,
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now()
);

alter table public.challenges enable row level security;

create policy "Challenges viewable by authenticated users"
  on public.challenges for select
  using (auth.role() = 'authenticated');

create policy "Creators can manage their challenges"
  on public.challenges for all
  using (auth.uid() = creator_id);

-- ============================================================
-- CHALLENGE_MEMBERS
-- ============================================================
create table public.challenge_members (
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  progress integer not null default 0,
  joined_at timestamptz not null default now(),
  primary key (challenge_id, user_id)
);

alter table public.challenge_members enable row level security;

create policy "Challenge members viewable by authenticated users"
  on public.challenge_members for select
  using (auth.role() = 'authenticated');

create policy "Users can manage their own challenge membership"
  on public.challenge_members for all
  using (auth.uid() = user_id);

-- ============================================================
-- MESSAGES
-- ============================================================
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  sent_at timestamptz not null default now(),
  read_at timestamptz
);

alter table public.messages enable row level security;

create policy "Users can view their own messages"
  on public.messages for select
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

create policy "Users can send messages"
  on public.messages for insert
  with check (auth.uid() = sender_id);
