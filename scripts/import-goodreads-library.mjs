/**
 * Import your personal GoodReads library export into the app.
 *
 * Steps:
 *   1. Parse goodreads_library_export.csv → books + shelf/rating/date data
 *   2. Stream goodreads_books.json → enrich with description, cover, genres
 *   3. Insert books into the books table
 *   4. Insert user_books records for the authenticated user
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/import-goodreads-library.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { createReadStream, readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';

const SUPABASE_URL   = 'https://cztrxekjkilctlgrkgga.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CSV_PATH       = 'C:/Users/isabe/Downloads/goodreads_library_export.csv';
const BOOKS_PATH     = 'C:/Users/isabe/Downloads/goodreads_books.json/goodreads_books.json';

const SKIP_SHELVES = new Set([
  'to-read','currently-reading','read','owned','favorites','default','kindle',
  're-read','library','audiobook','audiobooks','ebook','ebooks','wish-list',
  'wishlist','borrowed','arc','bought','dnf','abandoned','unread','to-buy',
  'bookshelf','collection','my-books','books-i-own','owned-books','english',
]);

if (!SERVICE_ROLE_KEY) {
  console.error('Set SUPABASE_SERVICE_ROLE_KEY env var');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      fields.push(current); current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

function parseISBN(raw) {
  if (!raw) return null;
  const m = raw.match(/([0-9]{9,13}[0-9X])/);
  return m ? m[1] : null;
}

function parseDate(str) {
  if (!str?.trim()) return null;
  const [y, m, d] = str.trim().split('/');
  if (!y || !m || !d) return null;
  const dt = new Date(`${y}-${m}-${d}T12:00:00Z`);
  return isNaN(dt.getTime()) ? null : dt.toISOString();
}

function shelfKey(exclusive) {
  switch (exclusive?.trim()) {
    case 'read':              return 'read';
    case 'currently-reading': return 'reading';
    case 'to-read':           return 'want';
    default:                  return 'want';
  }
}

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

// ── 1. Parse CSV ─────────────────────────────────────────────────────────────
console.log('Parsing CSV...');
const csvLines = readFileSync(CSV_PATH, 'utf8').split('\n');
const headers  = parseCSVLine(csvLines[0]);

const csvBooks = []; // { goodreadsId, title, author, isbn, isbn13, myRating, avgRating,
                     //   publisher, binding, numPages, yearPublished, dateRead, dateAdded,
                     //   exclusiveShelf, myReview }

for (let i = 1; i < csvLines.length; i++) {
  const line = csvLines[i].trim();
  if (!line) continue;
  const f = parseCSVLine(line);

  const goodreadsId = f[0]?.trim();
  if (!goodreadsId) continue;

  csvBooks.push({
    goodreadsId,
    title:          f[1]  ?? '',
    author:         f[2]  ?? '',
    isbn:           parseISBN(f[5]),
    isbn13:         parseISBN(f[6]),
    myRating:       parseInt(f[7], 10) || null,
    avgRating:      parseFloat(f[8])   || null,
    publisher:      f[9]?.trim()       || null,
    binding:        f[10]?.trim()      || null,
    numPages:       parseInt(f[11], 10) || null,
    yearPublished:  parseInt(f[12], 10) || null,
    dateRead:       parseDate(f[14]),
    dateAdded:      parseDate(f[15]),
    exclusiveShelf: f[18]?.trim(),
    myReview:       f[19]?.trim()      || null,
  });
}

// Deduplicate by goodreadsId
const csvMap = new Map();
for (const b of csvBooks) csvMap.set(b.goodreadsId, b);
const uniqueCsvBooks = [...csvMap.values()];
console.log(`Found ${uniqueCsvBooks.length} unique books in CSV.\n`);

// ── 2. Stream goodreads_books.json to enrich metadata ────────────────────────
console.log('Enriching from goodreads_books.json (this takes a few minutes)...');
const grIdSet = new Set(uniqueCsvBooks.map(b => b.goodreadsId));
const grMeta  = new Map(); // goodreadsId → { description, cover_url, genres, ratings_count, ... }

let linesRead = 0;
const rl = createInterface({
  input: createReadStream(BOOKS_PATH, { encoding: 'utf8' }),
  crlfDelay: Infinity,
});

for await (const line of rl) {
  linesRead++;
  if (linesRead % 500_000 === 0) process.stdout.write(`  ${(linesRead / 1e6).toFixed(1)}M lines\n`);
  if (!line.trim()) continue;

  let row;
  try { row = JSON.parse(line); } catch { continue; }

  if (!grIdSet.has(String(row.book_id))) continue;

  grMeta.set(String(row.book_id), {
    description:        row.description?.trim()  || null,
    cover_url:          row.image_url?.replace(/\/[a-z]\//, '/l/') || null, // prefer large image
    genres:             extractGenres(row.popular_shelves),
    ratings_count:      parseInt(row.ratings_count, 10)      || null,
    text_reviews_count: parseInt(row.text_reviews_count, 10) || null,
  });
}

console.log(`Enriched metadata for ${grMeta.size} / ${uniqueCsvBooks.length} books.\n`);

// ── 3. Get user ID ───────────────────────────────────────────────────────────
const { data: profiles } = await supabase.from('profiles').select('id, username').limit(5);
if (!profiles?.length) {
  console.error('No profiles found — make sure you are logged in to the app at least once first.');
  process.exit(1);
}
const userId = profiles[0].id;
console.log(`Importing for user: ${profiles[0].username} (${userId})\n`);

// ── 4. Insert books then user_books ─────────────────────────────────────────
console.log('Inserting books...');
let booksInserted = 0;
let userBooksInserted = 0;
let errors = 0;

for (let i = 0; i < uniqueCsvBooks.length; i += 20) {
  const batch = uniqueCsvBooks.slice(i, i + 20);

  await Promise.all(batch.map(async (csv) => {
    const meta = grMeta.get(csv.goodreadsId) ?? {};

    // Determine format — constraint allows: 'physical' | 'ebook' | 'audiobook'
    let format = 'physical';
    const b = csv.binding?.toLowerCase() ?? '';
    if (b.includes('kindle') || b.includes('ebook') || b.includes('nook')) format = 'ebook';
    else if (b.includes('audio'))                                            format = 'audiobook';

    // Insert book
    const { data: bookRow, error: bookErr } = await supabase
      .from('books')
      .upsert({
        goodreads_id:        csv.goodreadsId,
        title:               csv.title,
        author:              csv.author,
        isbn:                csv.isbn,
        isbn13:              csv.isbn13,
        cover_url:           meta.cover_url  ?? null,
        description:         meta.description ?? null,
        page_count:          csv.numPages,
        genres:              meta.genres?.length ? meta.genres : null,
        rating:              csv.avgRating,
        ratings_count:       meta.ratings_count       ?? null,
        text_reviews_count:  meta.text_reviews_count  ?? null,
        publisher:           csv.publisher,
        publication_year:    csv.yearPublished,
      }, { onConflict: 'goodreads_id' })
      .select('id')
      .single();

    if (bookErr) { console.error(`Book error "${csv.title}":`, bookErr.message); errors++; return; }
    booksInserted++;

    // Insert user_book
    const shelf      = shelfKey(csv.exclusiveShelf);
    const finishedAt = shelf === 'read' ? (csv.dateRead ?? csv.dateAdded) : null;

    const { error: ubErr } = await supabase
      .from('user_books')
      .upsert({
        user_id:     userId,
        book_id:     bookRow.id,
        shelf,
        current_page: shelf === 'read' ? (csv.numPages ?? 0) : 0,
        rating:      csv.myRating ?? null,
        review:      csv.myReview ?? null,
        added_at:    csv.dateAdded ?? new Date().toISOString(),
        finished_at: finishedAt,
        format,
      }, { onConflict: 'user_id,book_id' });

    if (ubErr) { console.error(`user_books error "${csv.title}":`, ubErr.message); errors++; return; }
    userBooksInserted++;
  }));

  process.stdout.write(`  ${Math.min(i + 20, uniqueCsvBooks.length)} / ${uniqueCsvBooks.length} processed\n`);
}

console.log(`\nDone.`);
console.log(`  Books inserted/updated:       ${booksInserted}`);
console.log(`  User library entries created: ${userBooksInserted}`);
console.log(`  Errors:                       ${errors}`);
console.log(`\nNext: run import-reviews.mjs to link GoodReads reviews to your books.`);
