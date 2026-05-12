/**
 * Patch missing goodreads_id values on books by matching against goodreads_books.json.
 *
 * Matching strategy:
 *   1. Normalize titles (lowercase, strip punctuation + articles)
 *   2. Match app book title against GoodReads title_without_series (and full title)
 *   3. Only assign when there is exactly one GoodReads candidate for that title
 *      (ambiguous multi-edition titles are skipped and logged)
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/patch-goodreads-ids.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

const SUPABASE_URL = 'https://cztrxekjkilctlgrkgga.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FILE_PATH = 'C:/Users/isabe/Downloads/goodreads_books.json/goodreads_books.json';

if (!SERVICE_ROLE_KEY) {
  console.error('Set SUPABASE_SERVICE_ROLE_KEY env var');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function normalize(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[''"""]/g, '')          // smart quotes
    .replace(/[^a-z0-9\s]/g, ' ')     // punctuation → space
    .replace(/\b(the|a|an)\b/g, ' ')  // strip articles
    .replace(/\s+/g, ' ')
    .trim();
}

// ── 1. Load books missing goodreads_id ───────────────────────────────────────
console.log('Loading unmatched books...');
const { data: unmatched, error: fetchErr } = await supabase
  .from('books')
  .select('id, title, author')
  .is('goodreads_id', null);

if (fetchErr) { console.error(fetchErr); process.exit(1); }
console.log(`${unmatched.length} books need a goodreads_id.\n`);

if (unmatched.length === 0) {
  console.log('Nothing to do.');
  process.exit(0);
}

// ── 2. Build lookup: normalizedTitle → [appBook] ─────────────────────────────
const appTitleMap = new Map();
for (const book of unmatched) {
  const nt = normalize(book.title);
  if (!appTitleMap.has(nt)) appTitleMap.set(nt, []);
  appTitleMap.get(nt).push(book);
}
const appTitleSet = new Set(appTitleMap.keys());

// ── 3. Stream GoodReads file, collecting candidates for each app title ────────
console.log('Scanning goodreads_books.json...');
// Map: normalizedTitle → Set of goodreads book_ids (detect multi-edition ambiguity)
const grCandidates = new Map(); // normalizedTitle → [{ goodreadsId }]

let linesRead = 0;
const rl = createInterface({
  input: createReadStream(FILE_PATH, { encoding: 'utf8' }),
  crlfDelay: Infinity,
});

for await (const line of rl) {
  linesRead++;
  if (linesRead % 500_000 === 0) process.stdout.write(`  ${(linesRead / 1e6).toFixed(1)}M lines\n`);
  if (!line.trim()) continue;

  let row;
  try { row = JSON.parse(line); } catch { continue; }

  // Try both the series-stripped title and the full title
  const titlesToCheck = new Set([
    normalize(row.title_without_series),
    normalize(row.title),
  ].filter(Boolean));

  for (const nt of titlesToCheck) {
    if (!appTitleSet.has(nt)) continue;
    if (!grCandidates.has(nt)) grCandidates.set(nt, []);
    const list = grCandidates.get(nt);
    if (!list.some(c => c.goodreadsId === row.book_id)) {
      list.push({ goodreadsId: row.book_id });
    }
  }
}

console.log(`\nScanned ${linesRead.toLocaleString()} lines.\n`);

// ── 4. Build updates ──────────────────────────────────────────────────────────
const updates = [];
const skippedAmbiguous = [];
const noMatch = [];

for (const [nt, appBooks] of appTitleMap) {
  const candidates = grCandidates.get(nt) ?? [];

  if (candidates.length === 0) {
    noMatch.push(appBooks[0].title);
    continue;
  }

  if (appBooks.length > 1) {
    // Multiple app books share the same normalized title — too risky
    skippedAmbiguous.push(`"${appBooks[0].title}" (${appBooks.length} app books, ${candidates.length} GR candidates)`);
    continue;
  }

  if (candidates.length > 1) {
    // Multiple GoodReads editions — skip to avoid wrong assignment
    skippedAmbiguous.push(`"${appBooks[0].title}" (1 app book, ${candidates.length} GR editions)`);
    continue;
  }

  // Exactly one app book ↔ exactly one GoodReads book
  updates.push({ id: appBooks[0].id, title: appBooks[0].title, goodreads_id: candidates[0].goodreadsId });
}

console.log(`Results:`);
console.log(`  Will update:  ${updates.length}`);
console.log(`  Ambiguous:    ${skippedAmbiguous.length}`);
console.log(`  No match:     ${noMatch.length}\n`);

if (skippedAmbiguous.length > 0) {
  console.log('Skipped (ambiguous):');
  skippedAmbiguous.forEach(s => console.log(' ', s));
  console.log();
}

if (updates.length === 0) {
  console.log('Nothing to update.');
  process.exit(0);
}

// ── 5. Apply updates ──────────────────────────────────────────────────────────
console.log('Applying updates...');
let updated = 0;
let errors = 0;

for (let i = 0; i < updates.length; i += 20) {
  const batch = updates.slice(i, i + 20);
  await Promise.all(batch.map(async ({ id, goodreads_id, title }) => {
    const { error } = await supabase.from('books').update({ goodreads_id }).eq('id', id);
    if (error) {
      console.error(`  Error on "${title}":`, error.message);
      errors++;
    } else {
      updated++;
    }
  }));
}

console.log(`\nDone. Updated: ${updated} | Errors: ${errors}`);
console.log('\nRe-run import-reviews.mjs to link reviews to newly matched books.');
