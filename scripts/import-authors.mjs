/**
 * Populate the authors table and link books to their authors.
 *
 * Steps:
 *   1. Load books from DB that have goodreads_id
 *   2. Stream goodreads_books.json → collect primary author_id per book
 *   3. Stream goodreads_book_authors.json → collect author info for referenced authors
 *   4. Insert authors, then update books.goodreads_author_id
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/import-authors.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

const SUPABASE_URL    = 'https://cztrxekjkilctlgrkgga.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BOOKS_PATH      = 'C:/Users/isabe/Downloads/goodreads_books.json/goodreads_books.json';
const AUTHORS_PATH    = 'C:/Users/isabe/Downloads/goodreads_book_authors.json/goodreads_book_authors.json';

if (!SERVICE_ROLE_KEY) { console.error('Set SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function streamJSONL(path) {
  return createInterface({ input: createReadStream(path, { encoding: 'utf8' }), crlfDelay: Infinity });
}

// ── 1. Load books with goodreads_id ─────────────────────────────────────────
console.log('Loading books from database...');
const { data: dbBooks } = await supabase.from('books').select('id, goodreads_id').not('goodreads_id', 'is', null);
const dbBookMap = new Map(dbBooks.map(b => [b.goodreads_id, b.id])); // goodreads_id → book uuid
console.log(`${dbBookMap.size} books with GoodReads ID.\n`);

// ── 2. Stream goodreads_books.json → map book → primary author_id ────────────
console.log('Scanning goodreads_books.json for author links...');
const bookAuthorMap = new Map(); // book goodreads_id → author_id
const neededAuthorIds = new Set();
let lines = 0;

let rl = await streamJSONL(BOOKS_PATH);
for await (const line of rl) {
  if (++lines % 500_000 === 0) process.stdout.write(`  ${(lines/1e6).toFixed(1)}M\n`);
  if (!line.trim()) continue;
  let row; try { row = JSON.parse(line); } catch { continue; }
  if (!dbBookMap.has(String(row.book_id))) continue;
  const primaryAuthor = row.authors?.find(a => a.role === '' || !a.role) ?? row.authors?.[0];
  if (!primaryAuthor?.author_id) continue;
  bookAuthorMap.set(String(row.book_id), String(primaryAuthor.author_id));
  neededAuthorIds.add(String(primaryAuthor.author_id));
}
console.log(`Found author links for ${bookAuthorMap.size} books (${neededAuthorIds.size} unique authors).\n`);

// ── 3. Stream goodreads_book_authors.json → collect author info ──────────────
console.log('Scanning goodreads_book_authors.json...');
const authorData = new Map(); // author_id → { name, average_rating, ratings_count }
lines = 0;
rl = await streamJSONL(AUTHORS_PATH);
for await (const line of rl) {
  if (++lines % 200_000 === 0) process.stdout.write(`  ${(lines/1e6).toFixed(1)}M\n`);
  if (!line.trim()) continue;
  let row; try { row = JSON.parse(line); } catch { continue; }
  if (!neededAuthorIds.has(String(row.author_id))) continue;
  authorData.set(String(row.author_id), {
    goodreads_author_id: String(row.author_id),
    name:               row.name ?? 'Unknown',
  });
}
console.log(`Collected data for ${authorData.size} authors.\n`);

// ── 4. Insert authors ────────────────────────────────────────────────────────
console.log('Inserting authors...');
const authorRows = [...authorData.values()];
let authorsInserted = 0, errors = 0;

for (let i = 0; i < authorRows.length; i += 50) {
  const batch = authorRows.slice(i, i + 50);
  const { error } = await supabase.from('authors').upsert(batch, { onConflict: 'goodreads_author_id' });
  if (error) { console.error('Author batch error:', error.message); errors += batch.length; }
  else authorsInserted += batch.length;
}
console.log(`Inserted ${authorsInserted} authors.\n`);

// ── 5. Update books.goodreads_author_id ──────────────────────────────────────
console.log('Linking books to authors...');
let booksLinked = 0;

const linkBatch = [];
for (const [grBookId, authorId] of bookAuthorMap) {
  const bookUuid = dbBookMap.get(grBookId);
  if (!bookUuid || !authorData.has(authorId)) continue;
  linkBatch.push({ id: bookUuid, authorId });
}

for (let i = 0; i < linkBatch.length; i += 20) {
  const batch = linkBatch.slice(i, i + 20);
  await Promise.all(batch.map(async ({ id, authorId }) => {
    const { error } = await supabase.from('books').update({ goodreads_author_id: authorId }).eq('id', id);
    if (error) errors++;
    else booksLinked++;
  }));
}

console.log(`\nDone.`);
console.log(`  Authors inserted: ${authorsInserted}`);
console.log(`  Books linked:     ${booksLinked}`);
console.log(`  Errors:           ${errors}`);
