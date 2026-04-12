-- Rename column
ALTER TABLE books RENAME COLUMN google_books_id TO hardcover_id;

-- Drop old unique constraint and add new one on renamed column
ALTER TABLE books DROP CONSTRAINT IF EXISTS books_google_books_id_key;
ALTER TABLE books ADD CONSTRAINT books_hardcover_id_key UNIQUE (hardcover_id);
