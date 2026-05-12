/**
 * Update book genres using goodreads_book_genres_initial.json.gz.
 *
 * The genres file has cleaner, more structured genre data than popular_shelves.
 * Genre keys look like "fantasy, paranormal" or "mystery, thriller, crime" —
 * we split these into individual tags and take the top category by vote count.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/update-genres.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import zlib from 'node:zlib';

const SUPABASE_URL    = 'https://cztrxekjkilctlgrkgga.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GENRES_PATH     = 'C:/Users/isabe/Downloads/goodreads_book_genres_initial.json.gz';

if (!SERVICE_ROLE_KEY) { console.error('Set SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

function parseGenres(genresObj) {
  if (!genresObj || typeof genresObj !== 'object') return [];
  // Sort categories by vote count descending
  const sorted = Object.entries(genresObj).sort(([, a], [, b]) => b - a);
  const tags = new Set();
  for (const [category] of sorted) {
    for (const tag of category.split(',')) {
      const clean = tag.trim().replace(/\b\w/g, c => c.toUpperCase());
      if (clean.length >= 3) tags.add(clean);
    }
    if (tags.size >= 5) break;
  }
  return [...tags].slice(0, 5);
}

// ── 1. Load books with goodreads_id ─────────────────────────────────────────
console.log('Loading books from database...');
const { data: dbBooks } = await supabase
  .from('books')
  .select('id, goodreads_id, genres')
  .not('goodreads_id', 'is', null);

const dbBookMap = new Map(dbBooks.map(b => [b.goodreads_id, b]));
console.log(`${dbBookMap.size} books with GoodReads ID.\n`);

// ── 2. Stream compressed genres file ────────────────────────────────────────
console.log('Streaming genres file...');
const stream = createReadStream(GENRES_PATH).pipe(zlib.createGunzip());
const rl = createInterface({ input: stream, crlfDelay: Infinity });

const updates = []; // { id, genres }
let linesRead = 0;

for await (const line of rl) {
  if (++linesRead % 500_000 === 0) process.stdout.write(`  ${(linesRead/1e6).toFixed(1)}M lines\n`);
  if (!line.trim()) continue;
  let row; try { row = JSON.parse(line); } catch { continue; }

  const book = dbBookMap.get(String(row.book_id));
  if (!book) continue;

  const genres = parseGenres(row.genres);
  if (genres.length === 0) continue;

  // Always update — genres file is more authoritative than popular_shelves
  updates.push({ id: book.id, genres });
}

console.log(`\nFound genre data for ${updates.length} books.\n`);

// ── 3. Apply updates ─────────────────────────────────────────────────────────
console.log('Updating genres...');
let updated = 0, errors = 0;

for (let i = 0; i < updates.length; i += 20) {
  const batch = updates.slice(i, i + 20);
  await Promise.all(batch.map(async ({ id, genres }) => {
    const { error } = await supabase.from('books').update({ genres }).eq('id', id);
    if (error) { console.error('Error:', error.message); errors++; }
    else updated++;
  }));
}

console.log(`\nDone.`);
console.log(`  Updated: ${updated}`);
console.log(`  Errors:  ${errors}`);
