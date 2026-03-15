import { z } from 'zod';
import type Database from 'better-sqlite3';

// --- Input schema ---

export const SearchSetsInput = z.object({
  query: z.string().optional().describe('Free-text search (FTS5) across set names'),
  theme: z.string().optional().describe('Filter by theme name (includes sub-themes recursively)'),
  year_min: z.number().optional().describe('Minimum release year (inclusive)'),
  year_max: z.number().optional().describe('Maximum release year (inclusive)'),
  min_parts: z.number().optional().describe('Minimum piece count (inclusive)'),
  max_parts: z.number().optional().describe('Maximum piece count (inclusive)'),
  limit: z.number().min(1).max(50).optional().describe('Max results (default 25, max 50)'),
});

export type SearchSetsParams = z.infer<typeof SearchSetsInput>;

// --- Output types ---

export interface SetSummary {
  set_num: string;
  name: string;
  year: number | null;
  theme_name: string | null;
  num_parts: number | null;
}

export interface SearchSetsResult {
  sets: SetSummary[];
  total: number;
}

// --- Handler ---

export function handler(db: Database.Database, params: SearchSetsParams): SearchSetsResult {
  const limit = params.limit ?? 25;
  const conditions: string[] = [];
  const allBindings: unknown[] = [];

  // Theme filter with recursive CTE for sub-themes
  let themeCte = '';
  if (params.theme) {
    themeCte = `
      WITH RECURSIVE theme_tree(id) AS (
        SELECT t.id FROM themes t WHERE LOWER(t.name) = LOWER(?)
        UNION ALL
        SELECT t2.id FROM themes t2
        JOIN theme_tree tt ON t2.parent_id = tt.id
      )
    `;
    allBindings.push(params.theme);
    conditions.push('s.theme_id IN (SELECT id FROM theme_tree)');
  }

  // FTS5 query
  const usesFts = Boolean(params.query);

  if (usesFts) {
    allBindings.push(params.query!);
  }

  if (params.year_min !== undefined) {
    conditions.push('s.year >= ?');
    allBindings.push(params.year_min);
  }

  if (params.year_max !== undefined) {
    conditions.push('s.year <= ?');
    allBindings.push(params.year_max);
  }

  if (params.min_parts !== undefined) {
    conditions.push('s.num_parts >= ?');
    allBindings.push(params.min_parts);
  }

  if (params.max_parts !== undefined) {
    conditions.push('s.num_parts <= ?');
    allBindings.push(params.max_parts);
  }

  let sql: string;

  if (usesFts) {
    sql = `${themeCte}
      SELECT s.set_num, s.name, s.year, t.name as theme_name, s.num_parts
      FROM sets_fts fts
      JOIN sets s ON s.rowid = fts.rowid
      LEFT JOIN themes t ON s.theme_id = t.id
      WHERE sets_fts MATCH ?`;

    for (const cond of conditions) {
      sql += ` AND ${cond}`;
    }

    sql += ' ORDER BY fts.rank LIMIT ?';
  } else {
    sql = `${themeCte}
      SELECT s.set_num, s.name, s.year, t.name as theme_name, s.num_parts
      FROM sets s
      LEFT JOIN themes t ON s.theme_id = t.id`;

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY s.year DESC, s.name LIMIT ?';
  }
  allBindings.push(limit);

  const rows = db.prepare(sql).all(...allBindings) as SetSummary[];

  return { sets: rows, total: rows.length };
}
