-- supabase/migrations/012_authors_and_reviews.sql

-- ============================================================
-- AUTHORS
-- ============================================================
CREATE TABLE public.authors (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goodreads_author_id  text UNIQUE NOT NULL,
  name                 text NOT NULL,
  bio                  text,
  photo_url            text,
  born_date            text,
  website              text,
  created_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.authors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authors are viewable by all authenticated users"
  ON public.authors FOR SELECT
  USING (auth.role() = 'authenticated');

-- ============================================================
-- BOOKS — add loose FK to authors
-- ============================================================
ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS goodreads_author_id text
  REFERENCES public.authors(goodreads_author_id);

-- ============================================================
-- BOOK_REVIEWS (seeded from GoodReads — not user reviews)
-- ============================================================
CREATE TABLE public.book_reviews (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id              uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  goodreads_review_id  text UNIQUE,
  reviewer_name        text,
  rating               numeric(2,1),
  body                 text,
  date_added           date,
  helpful_votes        int DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.book_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Book reviews are viewable by all authenticated users"
  ON public.book_reviews FOR SELECT
  USING (auth.role() = 'authenticated');
