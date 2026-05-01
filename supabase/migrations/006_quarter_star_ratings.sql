-- Change user_books.rating from integer to numeric to support quarter-star ratings
ALTER TABLE public.user_books
  ALTER COLUMN rating TYPE NUMERIC(3,2) USING rating::NUMERIC(3,2);

-- Drop the old integer check constraint (auto-named by Postgres)
ALTER TABLE public.user_books
  DROP CONSTRAINT IF EXISTS user_books_rating_check;

-- New constraint: 0.25–5.00 range
ALTER TABLE public.user_books
  ADD CONSTRAINT user_books_rating_check
  CHECK (rating IS NULL OR (rating >= 0.25 AND rating <= 5.00));
