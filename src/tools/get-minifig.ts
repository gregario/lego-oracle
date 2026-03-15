import { z } from 'zod';
import type Database from 'better-sqlite3';

// --- Input schema ---

export const GetMinifigInput = z.object({
  fig_num: z.string().optional().describe('Exact minifig number (e.g. "fig-000100")'),
  name: z.string().optional().describe('Minifig name for fuzzy search if fig_num not provided'),
});

export type GetMinifigParams = z.infer<typeof GetMinifigInput>;

// --- Output types ---

export interface MinifigSetAppearance {
  set_num: string;
  set_name: string;
  year: number | null;
  theme_name: string | null;
  quantity: number;
}

export interface MinifigDetail {
  fig_num: string;
  name: string;
  num_parts: number | null;
  img_url: string | null;
  sets: MinifigSetAppearance[];
}

export type GetMinifigResult = {
  found: true;
  minifig: MinifigDetail;
} | {
  found: false;
  message: string;
  suggestions?: string[];
};

// --- Handler ---

export function handler(db: Database.Database, params: GetMinifigParams): GetMinifigResult {
  if (!params.fig_num && !params.name) {
    return { found: false, message: 'Provide either fig_num or name to look up a minifig.' };
  }

  let figRow: { fig_num: string; name: string; num_parts: number | null; img_url: string | null } | undefined;

  // 1. Exact fig_num match
  if (params.fig_num) {
    figRow = db.prepare('SELECT * FROM minifigs WHERE fig_num = ?').get(params.fig_num) as typeof figRow;
  }

  // 2. FTS5 name search
  if (!figRow && params.name) {
    figRow = db.prepare(`
      SELECT m.* FROM minifigs_fts fts
      JOIN minifigs m ON m.rowid = fts.rowid
      WHERE minifigs_fts MATCH ?
      ORDER BY fts.rank
      LIMIT 1
    `).get(params.name) as typeof figRow;
  }

  // 3. LIKE fallback
  if (!figRow && params.name) {
    figRow = db.prepare(
      'SELECT * FROM minifigs WHERE LOWER(name) LIKE LOWER(?) LIMIT 1'
    ).get(`%${params.name}%`) as typeof figRow;
  }

  if (!figRow) {
    const searchTerm = params.fig_num ?? params.name ?? '';
    const suggestions = db.prepare(
      'SELECT fig_num, name FROM minifigs WHERE LOWER(name) LIKE LOWER(?) LIMIT 5'
    ).all(`%${searchTerm.split(' ')[0]}%`) as Array<{ fig_num: string; name: string }>;

    return {
      found: false,
      message: `No minifig found matching "${searchTerm}"`,
      suggestions: suggestions.length > 0
        ? suggestions.map(s => `${s.fig_num} (${s.name})`)
        : undefined,
    };
  }

  // Fetch all sets this minifig appears in
  const sets = db.prepare(`
    SELECT s.set_num, s.name as set_name, s.year, t.name as theme_name, im.quantity
    FROM inventory_minifigs im
    JOIN inventories inv ON im.inventory_id = inv.id
    JOIN sets s ON inv.set_num = s.set_num
    LEFT JOIN themes t ON s.theme_id = t.id
    WHERE im.fig_num = ?
    ORDER BY s.year DESC, s.name
  `).all(figRow.fig_num) as MinifigSetAppearance[];

  return {
    found: true,
    minifig: {
      fig_num: figRow.fig_num,
      name: figRow.name,
      num_parts: figRow.num_parts,
      img_url: figRow.img_url,
      sets,
    },
  };
}
