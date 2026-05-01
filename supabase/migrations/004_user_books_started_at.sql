alter table public.user_books
  add column if not exists started_at timestamptz;
