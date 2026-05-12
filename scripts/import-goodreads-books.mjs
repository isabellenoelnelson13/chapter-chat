/**
 * Enrich the books table with metadata from goodreads_books.json.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/import-goodreads-books.mjs
 *
 * Matches books by goodreads_id = book_id from the file.
 * Updates: rating, ratings_count, text_reviews_count, description (if empty),
 *          page_count (if null), cover_url (if null), genres (if empty),
 *          isbn, isbn13, publisher, publication_year.
 */

import { createClient } from '@supabase/supabase-js';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

const SUPABASE_URL = 'https://cztrxekjkilctlgrkgga.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FILE_PATH = 'C:/Users/isabe/Downloads/goodreads_books.json/goodreads_books.json';
const BATCH_CONCURRENCY = 20; // parallel updates per batch

// Shelf names that are reading-status tags, not genres
const SKIP_SHELVES = new Set([
  'to-read','currently-reading','read','owned','favorites','default','kindle',
  're-read','library','audiobook','audiobooks','ebook','ebooks','wish-list',
  'wishlist','borrowed','arc','bought','dnf','abandoned','did-not-finish',
  'unread','to-buy','bookshelf','collection','my-books','books-i-own',
  'owned-books','english','spanish','french','german','portuguese','italian',
  'p','w','m','s','n','e','f','b','r',
]);

function extractGenres(popularShelves) {
  if (!Array.isArray(popularShelves)) return [];
  return popularShelves
    .filter(s => {
      const name = s.name?.toLowerCase() ?? '';
      return (
        !SKIP_SHELVES.has(name) &&
        name.length >= 3 &&
        !/^\d+$/.test(name) &&
        parseInt(s.count, 10) >= 2
      );
    })
    .slice(0, 5)
    .map(s => s.name.charAt(0).toUpperCase() + s.name.slice(1).replace(/-/g, ' '));
}

if (!SERVICE_ROLE_KEY) {
  console.error('Set SUPABASE_SERVICE_ROLE_KEY env var');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ── 1. Load all books that have a goodreads_id ───────────────────────────────
console.log('Loading books from database...');
const { data: books, error: booksError } = await supabase
  .from('books')
  .select('id, goodreads_id, description, cover_url, genres, page_count')
  .not('goodreads_id', 'is', null);

if (booksError) { console.error(booksError); process.exit(1); }

const bookMap = new Map(books.map(b => [b.goodreads_id, b]));
console.log(`Found ${bookMap.size} books with a GoodReads ID.\n`);

if (bookMap.size === 0) {
  console.log('No books to update.');
  process.exit(0);
}

// ── 2. Stream the file and collect updates ───────────────────────────────────
let linesRead = 0;
let matched = 0;
const updates = []; // { id, payload }

const rl = createInterface({
  input: createReadStream(FILE_PATH, { encoding: 'utf8' }),
  crlfDelay: Infinity,
});

for await (const line of rl) {
  linesRead++;
  if (linesRead % 500_000 === 0) {
    process.stdout.write(`  ${(linesRead / 1_000_000).toFixed(1)}M lines read | matched: ${matched}\n`);
  }
  if (!line.trim()) continue;

  let row;
  try { row = JSON.parse(line); } catch { continue; }

  const book = bookMap.get(String(row.book_id));
  if (!book) continue;

  matched++;

  const avgRating = parseFloat(row.average_rating);
  const genres = extractGenres(row.popular_shelves);

  const payload = {
    rating:               isNaN(avgRating) ? undefined : avgRating,
    ratings_count:        parseInt(row.ratings_count, 10) || undefined,
    text_reviews_count:   parseInt(row.text_reviews_count, 10) || undefined,
    isbn:                 row.isbn || undefined,
    isbn13:               row.isbn13 || undefined,
    publisher:            row.publisher || undefined,
    publication_year:     parseInt(row.publication_year, 10) || undefined,
    // Only fill in blanks — don't overwrite richer data already in the DB
    description:          (!book.description && row.description) ? row.description : undefined,
    cover_url:            (!book.cover_url && row.image_url)     ? row.image_url  : undefined,
    page_count:           (!book.page_count && row.num_pages)    ? parseInt(row.num_pages, 10) || undefined : undefined,
    genres:               (!book.genres?.length && genres.length) ? genres : undefined,
  };

  // Drop undefined keys
  const clean = Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== undefined));
  if (Object.keys(clean).length > 0) {
    updates.push({ id: book.id, payload: clean });
  }
}

console.log(`\nScanned ${linesRead.toLocaleString()} lines | ${matched} matched | ${updates.length} to update\n`);

// ── 3. Apply updates in parallel batches ────────────────────────────────────
let updated = 0;
let errors = 0;

for (let i = 0; i < updates.length; i += BATCH_CONCURRENCY) {
  const batch = updates.slice(i, i + BATCH_CONCURRENCY);
  await Promise.all(
    batch.map(async ({ id, payload }) => {
      const { error } = await supabase.from('books').update(payload).eq('id', id);
      if (error) { errors++; console.error(`  Error updating ${id}:`, error.message); }
      else updated++;
    })
  );
  if ((i + BATCH_CONCURRENCY) % 200 === 0) {
    process.stdout.write(`  Updated ${updated} / ${updates.length}\n`);
  }
}

console.log(`\nDone.`);
console.log(`  Updated: ${updated}`);
console.log(`  Errors:  ${errors}`);
