ALTER TABLE public.user_books
  ADD COLUMN IF NOT EXISTS format text NOT NULL DEFAULT 'physical'
  CHECK (format IN ('physical', 'ebook', 'audiobook'));

ALTER TABLE public.user_books
  ADD COLUMN IF NOT EXISTS progress_percent NUMERIC(5,2);
