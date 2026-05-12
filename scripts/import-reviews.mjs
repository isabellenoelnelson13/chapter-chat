/**
 * Import GoodReads reviews from a JSONL file into the book_reviews table.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/import-reviews.mjs <path-to-jsonl>
 *
 * Only reviews whose book_id matches a goodreads_id in the books table are imported.
 * Skips: rating 0, empty review_text, duplicates (goodreads_review_id is UNIQUE).
 * Caps at MAX_PER_BOOK reviews per book to keep the dataset focused.
 */

import { createClient } from '@supabase/supabase-js';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

const SUPABASE_URL = 'https://cztrxekjkilctlgrkgga.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FILE_PATH = process.argv[2] ?? 'C:/Users/isabe/Downloads/goodreads_reviews_dedup.json/goodreads_reviews_dedup.json';
const BATCH_SIZE = 200;
const MAX_PER_BOOK = 10; // max reviews to import per book

if (!SERVICE_ROLE_KEY) {
  console.error('Set SUPABASE_SERVICE_ROLE_KEY env var (Project Settings → API → service_role)');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ── 1. Load all books that have a goodreads_id ───────────────────────────────
console.log('Loading books from database...');
const { data: books, error: booksError } = await supabase
  .from('books')
  .select('id, goodreads_id')
  .not('goodreads_id', 'is', null);

if (booksError) { console.error(booksError); process.exit(1); }

// Map goodreads_id (string) → internal book UUID
const bookMap = new Map(books.map(b => [b.goodreads_id, b.id]));
console.log(`Found ${bookMap.size} books with a GoodReads ID.\n`);

if (bookMap.size === 0) {
  console.log('No books have goodreads_id set — nothing to import.');
  process.exit(0);
}

// ── 2. Stream the JSONL file ─────────────────────────────────────────────────
function parseDate(str) {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
}

let linesRead = 0;
let matched = 0;
let inserted = 0;
let skipped = 0;
const perBookCount = new Map(); // goodreads_id → count already queued/inserted
let batch = [];

async function flushBatch() {
  if (batch.length === 0) return;
  const { error } = await supabase.from('book_reviews').upsert(batch, {
    onConflict: 'goodreads_review_id',
    ignoreDuplicates: true,
  });
  if (error) console.error('Batch error:', error.message);
  else inserted += batch.length;
  batch = [];
}

const rl = createInterface({
  input: createReadStream(FILE_PATH, { encoding: 'utf8' }),
  crlfDelay: Infinity,
});

for await (const line of rl) {
  linesRead++;

  if (linesRead % 500_000 === 0) {
    process.stdout.write(`  ${(linesRead / 1_000_000).toFixed(1)}M lines read | matched: ${matched} | inserted: ${inserted}\n`);
  }

  if (!line.trim()) continue;

  let row;
  try { row = JSON.parse(line); } catch { continue; }

  const bookId = bookMap.get(String(row.book_id));
  if (!bookId) continue;                         // book not in our DB
  if (!row.review_text?.trim()) continue;        // no review text
  if (!row.rating || row.rating < 1) continue;  // rating 0 or missing

  const count = perBookCount.get(row.book_id) ?? 0;
  if (count >= MAX_PER_BOOK) continue;           // already have enough for this book
  perBookCount.set(row.book_id, count + 1);

  matched++;
  batch.push({
    book_id: bookId,
    goodreads_review_id: row.review_id ?? null,
    reviewer_name: null,          // dataset has user_id, not a display name
    rating: Math.min(5, Math.max(1, row.rating)),
    body: row.review_text.trim(),
    date_added: parseDate(row.date_added),
    helpful_votes: row.n_votes ?? 0,
  });

  if (batch.length >= BATCH_SIZE) await flushBatch();
}

await flushBatch();

console.log(`\nDone.`);
console.log(`  Lines read:  ${linesRead.toLocaleString()}`);
console.log(`  Matched:     ${matched.toLocaleString()}`);
console.log(`  Inserted:    ${inserted.toLocaleString()}`);
console.log(`  Skipped:     ${(linesRead - matched).toLocaleString()}`);
