import { z } from 'zod';
import type Database from 'better-sqlite3';

// --- Input schema ---

export const GetSetInput = z.object({
  set_num: z.string().optional().describe('Exact set number (e.g. "75192-1")'),
  name: z.string().optional().describe('Set name for fuzzy search if set_num not provided'),
});

export type GetSetParams = z.infer<typeof GetSetInput>;

// --- Output types ---

export interface InventoryPartDetail {
  part_num: string;
  part_name: string;
  category_name: string | null;
  color_name: string | null;
  color_rgb: string | null;
  quantity: number;
  is_spare: number;
}

export interface MinifigSummary {
  fig_num: string;
  name: string;
  quantity: number;
}

export interface SetDetail {
  set_num: string;
  name: string;
  year: number | null;
  num_parts: number | null;
  img_url: string | null;
  theme_path: string[];
  inventory_parts: InventoryPartDetail[];
  minifigs: MinifigSummary[];
}

export type GetSetResult = {
  found: true;
  set: SetDetail;
} | {
  found: false;
  message: string;
  suggestions?: string[];
};

// --- Handler ---

export function handler(db: Database.Database, params: GetSetParams): GetSetResult {
  if (!params.set_num && !params.name) {
    return { found: false, message: 'Provide either set_num or name to look up a set.' };
  }

  let setRow: { set_num: string; name: string; year: number | null; num_parts: number | null; img_url: string | null; theme_id: number | null } | undefined;

  // 1. Exact set_num match
  if (params.set_num) {
    setRow = db.prepare('SELECT * FROM sets WHERE set_num = ?').get(params.set_num) as typeof setRow;
  }

  // 2. Name search via FTS5
  if (!setRow && params.name) {
    setRow = db.prepare(`
      SELECT s.* FROM sets_fts fts
      JOIN sets s ON s.rowid = fts.rowid
      WHERE sets_fts MATCH ?
      ORDER BY fts.rank
      LIMIT 1
    `).get(params.name) as typeof setRow;
  }

  // 3. Name LIKE fallback
  if (!setRow && params.name) {
    setRow = db.prepare(
      'SELECT * FROM sets WHERE LOWER(name) LIKE LOWER(?) LIMIT 1'
    ).get(`%${params.name}%`) as typeof setRow;
  }

  if (!setRow) {
    const searchTerm = params.set_num ?? params.name ?? '';
    const suggestions = db.prepare(
      'SELECT name, set_num FROM sets WHERE LOWER(name) LIKE LOWER(?) LIMIT 5'
    ).all(`%${searchTerm.split(' ')[0]}%`) as Array<{ name: string; set_num: string }>;

    return {
      found: false,
      message: `No set found matching "${searchTerm}"`,
      suggestions: suggestions.length > 0
        ? suggestions.map(s => `${s.set_num} (${s.name})`)
        : undefined,
    };
  }

  // Build theme path by walking parent_id chain
  const themePath = buildThemePath(db, setRow.theme_id);

  // Fetch inventory parts
  const inventoryParts = db.prepare(`
    SELECT ip.part_num, p.name as part_name, pc.name as category_name,
           c.name as color_name, c.rgb as color_rgb, ip.quantity, ip.is_spare
    FROM inventory_parts ip
    JOIN inventories inv ON ip.inventory_id = inv.id
    JOIN parts p ON ip.part_num = p.part_num
    LEFT JOIN part_categories pc ON p.part_cat_id = pc.id
    LEFT JOIN colors c ON ip.color_id = c.id
    WHERE inv.set_num = ?
    ORDER BY pc.name, p.name, c.name
  `).all(setRow.set_num) as InventoryPartDetail[];

  // Fetch minifigs
  const minifigs = db.prepare(`
    SELECT m.fig_num, m.name, im.quantity
    FROM inventory_minifigs im
    JOIN inventories inv ON im.inventory_id = inv.id
    JOIN minifigs m ON im.fig_num = m.fig_num
    WHERE inv.set_num = ?
    ORDER BY m.name
  `).all(setRow.set_num) as MinifigSummary[];

  return {
    found: true,
    set: {
      set_num: setRow.set_num,
      name: setRow.name,
      year: setRow.year,
      num_parts: setRow.num_parts,
      img_url: setRow.img_url,
      theme_path: themePath,
      inventory_parts: inventoryParts,
      minifigs,
    },
  };
}

function buildThemePath(db: Database.Database, themeId: number | null): string[] {
  if (themeId === null) return [];

  const path: string[] = [];
  let currentId: number | null = themeId;

  while (currentId !== null) {
    const theme = db.prepare('SELECT id, name, parent_id FROM themes WHERE id = ?').get(currentId) as {
      id: number; name: string; parent_id: number | null;
    } | undefined;

    if (!theme) break;
    path.unshift(theme.name);
    currentId = theme.parent_id;
  }

  return path;
}
