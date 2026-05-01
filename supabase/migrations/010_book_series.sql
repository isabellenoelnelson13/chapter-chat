-- Add series metadata columns to books table
ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS series_id text,
  ADD COLUMN IF NOT EXISTS series_name text,
  ADD COLUMN IF NOT EXISTS series_position numeric;
