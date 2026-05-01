/**
 * Improve books.genres using GoodReads tag data.
 *
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_KEY=eyJ... \
 *   node scripts/import-goodreads-tags.mjs /path/to/tags.json /path/to/book_tags.json
 *
 * Reads tags.json to build a tag_id→name map, then streams book_tags.json.
 * For each book, selects genre-matching tags by count and updates books.genres
 * only when the new list has more items than the existing value.
 */

import fs from 'fs';
import readline from 'readline';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const TAGS_FILE = process.argv[2];
const BOOK_TAGS_FILE = process.argv[3];
const BATCH_SIZE = 100;
const DELAY_MS = 200;

const GENRE_SHELVES = new Set([
  'fantasy', 'romance', 'science-fiction', 'sci-fi', 'mystery', 'thriller',
  'historical-fiction', 'literary-fiction', 'horror', 'young-adult', 'ya',
  'contemporary', 'paranormal', 'dystopian', 'adventure', 'classics',
  'biography', 'memoir', 'self-help', 'non-fiction', 'nonfiction',
  'graphic-novels', 'manga', 'poetry', 'humor', 'crime', 'detective',
  'urban-fantasy', 'epic-fantasy', 'high-fantasy', 'dark-fantasy',
  'magical-realism', 'historical-romance', 'paranormal-romance',
  'chick-lit', 'short-stories', 'spirituality', 'philosophy',
  'psychology', 'science', 'history', 'politics', 'travel',
  'children', "children's", 'middle-grade', 'picture-books',
]);

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY.');
  process.exit(1);
}
if (!TAGS_FILE || !BOOK_TAGS_FILE) {
  console.error('Usage: node scripts/import-goodreads-tags.mjs /path/to/tags.json /path/to/book_tags.json');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function loadTagMap() {
  const map = new Map(); // tag_id → lowercase name
  const rl = readline.createInterface({
    input: fs.createReadStream(TAGS_FILE, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === '[' || trimmed === ']') continue;
    const jsonStr = trimmed.endsWith(',') ? trimmed.slice(0, -1) : trimmed;
    try {
      const raw = JSON.parse(jsonStr);
      const id = raw.tag_id ?? raw.id;
      const name = raw.tag_name ?? raw.name;
      if (id != null && name) map.set(String(id), name.toLowerCase());
    } catch {}
  }
  console.log(`Loaded ${map.size.toLocaleString()} tags.`);
  return map;
}

async function loadBookMap() {
  const map = new Map(); // goodreads_id → { id, genres }
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('books')
      .select('id, goodreads_id, genres')
      .not('goodreads_id', 'is', null)
      .range(from, from + PAGE - 1);
    if (error) { console.warn('loadBookMap error:', error.message); break; }
    if (!data || data.length === 0) break;
    for (const row of data) map.set(row.goodreads_id, { id: row.id, genres: row.genres });
    if (data.length < PAGE) break;
    from += PAGE;
  }
  console.log(`Loaded ${map.size.toLocaleString()} books.`);
  return map;
}

async function run() {
  const tagMap = await loadTagMap();
  const bookMap = await loadBookMap();

  // Accumulate: goodreadsBookId → Map<genreName, totalCount>
  const acc = new Map();

  const rl = readline.createInterface({
    input: fs.createReadStream(BOOK_TAGS_FILE, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  let lineNum = 0;
  for await (const line of rl) {
    lineNum++;
    const trimmed = line.trim();
    if (!trimmed || trimmed === '[' || trimmed === ']') continue;
    const jsonStr = trimmed.endsWith(',') ? trimmed.slice(0, -1) : trimmed;

    let raw;
    try { raw = JSON.parse(jsonStr); } catch { continue; }

    const goodreadsBookId = raw.book_id ? String(raw.book_id) : null;
    if (!goodreadsBookId || !bookMap.has(goodreadsBookId)) continue;

    // Handle two formats:
    // Format A: { book_id, tag_id, count }
    // Format B: { book_id, shelves: [{tag_id, count}] }
    const pairs = raw.shelves
      ? raw.shelves.map((s) => ({ tagId: String(s.tag_id ?? s.id), count: parseInt(s.count, 10) || 0 }))
      : [{ tagId: String(raw.tag_id), count: parseInt(raw.count, 10) || 0 }];

    let tagCounts = acc.get(goodreadsBookId);
    if (!tagCounts) { tagCounts = new Map(); acc.set(goodreadsBookId, tagCounts); }

    for (const { tagId, count } of pairs) {
      const tagName = tagMap.get(tagId);
      if (!tagName || !GENRE_SHELVES.has(tagName)) continue;
      tagCounts.set(tagName, (tagCounts.get(tagName) ?? 0) + count);
    }
  }

  console.log(`\nComputed tag data for ${acc.size.toLocaleString()} books. Writing updates...`);

  let updated = 0, skipped = 0, hadError = false;
  let updateBatch = [];

  for (const [goodreadsBookId, tagCounts] of acc) {
    const book = bookMap.get(goodreadsBookId);
    if (!book) continue;

    const genres = [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name);

    const existingCount = book.genres?.length ?? 0;
    if (genres.length <= existingCount) { skipped++; continue; }

    updateBatch.push({ id: book.id, genres });

    if (updateBatch.length >= BATCH_SIZE) {
      for (const { id, genres } of updateBatch) {
        const { error } = await supabase.from('books').update({ genres }).eq('id', id);
        if (error) { console.error('Genre update error:', error.message); hadError = true; }
        else updated++;
      }
      updateBatch = [];
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  if (updateBatch.length > 0) {
    for (const { id, genres } of updateBatch) {
      const { error } = await supabase.from('books').update({ genres }).eq('id', id);
      if (error) { console.error('Genre update error:', error.message); hadError = true; }
      else updated++;
    }
  }

  console.log(`\nDone. Updated: ${updated.toLocaleString()}, Skipped (no improvement): ${skipped.toLocaleString()}`);
  if (hadError) process.exitCode = 1;
}

run().catch((err) => { console.error(err); process.exit(1); });
