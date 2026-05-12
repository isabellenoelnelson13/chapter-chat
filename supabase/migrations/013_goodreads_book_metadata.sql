-- Add GoodReads metadata columns to books table
ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS ratings_count       integer,
  ADD COLUMN IF NOT EXISTS text_reviews_count  integer,
  ADD COLUMN IF NOT EXISTS isbn                text,
  ADD COLUMN IF NOT EXISTS isbn13              text,
  ADD COLUMN IF NOT EXISTS publisher           text,
  ADD COLUMN IF NOT EXISTS publication_year    integer;
