/**
 * Import GoodReads author data into Supabase.
 *
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_KEY=eyJ... \
 *   node scripts/import-goodreads-authors.mjs /path/to/authors.json
 *
 * Reads NDJSON. Strips HTML from bios. Skips entries with no name.
 * Upserts on goodreads_author_id.
 */

import fs from 'fs';
import readline from 'readline';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const FILE_PATH = process.argv[2];
const BATCH_SIZE = 100;
const DELAY_MS = 500;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables.');
  process.exit(1);
}
if (!FILE_PATH) {
  console.error('Usage: node scripts/import-goodreads-authors.mjs /path/to/authors.json');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function stripHtml(str) {
  if (!str) return null;
  return str
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim() || null;
}

function transform(raw) {
  const id = raw.author_id ?? raw.id;
  if (!id) return null;
  const name = raw.name?.trim();
  if (!name) return null;

  return {
    goodreads_author_id: String(id),
    name,
    bio: stripHtml(raw.about ?? raw.bio),
    photo_url: raw.image_url && !raw.image_url.includes('nophoto') ? raw.image_url : null,
    born_date: raw.born_at?.trim() || null,
    website: raw.website?.trim() || null,
  };
}

async function flushBatch(batch) {
  const { error } = await supabase
    .from('authors')
    .upsert(batch, { onConflict: 'goodreads_author_id', ignoreDuplicates: false });
  if (error) console.error('Upsert error:', error.message);
}

async function run() {
  console.log(`Reading: ${FILE_PATH}`);
  const rl = readline.createInterface({
    input: fs.createReadStream(FILE_PATH, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  let lineNum = 0, imported = 0, skipped = 0, batch = [];

  for await (const line of rl) {
    lineNum++;
    const trimmed = line.trim();
    if (!trimmed || trimmed === '[' || trimmed === ']') continue;
    const jsonStr = trimmed.endsWith(',') ? trimmed.slice(0, -1) : trimmed;

    let raw;
    try { raw = JSON.parse(jsonStr); }
    catch { skipped++; continue; }

    const row = transform(raw);
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
