/**
 * Import GoodReads reviews into Supabase.
 *
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_KEY=eyJ... \
 *   node scripts/import-goodreads-reviews.mjs /path/to/reviews.json
 *
 * Streams the full reviews file (can be 50M+ lines). Keeps top 10 reviews
 * per book by helpful_votes. Recomputes books.rating and books.users_read_count
 * from the aggregated data.
 */

import fs from 'fs';
import readline from 'readline';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const FILE_PATH = process.argv[2];
const BATCH_SIZE = 100;
const DELAY_MS = 200;
const MAX_REVIEWS_PER_BOOK = 10;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables.');
  process.exit(1);
}
if (!FILE_PATH) {
  console.error('Usage: node scripts/import-goodreads-reviews.mjs /path/to/reviews.json');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/** Load goodreads_id → { id (uuid) } for all seeded books. */
async function loadBookMap() {
  const map = new Map();
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('books')
      .select('id, goodreads_id')
      .not('goodreads_id', 'is', null)
      .range(from, from + PAGE - 1);
    if (error) { console.warn('Could not load book map:', error.message); break; }
    if (!data || data.length === 0) break;
    for (const row of data) map.set(row.goodreads_id, row.id);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  console.log(`Loaded ${map.size.toLocaleString()} books into memory.`);
  return map;
}

/**
 * Add a raw review record to the in-memory accumulator.
 * acc: goodreadsBookId → { totalRating, count, top10[] }
 */
function addToAccumulator(acc, goodreadsBookId, raw) {
  let entry = acc.get(goodreadsBookId);
  if (!entry) {
    entry = { totalRating: 0, count: 0, top10: [] };
    acc.set(goodreadsBookId, entry);
  }

  const rating = parseFloat(raw.rating);
  if (!isNaN(rating) && rating > 0) {
    entry.totalRating += rating;
    entry.count += 1;
  }

  const body = raw.review_text?.trim();
  if (body && raw.review_id) {
    const helpful = parseInt(raw.n_votes ?? raw.helpful_votes ?? '0', 10) || 0;
    entry.top10.push({
      goodreads_review_id: String(raw.review_id),
      reviewer_name: raw.user_id ? `user_${raw.user_id}` : null,
      rating: isNaN(rating) ? null : Math.round(rating * 10) / 10,
      body: body.slice(0, 2000),
      date_added: raw.date_updated ? (() => { const d = new Date(raw.date_updated); return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0]; })() : null,
      helpful_votes: helpful,
    });
    // Keep only top MAX_REVIEWS_PER_BOOK by helpful_votes
    if (entry.top10.length > MAX_REVIEWS_PER_BOOK * 2) {
      entry.top10.sort((a, b) => b.helpful_votes - a.helpful_votes);
      entry.top10.length = MAX_REVIEWS_PER_BOOK;
    }
  }
}

async function flushReviews(batch) {
  const { error } = await supabase
    .from('book_reviews')
    .upsert(batch, { onConflict: 'goodreads_review_id', ignoreDuplicates: false });
  if (error) { console.error('Review upsert error:', error.message); return false; }
  return true;
}

async function run() {
  console.log('Loading existing books...');
  const bookMap = await loadBookMap();

  console.log(`Streaming reviews: ${FILE_PATH}`);
  const rl = readline.createInterface({
    input: fs.createReadStream(FILE_PATH, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  const acc = new Map(); // goodreadsBookId → { totalRating, count, top10 }
  let lineNum = 0, skipped = 0;

  for await (const line of rl) {
    lineNum++;
    if (lineNum % 1_000_000 === 0) {
      console.log(`  processed ${lineNum.toLocaleString()} lines, ${acc.size.toLocaleString()} books accumulated...`);
    }

    const trimmed = line.trim();
    if (!trimmed || trimmed === '[' || trimmed === ']') continue;
    const jsonStr = trimmed.endsWith(',') ? trimmed.slice(0, -1) : trimmed;

    let raw;
    try { raw = JSON.parse(jsonStr); }
    catch { skipped++; continue; }

    const goodreadsBookId = raw.book_id ? String(raw.book_id) : null;
    if (!goodreadsBookId || !bookMap.has(goodreadsBookId)) { skipped++; continue; }

    addToAccumulator(acc, goodreadsBookId, raw);
  }

  console.log(`\nStreaming complete. ${acc.size.toLocaleString()} books with review data.`);
  console.log('Writing reviews and updating book stats...');

  let reviewBatch = [];
  let bookUpdateBatch = [];
  let reviewsWritten = 0, reviewsFailed = 0, booksUpdated = 0, hadError = false;

  for (const [goodreadsBookId, entry] of acc) {
    const bookUuid = bookMap.get(goodreadsBookId);
    if (!bookUuid) continue;

    // Sort and trim top10 to final list
    entry.top10.sort((a, b) => b.helpful_votes - a.helpful_votes);
    entry.top10.length = Math.min(entry.top10.length, MAX_REVIEWS_PER_BOOK);

    // Queue reviews
    for (const review of entry.top10) {
      reviewBatch.push({ ...review, book_id: bookUuid });
    }

    // Collect book stat update
    const newRating = entry.count > 0
      ? Math.round((entry.totalRating / entry.count) * 100) / 100
      : null;
    bookUpdateBatch.push({ id: bookUuid, rating: newRating, users_read_count: entry.count });

    if (reviewBatch.length >= BATCH_SIZE) {
      const ok = await flushReviews(reviewBatch);
      if (ok) { reviewsWritten += reviewBatch.length; } else { reviewsFailed += reviewBatch.length; hadError = true; }
      reviewBatch = [];
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  if (reviewBatch.length > 0) {
    const ok = await flushReviews(reviewBatch);
    if (ok) { reviewsWritten += reviewBatch.length; } else { reviewsFailed += reviewBatch.length; hadError = true; }
  }

  // Flush book stat updates
  for (let i = 0; i < bookUpdateBatch.length; i++) {
    const { id, rating, users_read_count } = bookUpdateBatch[i];
    const { error } = await supabase.from('books').update({ rating, users_read_count }).eq('id', id);
    if (error) { console.error('Book update error:', error.message); hadError = true; }
    else booksUpdated++;
    if ((i + 1) % BATCH_SIZE === 0) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  console.log(`\nDone. Reviews written: ${reviewsWritten.toLocaleString()}, Reviews failed: ${reviewsFailed.toLocaleString()}, Books updated: ${booksUpdated.toLocaleString()}, Skipped lines: ${skipped.toLocaleString()}`);
  if (hadError) process.exitCode = 1;
}

run().catch((err) => { console.error(err); process.exit(1); });
