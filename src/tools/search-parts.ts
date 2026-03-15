import { z } from 'zod';
import type Database from 'better-sqlite3';

// --- Input schema ---

export const SearchPartsInput = z.object({
  query: z.string().optional().describe('Free-text search (FTS5) across part names'),
  category: z.string().optional().describe('Filter by part category name'),
  color: z.string().optional().describe('Filter by colour name or ID (finds parts available in this colour)'),
  material: z.string().optional().describe('Filter by part material (e.g. "Plastic", "Rubber")'),
  limit: z.number().min(1).max(50).optional().describe('Max results (default 25, max 50)'),
});

export type SearchPartsParams = z.infer<typeof SearchPartsInput>;

// --- Output types ---

export interface PartSummary {
  part_num: string;
  name: string;
  category_name: string | null;
  part_material: string | null;
}

export interface SearchPartsResult {
  parts: PartSummary[];
  total: number;
}

// --- Handler ---

export function handler(db: Database.Database, params: SearchPartsParams): SearchPartsResult {
  const limit = params.limit ?? 25;
  const conditions: string[] = [];
  const bindings: unknown[] = [];
  const joins: string[] = ['LEFT JOIN part_categories pc ON p.part_cat_id = pc.id'];

  let usesFts = false;
  if (params.query) {
    usesFts = true;
  }

  if (params.category) {
    conditions.push('LOWER(pc.name) = LOWER(?)');
    bindings.push(params.category);
  }

  if (params.material) {
    conditions.push('LOWER(p.part_material) = LOWER(?)');
    bindings.push(params.material);
  }

  // Colour filter: find parts that exist in inventory_parts with this colour
  let colorJoin = '';
  if (params.color) {
    const colorId = parseInt(params.color, 10);
    if (!isNaN(colorId)) {
      colorJoin = 'JOIN inventory_parts ip ON ip.part_num = p.part_num JOIN colors c ON ip.color_id = c.id';
      conditions.push('c.id = ?');
      bindings.push(colorId);
    } else {
      colorJoin = 'JOIN inventory_parts ip ON ip.part_num = p.part_num JOIN colors c ON ip.color_id = c.id';
      conditions.push('LOWER(c.name) = LOWER(?)');
      bindings.push(params.color);
    }
  }

  let sql: string;
  const allBindings: unknown[] = [];

  if (usesFts) {
    sql = `SELECT DISTINCT p.part_num, p.name, pc.name as category_name, p.part_material
           FROM parts_fts fts
           JOIN parts p ON p.rowid = fts.rowid
           ${joins.join(' ')}
           ${colorJoin}
           WHERE parts_fts MATCH ?`;
    allBindings.push(params.query!);
    for (const cond of conditions) {
      sql += ` AND ${cond}`;
    }
    allBindings.push(...bindings);
    sql += ' ORDER BY fts.rank LIMIT ?';
  } else {
    sql = `SELECT DISTINCT p.part_num, p.name, pc.name as category_name, p.part_material
           FROM parts p
           ${joins.join(' ')}
           ${colorJoin}`;
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
      allBindings.push(...bindings);
    }
    sql += ' ORDER BY p.name LIMIT ?';
  }
  allBindings.push(limit);

  const rows = db.prepare(sql).all(...allBindings) as PartSummary[];

  return { parts: rows, total: rows.length };
}
