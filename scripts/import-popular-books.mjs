/**
 * Import popular books from goodreads_books.json to expand the recommendation pool.
 *
 * Only imports books that:
 *   - Have ratings_count >= MIN_RATINGS (default 1000)
 *   - Have genre data available
 *   - Don't already exist in the database
 *
 * Stops once IMPORT_LIMIT books have been inserted.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/import-popular-books.mjs
 *   SUPABASE_SERVICE_ROLE_KEY=<key> MIN_RATINGS=5000 IMPORT_LIMIT=20000 node scripts/import-popular-books.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

const SUPABASE_URL    = 'https://cztrxekjkilctlgrkgga.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BOOKS_PATH      = 'C:/Users/isabe/Downloads/goodreads_books.json/goodreads_books.json';
const MIN_RATINGS     = parseInt(process.env.MIN_RATINGS  ?? '1000', 10);
const IMPORT_LIMIT    = parseInt(process.env.IMPORT_LIMIT ?? '10000', 10);

const SKIP_SHELVES = new Set([
  'to-read','currently-reading','read','owned','favorites','default','kindle',
  're-read','library','audiobook','audiobooks','ebook','ebooks','wish-list',
  'wishlist','borrowed','arc','bought','dnf','abandoned','unread','to-buy',
  'bookshelf','collection','my-books','books-i-own','owned-books','english',
]);

if (!SERVICE_ROLE_KEY) { console.error('Set SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

function extractGenres(popularShelves) {
  if (!Array.isArray(popularShelves)) return [];
  return popularShelves
    .filter(s => {
      const n = s.name?.toLowerCase() ?? '';
      return !SKIP_SHELVES.has(n) && n.length >= 3 && !/^\d+$/.test(n) && parseInt(s.count, 10) >= 2;
    })
    .slice(0, 5)
    .map(s => s.name.charAt(0).toUpperCase() + s.name.slice(1).replace(/-/g, ' '));
}

// ── 1. Load existing goodreads_ids to avoid duplicates ───────────────────────
console.log('Loading existing books...');
const { data: existing } = await supabase.from('books').select('goodreads_id').not('goodreads_id', 'is', null);
const existingIds = new Set(existing.map(b => b.goodreads_id));
console.log(`${existingIds.size} books already in database.\n`);
console.log(`Importing up to ${IMPORT_LIMIT.toLocaleString()} books with >= ${MIN_RATINGS.toLocaleString()} ratings.\n`);

// ── 2. Stream goodreads_books.json ───────────────────────────────────────────
let linesRead = 0, inserted = 0, errors = 0;
let batch = [];

async function flushBatch() {
  if (batch.length === 0) return;
  const { error } = await supabase.from('books').upsert(batch, { onConflict: 'goodreads_id', ignoreDuplicates: true });
  if (error) { console.error('Batch error:', error.message); errors += batch.length; }
  else inserted += batch.length;
  batch = [];
}

const rl = createInterface({
  input: createReadStream(BOOKS_PATH, { encoding: 'utf8' }),
  crlfDelay: Infinity,
});

for await (const line of rl) {
  if (inserted >= IMPORT_LIMIT) break;
  if (++linesRead % 500_000 === 0) {
    process.stdout.write(`  ${(linesRead/1e6).toFixed(1)}M scanned | inserted: ${inserted}\n`);
  }
  if (!line.trim()) continue;

  let row; try { row = JSON.parse(line); } catch { continue; }

  const grId = String(row.book_id);
  if (existingIds.has(grId)) continue;

  const ratingsCount = parseInt(row.ratings_count, 10) || 0;
  if (ratingsCount < MIN_RATINGS) continue;

  const genres = extractGenres(row.popular_shelves);
  if (genres.length === 0) continue; // skip books with no genre info

  // Get primary author name from authors field (we only have IDs, not names here)
  // We'll use the book's title_without_series as a fallback and fill author later
  const avgRating = parseFloat(row.average_rating) || null;

  batch.push({
    goodreads_id:        grId,
    title:               row.title_without_series ?? row.title,
    author:              row.authors?.[0] ? `Author ${row.authors[0].author_id}` : 'Unknown',
    cover_url:           row.image_url?.replace(/\/[a-z]\//, '/l/') ?? null,
    description:         row.description?.trim() || null,
    page_count:          parseInt(row.num_pages, 10) || null,
    genres,
    rating:              avgRating,
    ratings_count:       ratingsCount,
    text_reviews_count:  parseInt(row.text_reviews_count, 10) || null,
    isbn:                row.isbn || null,
    isbn13:              row.isbn13 || null,
    publication_year:    parseInt(row.publication_year, 10) || null,
    publisher:           row.publisher || null,
    // goodreads_author_id set separately by import-authors.mjs after authors table is populated
  });

  existingIds.add(grId);

  if (batch.length >= 100) await flushBatch();
}

await flushBatch();

console.log(`\nDone.`);
console.log(`  Scanned:  ${linesRead.toLocaleString()}`);
console.log(`  Inserted: ${inserted.toLocaleString()}`);
console.log(`  Errors:   ${errors}`);
console.log(`\nNext: run import-authors.mjs to fill in real author names.`);
