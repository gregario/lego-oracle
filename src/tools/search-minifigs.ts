import { z } from 'zod';
import type Database from 'better-sqlite3';

// --- Input schema ---

export const SearchMinifigsInput = z.object({
  query: z.string().describe('Free-text search (FTS5) across minifig names'),
  limit: z.number().min(1).max(50).optional().describe('Max results (default 25, max 50)'),
});

export type SearchMinifigsParams = z.infer<typeof SearchMinifigsInput>;

// --- Output types ---

export interface MinifigSummary {
  fig_num: string;
  name: string;
  num_parts: number | null;
}

export interface SearchMinifigsResult {
  minifigs: MinifigSummary[];
  total: number;
}

// --- Handler ---

export function handler(db: Database.Database, params: SearchMinifigsParams): SearchMinifigsResult {
  const limit = params.limit ?? 25;

  const rows = db.prepare(`
    SELECT m.fig_num, m.name, m.num_parts
    FROM minifigs_fts fts
    JOIN minifigs m ON m.rowid = fts.rowid
    WHERE minifigs_fts MATCH ?
    ORDER BY fts.rank
    LIMIT ?
  `).all(params.query, limit) as MinifigSummary[];

  return { minifigs: rows, total: rows.length };
}
