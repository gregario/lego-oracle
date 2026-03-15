#!/usr/bin/env tsx

/**
 * Downloads Rebrickable CSV data, gunzips, and ingests into SQLite.
 *
 * Usage: npm run fetch-data
 *
 * Downloads from: https://cdn.rebrickable.com/media/downloads/{filename}.csv.gz
 * Output: src/data/lego.sqlite
 */

import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import { Readable } from 'node:stream';
import { createWriteStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { getDatabase } from '../src/data/db.js';
import { clearAllData, INGEST_ORDER } from '../src/data/rebrickable.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DB_PATH = path.join(PROJECT_ROOT, 'src', 'data', 'lego.sqlite');
const CDN_BASE = 'https://cdn.rebrickable.com/media/downloads';

async function downloadAndGunzip(url: string, outPath: string): Promise<void> {
  console.error(`  Downloading ${url}...`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }
  const body = response.body;
  if (!body) {
    throw new Error(`No response body from ${url}`);
  }

  const nodeStream = Readable.fromWeb(body as import('node:stream/web').ReadableStream);
  await pipeline(nodeStream, createGunzip(), createWriteStream(outPath));
}

async function main(): Promise<void> {
  console.error('=== LEGO Oracle: Rebrickable Data Fetch ===\n');

  // Create temp directory for CSV files
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lego-oracle-'));
  console.error(`Temp directory: ${tmpDir}\n`);

  try {
    // Step 1: Download all CSV.gz files
    console.error('Step 1: Downloading CSV files...\n');
    for (const { filename } of INGEST_ORDER) {
      const gzUrl = `${CDN_BASE}/${filename}.gz`;
      const csvPath = path.join(tmpDir, filename);
      await downloadAndGunzip(gzUrl, csvPath);
    }

    // Step 2: Open/create SQLite database
    console.error('\nStep 2: Opening database...\n');
    // Delete existing DB to start fresh
    if (fs.existsSync(DB_PATH)) {
      fs.unlinkSync(DB_PATH);
      console.error('  Deleted existing database.');
    }
    const db = getDatabase(DB_PATH);

    // Step 3: Clear any existing data (fresh DB, but just in case)
    console.error('\nStep 3: Clearing existing data...\n');
    // Disable FK checks during bulk ingestion (themes have self-referential parent_id)
    db.pragma('foreign_keys = OFF');
    clearAllData(db);

    // Step 4: Ingest CSVs in dependency order
    console.error('Step 4: Ingesting data...\n');
    for (const { filename, ingest } of INGEST_ORDER) {
      const csvPath = path.join(tmpDir, filename);
      const csv = fs.readFileSync(csvPath, 'utf-8');
      const count = ingest(db, csv);
      console.error(`  ${filename}: ${count.toLocaleString()} rows`);
    }

    // Re-enable FK checks
    db.pragma('foreign_keys = ON');

    // Step 5: Log summary
    console.error('\n=== Ingestion complete ===\n');

    const tables = [
      'themes', 'colors', 'part_categories', 'parts', 'sets',
      'minifigs', 'inventories', 'inventory_parts', 'inventory_sets',
      'inventory_minifigs', 'part_relationships',
    ];
    for (const table of tables) {
      const row = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number };
      console.error(`  ${table}: ${row.count.toLocaleString()} rows`);
    }

    const stats = fs.statSync(DB_PATH);
    console.error(`\nDatabase size: ${(stats.size / 1024 / 1024).toFixed(1)} MB`);
    console.error(`Database path: ${DB_PATH}`);

    db.close();
  } finally {
    // Clean up temp directory
    fs.rmSync(tmpDir, { recursive: true, force: true });
    console.error('\nTemp directory cleaned up.');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
