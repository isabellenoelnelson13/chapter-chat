ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS goodreads_id text;

CREATE UNIQUE INDEX IF NOT EXISTS books_goodreads_id_key
  ON public.books (goodreads_id)
  WHERE goodreads_id IS NOT NULL;
