/**
 * Rebuild the books library from Hardcover API using goodreads_library_export.csv.
 *
 * For each book in the CSV:
 *   1. Try ISBN-13 lookup on Hardcover (most accurate)
 *   2. Fall back to ISBN-10
 *   3. Fall back to title + author search
 *
 * Run reset.sql in Supabase first, then:
 *   SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/import-from-hardcover.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const SUPABASE_URL      = 'https://cztrxekjkilctlgrkgga.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_P345OetBEkzOxtmjmNRUWw_dJKbpbAe';
const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BOOKS_FN_URL      = `${SUPABASE_URL}/functions/v1/books`;
const CSV_PATH          = 'C:/Users/isabe/Downloads/goodreads_library_export.csv';
const DELAY_MS          = 600; // be respectful of Hardcover rate limits

if (!SERVICE_ROLE_KEY) { console.error('Set SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseCSVLine(line) {
  const fields = [];
  let current = '', inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      fields.push(current); current = '';
    } else current += ch;
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
    default:                  return 'want';
  }
}

function normalize(str) {
  return str?.toLowerCase().replace(/[^a-z0-9]/g, '').trim() ?? '';
}

// ── Hardcover API calls ──────────────────────────────────────────────────────

async function callEdgeFn(body) {
  const res = await fetch(BOOKS_FN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Edge function error: ${res.status}`);
  return res.json();
}

async function lookupByISBN(isbn) {
  if (!isbn) return null;
  try {
    const result = await callEdgeFn({ action: 'isbn', isbn });
    if (result?.error) { console.log(`  [isbn error] ${result.error}`); return null; }
    return result ?? null;
  } catch (e) { console.log(`  [isbn exception] ${e.message}`); return null; }
}

async function lookupBySearch(query, expectedTitle) {
  try {
    const results = await callEdgeFn({ action: 'search', query, limit: 5 });
    if (results?.error) { console.log(`  [search error] ${results.error}`); return null; }
    if (!Array.isArray(results) || results.length === 0) { console.log(`  [search] 0 results`); return null; }
    const normExpected = normalize(expectedTitle.split(':')[0].split('(')[0]);
    const exact = results.find(r => normalize(r.title).startsWith(normExpected));
    return exact ?? results[0];
  } catch (e) { console.log(`  [search exception] ${e.message}`); return null; }
}

async function findOnHardcover(csv) {
  // 1. ISBN-13
  if (csv.isbn13) {
    const r = await lookupByISBN(csv.isbn13);
    await sleep(DELAY_MS);
    if (r) return r;
  }
  // 2. ISBN-10
  if (csv.isbn) {
    const r = await lookupByISBN(csv.isbn);
    await sleep(DELAY_MS);
    if (r) return r;
  }
  // 3. Title + author search
  const r = await lookupBySearch(`${csv.title} ${csv.author}`, csv.title);
  await sleep(DELAY_MS);
  return r;
}

// ── Parse CSV ────────────────────────────────────────────────────────────────
console.log('Parsing CSV...');
const csvLines = readFileSync(CSV_PATH, 'utf8').split('\n');
const csvBooks = [];

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
    numPages:       parseInt(f[11], 10) || null,
    dateRead:       parseDate(f[14]),
    dateAdded:      parseDate(f[15]),
    exclusiveShelf: f[18]?.trim(),
    myReview:       f[19]?.trim() || null,
  });
}

// Deduplicate
const seen = new Set();
const unique = csvBooks.filter(b => { if (seen.has(b.goodreadsId)) return false; seen.add(b.goodreadsId); return true; });
console.log(`${unique.length} books to import.\n`);

// ── Get user ─────────────────────────────────────────────────────────────────
const { data: profiles } = await supabase.from('profiles').select('id, username').limit(1);
if (!profiles?.length) { console.error('No profiles found — log in to the app first.'); process.exit(1); }
const userId = profiles[0].id;
console.log(`Importing for: ${profiles[0].username}\n`);

// ── Import loop ──────────────────────────────────────────────────────────────
let matched = 0, inserted = 0, notFound = 0, errors = 0;

for (let i = 0; i < unique.length; i++) {
  const csv = unique[i];
  process.stdout.write(`[${i + 1}/${unique.length}] "${csv.title}"... `);

  const hc = await findOnHardcover(csv);

  if (!hc) {
    console.log('NOT FOUND');
    notFound++;
    continue;
  }

  matched++;
  console.log(`✓ "${hc.title}" (${hc.hardcover_id})`);

  try {
    // Upsert book
    const { data: bookRow, error: bookErr } = await supabase
      .from('books')
      .upsert({
        hardcover_id:    hc.hardcover_id,
        goodreads_id:    csv.goodreadsId,
        title:           hc.title,
        author:          hc.author,
        cover_url:       hc.cover_url,
        page_count:      hc.page_count ?? csv.numPages,
        genres:          hc.genres?.length ? hc.genres : null,
        description:     hc.description,
        rating:          hc.rating,
        users_read_count: hc.users_read_count,
        series_id:       hc.series_id ?? null,
      }, { onConflict: 'hardcover_id' })
      .select('id')
      .single();

    if (bookErr) throw bookErr;

    // Upsert user_books
    const shelf      = shelfKey(csv.exclusiveShelf);
    const finishedAt = shelf === 'read' ? (csv.dateRead ?? csv.dateAdded) : null;

    const { error: ubErr } = await supabase
      .from('user_books')
      .upsert({
        user_id:      userId,
        book_id:      bookRow.id,
        shelf,
        current_page: shelf === 'read' ? (hc.page_count ?? csv.numPages ?? 0) : 0,
        rating:       csv.myRating ?? null,
        review:       csv.myReview ?? null,
        added_at:     csv.dateAdded ?? new Date().toISOString(),
        finished_at:  finishedAt,
      }, { onConflict: 'user_id,book_id' });

    if (ubErr) throw ubErr;
    inserted++;
  } catch (err) {
    console.log(`  ERROR: ${err.message}`);
    errors++;
  }
}

console.log('\n─────────────────────────────');
console.log(`Matched:   ${matched} / ${unique.length}`);
console.log(`Inserted:  ${inserted}`);
console.log(`Not found: ${notFound}`);
console.log(`Errors:    ${errors}`);
console.log('\nNext: deploy the updated Edge Function, then run import-reviews.mjs');
