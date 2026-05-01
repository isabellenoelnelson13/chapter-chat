/**
 * Import GoodReads seed data from the Kaggle dataset into Supabase.
 * Dataset: https://www.kaggle.com/datasets/opalskies/large-books-metadata-dataset-50-mill-entries
 *
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_KEY=eyJ... \
 *   node scripts/import-goodreads.mjs /path/to/books.json
 *
 * The script handles NDJSON (one JSON object per line) which is the format
 * used by this dataset. It batches inserts in groups of 500 and skips books
 * without a title or author.
 */

import fs from 'fs';
import readline from 'readline';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const FILE_PATH = process.argv[2];
const BATCH_SIZE = 100;
const DELAY_MS = 500; // pause between batches to avoid overwhelming free-tier compute

// Genre-like shelf names to keep — skip "to-read", "favorites", etc.
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
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables.');
  process.exit(1);
}
if (!FILE_PATH) {
  console.error('Usage: node scripts/import-goodreads.mjs /path/to/books.json');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function loadAuthorMap() {
  const map = new Map(); // goodreads_author_id → name
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('authors')
      .select('goodreads_author_id, name')
      .range(from, from + PAGE - 1);
    if (error) { console.warn('Could not load author map:', error.message); break; }
    if (!data || data.length === 0) break;
    for (const row of data) map.set(row.goodreads_author_id, row.name);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  console.log(`Loaded ${map.size.toLocaleString()} authors into memory.`);
  return map;
}

function extractAuthor(raw, authorMap) {
  // Format A: authors: [{ name: "..." }]
  if (Array.isArray(raw.authors) && raw.authors[0]?.name)
    return { name: raw.authors[0].name, authorId: null };
  // Format B: authors: [{ author_id: "..." }] — resolve name from pre-loaded map
  if (Array.isArray(raw.authors) && raw.authors[0]?.author_id) {
    const id = String(raw.authors[0].author_id);
    const name = authorMap.get(id);
    return name ? { name, authorId: id } : { name: null, authorId: null };
  }
  // Format C: author: { name: "..." }
  if (raw.author?.name) return { name: raw.author.name, authorId: null };
  // Format D: author_name: "..."
  if (typeof raw.author_name === 'string') return { name: raw.author_name, authorId: null };
  return { name: null, authorId: null };
}

function extractGenres(raw) {
  const shelves = raw.popular_shelves ?? raw.shelves ?? [];
  const genres = shelves
    .map((s) => (typeof s === 'string' ? s : s?.name ?? ''))
    .filter((name) => GENRE_SHELVES.has(name.toLowerCase()))
    .slice(0, 5);
  return genres.length > 0 ? genres : null;
}

function extractSeries(raw) {
  // Format A: series_works.series_work (from XML-to-JSON)
  const sw = raw.series_works?.series_work;
  const entry = Array.isArray(sw) ? sw[0] : sw;
  if (entry) {
    return {
      series_id: entry.series?.id ? String(entry.series.id) : null,
      series_name: entry.series?.title ?? entry.series?.series_name ?? null,
      series_position: entry.user_position != null ? parseFloat(entry.user_position) : null,
    };
  }
  // Format B: series: ["Name #1"] string array
  if (Array.isArray(raw.series) && raw.series.length > 0) {
    const s = raw.series[0];
    const match = typeof s === 'string' ? s.match(/^(.+?)(?:\s+#([\d.]+))?$/) : null;
    return {
      series_id: null,
      series_name: match ? match[1].trim() : null,
      series_position: match?.[2] ? parseFloat(match[2]) : null,
    };
  }
  return { series_id: null, series_name: null, series_position: null };
}

function transform(raw, authorMap) {
  const id = raw.book_id ?? raw.id;
  if (!id) return null;

  const title = raw.title_without_series ?? raw.title;
  if (!title?.trim()) return null;

  const { name: author, authorId: goodreads_author_id } = extractAuthor(raw, authorMap);
  if (!author) return null;

  const rating = parseFloat(raw.average_rating);
  const pageCount = parseInt(raw.num_pages ?? raw.pages, 10);
  const readCount = parseInt(raw.ratings_count ?? raw.users_read_count, 10);

  // Skip very low quality entries (no rating data at all, or placeholder covers)
  const coverUrl = raw.image_url ?? raw.cover_image_url ?? null;
  const cleanCover = coverUrl && !coverUrl.includes('nophoto') ? coverUrl : null;

  const { series_id, series_name, series_position } = extractSeries(raw);

  return {
    goodreads_id: String(id),
    title: title.trim(),
    author: author.trim(),
    goodreads_author_id,
    cover_url: cleanCover,
    page_count: isNaN(pageCount) || pageCount <= 0 ? null : pageCount,
    description: raw.description?.trim() || null,
    rating: isNaN(rating) ? null : Math.round(rating * 100) / 100,
    users_read_count: isNaN(readCount) ? null : readCount,
    genres: extractGenres(raw),
    series_id,
    series_name,
    series_position,
  };
}

async function flushBatch(batch) {
  const { error } = await supabase
    .from('books')
    .upsert(batch, { onConflict: 'goodreads_id', ignoreDuplicates: false });
  if (error) {
    console.error('Upsert error:', error.message);
  }
}

async function run() {
  const authorMap = await loadAuthorMap();
  console.log(`Reading: ${FILE_PATH}`);
  const rl = readline.createInterface({
    input: fs.createReadStream(FILE_PATH, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  let lineNum = 0;
  let imported = 0;
  let skipped = 0;
  let batch = [];

  for await (const line of rl) {
    lineNum++;
    const trimmed = line.trim();
    if (!trimmed || trimmed === '[' || trimmed === ']') continue;

    // Strip trailing comma (JSON array format)
    const jsonStr = trimmed.endsWith(',') ? trimmed.slice(0, -1) : trimmed;

    let raw;
    try {
      raw = JSON.parse(jsonStr);
    } catch {
      skipped++;
      continue;
    }

    const row = transform(raw, authorMap);
    if (!row) { skipped++; continue; }

    batch.push(row);
    if (batch.length >= BATCH_SIZE) {
      await flushBatch(batch);
      imported += batch.length;
      batch = [];
      await new Promise((r) => setTimeout(r, DELAY_MS));
      if (imported % 5000 === 0) {
        console.log(`  imported ${imported.toLocaleString()} | skipped ${skipped.toLocaleString()} | line ${lineNum.toLocaleString()}`);
      }
    }
  }

  if (batch.length > 0) {
    await flushBatch(batch);
    imported += batch.length;
  }

  console.log(`\nDone. Imported: ${imported.toLocaleString()}, Skipped: ${skipped.toLocaleString()}`);
}

run().catch((err) => { console.error(err); process.exit(1); });
