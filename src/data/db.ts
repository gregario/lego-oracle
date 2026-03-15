import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// --- Types ---

export interface ThemeRow {
  id: number;
  name: string;
  parent_id: number | null;
}

export interface ColorRow {
  id: number;
  name: string;
  rgb: string | null;
  is_trans: number;
}

export interface PartCategoryRow {
  id: number;
  name: string;
}

export interface PartRow {
  part_num: string;
  name: string;
  part_cat_id: number | null;
  part_material: string | null;
}

export interface SetRow {
  set_num: string;
  name: string;
  year: number | null;
  theme_id: number | null;
  num_parts: number | null;
  img_url: string | null;
}

export interface MinifigRow {
  fig_num: string;
  name: string;
  num_parts: number | null;
  img_url: string | null;
}

export interface InventoryRow {
  id: number;
  set_num: string;
  version: number;
}

export interface InventoryPartRow {
  inventory_id: number;
  part_num: string;
  color_id: number;
  quantity: number;
  is_spare: number;
}

export interface InventorySetRow {
  inventory_id: number;
  set_num: string;
  quantity: number;
}

export interface InventoryMinifigRow {
  inventory_id: number;
  fig_num: string;
  quantity: number;
}

export interface PartRelationshipRow {
  rel_type: string;
  child_part_num: string;
  parent_part_num: string;
}

// --- Constants ---

const DB_FILENAME = 'lego.sqlite';

// --- Schema loading ---

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

function loadSchema(): string {
  return fs.readFileSync(SCHEMA_PATH, 'utf-8');
}

// --- Database management ---

/**
 * Opens (or creates) a SQLite database and initializes the schema.
 *
 * @param dataDir - Custom data directory or path to .sqlite file.
 *                  Pass ':memory:' for an in-memory database (tests).
 * @returns A better-sqlite3 Database instance with schema applied.
 */
export function getDatabase(dataDir?: string): Database.Database {
  let db: Database.Database;

  if (dataDir === ':memory:') {
    db = new Database(':memory:');
  } else {
    const dir = dataDir ?? __dirname;
    const dbPath = dir.endsWith('.sqlite') ? dir : path.join(dir, DB_FILENAME);
    const parentDir = path.dirname(dbPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    db = new Database(dbPath);
  }

  // Performance pragmas
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Initialize schema (idempotent via IF NOT EXISTS)
  initializeSchema(db);

  return db;
}

/**
 * Runs the schema SQL against the database.
 * Safe to call multiple times due to IF NOT EXISTS clauses.
 */
function initializeSchema(db: Database.Database): void {
  let schema: string;
  try {
    schema = loadSchema();
  } catch {
    throw new Error(
      `Could not load schema.sql from ${SCHEMA_PATH}. ` +
      'Ensure schema.sql is copied to the dist/data/ directory during build.'
    );
  }
  db.exec(schema);
}

// --- Query helpers ---

export function insertTheme(db: Database.Database, theme: ThemeRow): void {
  db.prepare(`
    INSERT OR REPLACE INTO themes (id, name, parent_id)
    VALUES (@id, @name, @parent_id)
  `).run(theme);
}

export function insertColor(db: Database.Database, color: ColorRow): void {
  db.prepare(`
    INSERT OR REPLACE INTO colors (id, name, rgb, is_trans)
    VALUES (@id, @name, @rgb, @is_trans)
  `).run(color);
}

export function insertPartCategory(db: Database.Database, cat: PartCategoryRow): void {
  db.prepare(`
    INSERT OR REPLACE INTO part_categories (id, name)
    VALUES (@id, @name)
  `).run(cat);
}

export function insertPart(db: Database.Database, part: PartRow): void {
  db.prepare(`
    INSERT OR REPLACE INTO parts (part_num, name, part_cat_id, part_material)
    VALUES (@part_num, @name, @part_cat_id, @part_material)
  `).run(part);
}

export function insertSet(db: Database.Database, set: SetRow): void {
  db.prepare(`
    INSERT OR REPLACE INTO sets (set_num, name, year, theme_id, num_parts, img_url)
    VALUES (@set_num, @name, @year, @theme_id, @num_parts, @img_url)
  `).run(set);
}

export function insertMinifig(db: Database.Database, fig: MinifigRow): void {
  db.prepare(`
    INSERT OR REPLACE INTO minifigs (fig_num, name, num_parts, img_url)
    VALUES (@fig_num, @name, @num_parts, @img_url)
  `).run(fig);
}

export function insertInventory(db: Database.Database, inv: InventoryRow): void {
  db.prepare(`
    INSERT OR REPLACE INTO inventories (id, set_num, version)
    VALUES (@id, @set_num, @version)
  `).run(inv);
}

export function insertInventoryPart(db: Database.Database, ip: InventoryPartRow): void {
  db.prepare(`
    INSERT INTO inventory_parts (inventory_id, part_num, color_id, quantity, is_spare)
    VALUES (@inventory_id, @part_num, @color_id, @quantity, @is_spare)
  `).run(ip);
}

export function insertInventorySet(db: Database.Database, is_: InventorySetRow): void {
  db.prepare(`
    INSERT INTO inventory_sets (inventory_id, set_num, quantity)
    VALUES (@inventory_id, @set_num, @quantity)
  `).run(is_);
}

export function insertInventoryMinifig(db: Database.Database, im: InventoryMinifigRow): void {
  db.prepare(`
    INSERT INTO inventory_minifigs (inventory_id, fig_num, quantity)
    VALUES (@inventory_id, @fig_num, @quantity)
  `).run(im);
}

export function insertPartRelationship(db: Database.Database, rel: PartRelationshipRow): void {
  db.prepare(`
    INSERT INTO part_relationships (rel_type, child_part_num, parent_part_num)
    VALUES (@rel_type, @child_part_num, @parent_part_num)
  `).run(rel);
}

// --- Read helpers ---

export function getSetByNum(db: Database.Database, setNum: string): SetRow | undefined {
  return db.prepare('SELECT * FROM sets WHERE set_num = ?').get(setNum) as SetRow | undefined;
}

export function getPartByNum(db: Database.Database, partNum: string): PartRow | undefined {
  return db.prepare('SELECT * FROM parts WHERE part_num = ?').get(partNum) as PartRow | undefined;
}

export function getMinifigByNum(db: Database.Database, figNum: string): MinifigRow | undefined {
  return db.prepare('SELECT * FROM minifigs WHERE fig_num = ?').get(figNum) as MinifigRow | undefined;
}

export function searchSets(db: Database.Database, query: string, limit: number = 20): SetRow[] {
  return db.prepare(`
    SELECT s.* FROM sets s
    JOIN sets_fts ON sets_fts.rowid = s.rowid
    WHERE sets_fts MATCH ?
    ORDER BY rank
    LIMIT ?
  `).all(query, limit) as SetRow[];
}

export function searchParts(db: Database.Database, query: string, limit: number = 20): PartRow[] {
  return db.prepare(`
    SELECT p.* FROM parts p
    JOIN parts_fts ON parts_fts.rowid = p.rowid
    WHERE parts_fts MATCH ?
    ORDER BY rank
    LIMIT ?
  `).all(query, limit) as PartRow[];
}

export function searchMinifigs(db: Database.Database, query: string, limit: number = 20): MinifigRow[] {
  return db.prepare(`
    SELECT m.* FROM minifigs m
    JOIN minifigs_fts ON minifigs_fts.rowid = m.rowid
    WHERE minifigs_fts MATCH ?
    ORDER BY rank
    LIMIT ?
  `).all(query, limit) as MinifigRow[];
}

/**
 * Get all table names in the database (excluding internal SQLite tables).
 */
export function getTableNames(db: Database.Database): string[] {
  const rows = db.prepare(
    "SELECT name FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY name"
  ).all() as Array<{ name: string }>;
  return rows.map(r => r.name);
}
