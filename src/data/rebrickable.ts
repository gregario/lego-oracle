import { parse } from 'csv-parse/sync';
import type Database from 'better-sqlite3';

const BATCH_SIZE = 1000;

/**
 * Parse a CSV string into an array of records.
 */
function parseCSV(csv: string): Record<string, string>[] {
  return parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
}

/**
 * Run inserts in batches within a transaction for performance.
 */
function batchInsert(
  db: Database.Database,
  records: Record<string, string>[],
  insertFn: (record: Record<string, string>) => void,
): number {
  let count = 0;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const tx = db.transaction(() => {
      for (const record of batch) {
        insertFn(record);
        count++;
      }
    });
    tx();
  }
  return count;
}

function intOrNull(val: string | undefined): number | null {
  if (val === undefined || val === '' || val === 'NULL') return null;
  const n = parseInt(val, 10);
  return isNaN(n) ? null : n;
}

function strOrNull(val: string | undefined): string | null {
  if (val === undefined || val === '' || val === 'NULL') return null;
  return val;
}

// --- Ingestors ---

export function ingestThemes(db: Database.Database, csv: string): number {
  const records = parseCSV(csv);
  const stmt = db.prepare('INSERT OR REPLACE INTO themes (id, name, parent_id) VALUES (?, ?, ?)');
  return batchInsert(db, records, (r) => {
    stmt.run(parseInt(r.id, 10), r.name, intOrNull(r.parent_id));
  });
}

export function ingestColors(db: Database.Database, csv: string): number {
  const records = parseCSV(csv);
  const stmt = db.prepare('INSERT OR REPLACE INTO colors (id, name, rgb, is_trans) VALUES (?, ?, ?, ?)');
  return batchInsert(db, records, (r) => {
    stmt.run(parseInt(r.id, 10), r.name, strOrNull(r.rgb), r.is_trans === 't' ? 1 : 0);
  });
}

export function ingestPartCategories(db: Database.Database, csv: string): number {
  const records = parseCSV(csv);
  const stmt = db.prepare('INSERT OR REPLACE INTO part_categories (id, name) VALUES (?, ?)');
  return batchInsert(db, records, (r) => {
    stmt.run(parseInt(r.id, 10), r.name);
  });
}

export function ingestParts(db: Database.Database, csv: string): number {
  const records = parseCSV(csv);
  const stmt = db.prepare('INSERT OR REPLACE INTO parts (part_num, name, part_cat_id, part_material) VALUES (?, ?, ?, ?)');
  return batchInsert(db, records, (r) => {
    stmt.run(r.part_num, r.name, intOrNull(r.part_cat_id), strOrNull(r.part_material));
  });
}

export function ingestSets(db: Database.Database, csv: string): number {
  const records = parseCSV(csv);
  const stmt = db.prepare('INSERT OR REPLACE INTO sets (set_num, name, year, theme_id, num_parts, img_url) VALUES (?, ?, ?, ?, ?, ?)');
  return batchInsert(db, records, (r) => {
    stmt.run(r.set_num, r.name, intOrNull(r.year), intOrNull(r.theme_id), intOrNull(r.num_parts), strOrNull(r.img_url));
  });
}

export function ingestMinifigs(db: Database.Database, csv: string): number {
  const records = parseCSV(csv);
  const stmt = db.prepare('INSERT OR REPLACE INTO minifigs (fig_num, name, num_parts, img_url) VALUES (?, ?, ?, ?)');
  return batchInsert(db, records, (r) => {
    stmt.run(r.fig_num, r.name, intOrNull(r.num_parts), strOrNull(r.img_url));
  });
}

export function ingestInventories(db: Database.Database, csv: string): number {
  const records = parseCSV(csv);
  const stmt = db.prepare('INSERT OR REPLACE INTO inventories (id, set_num, version) VALUES (?, ?, ?)');
  return batchInsert(db, records, (r) => {
    stmt.run(parseInt(r.id, 10), r.set_num, parseInt(r.version, 10));
  });
}

export function ingestInventoryParts(db: Database.Database, csv: string): number {
  const records = parseCSV(csv);
  const stmt = db.prepare('INSERT INTO inventory_parts (inventory_id, part_num, color_id, quantity, is_spare) VALUES (?, ?, ?, ?, ?)');
  return batchInsert(db, records, (r) => {
    stmt.run(parseInt(r.inventory_id, 10), r.part_num, parseInt(r.color_id, 10), parseInt(r.quantity, 10), r.is_spare === 't' ? 1 : 0);
  });
}

export function ingestInventorySets(db: Database.Database, csv: string): number {
  const records = parseCSV(csv);
  const stmt = db.prepare('INSERT INTO inventory_sets (inventory_id, set_num, quantity) VALUES (?, ?, ?)');
  return batchInsert(db, records, (r) => {
    stmt.run(parseInt(r.inventory_id, 10), r.set_num, parseInt(r.quantity, 10));
  });
}

export function ingestInventoryMinifigs(db: Database.Database, csv: string): number {
  const records = parseCSV(csv);
  const stmt = db.prepare('INSERT INTO inventory_minifigs (inventory_id, fig_num, quantity) VALUES (?, ?, ?)');
  return batchInsert(db, records, (r) => {
    stmt.run(parseInt(r.inventory_id, 10), r.fig_num, parseInt(r.quantity, 10));
  });
}

export function ingestPartRelationships(db: Database.Database, csv: string): number {
  const records = parseCSV(csv);
  const stmt = db.prepare('INSERT INTO part_relationships (rel_type, child_part_num, parent_part_num) VALUES (?, ?, ?)');
  return batchInsert(db, records, (r) => {
    stmt.run(r.rel_type, r.child_part_num, r.parent_part_num);
  });
}

/**
 * Clear all data from all tables (for re-ingestion).
 * Deletes in reverse dependency order to respect foreign keys.
 */
export function clearAllData(db: Database.Database): void {
  const tables = [
    'inventory_minifigs',
    'inventory_sets',
    'inventory_parts',
    'inventories',
    'part_relationships',
    'minifigs',
    'sets',
    'parts',
    'part_categories',
    'colors',
    'themes',
  ];
  for (const table of tables) {
    db.prepare(`DELETE FROM ${table}`).run();
  }
  // Rebuild FTS indexes
  db.exec("INSERT INTO sets_fts(sets_fts) VALUES ('rebuild')");
  db.exec("INSERT INTO parts_fts(parts_fts) VALUES ('rebuild')");
  db.exec("INSERT INTO minifigs_fts(minifigs_fts) VALUES ('rebuild')");
}

/**
 * Ordered list of CSV files and their ingest functions.
 * Order matters due to foreign key dependencies.
 */
export const INGEST_ORDER: Array<{
  filename: string;
  ingest: (db: Database.Database, csv: string) => number;
}> = [
  { filename: 'themes.csv', ingest: ingestThemes },
  { filename: 'colors.csv', ingest: ingestColors },
  { filename: 'part_categories.csv', ingest: ingestPartCategories },
  { filename: 'parts.csv', ingest: ingestParts },
  { filename: 'sets.csv', ingest: ingestSets },
  { filename: 'minifigs.csv', ingest: ingestMinifigs },
  { filename: 'inventories.csv', ingest: ingestInventories },
  { filename: 'inventory_parts.csv', ingest: ingestInventoryParts },
  { filename: 'inventory_sets.csv', ingest: ingestInventorySets },
  { filename: 'inventory_minifigs.csv', ingest: ingestInventoryMinifigs },
  { filename: 'part_relationships.csv', ingest: ingestPartRelationships },
];
