import { z } from 'zod';
import type Database from 'better-sqlite3';

// --- Input schema ---

export const FindPartInSetsInput = z.object({
  part_num: z.string().describe('Part number to search for'),
  color: z.string().optional().describe('Optional colour filter (name or ID)'),
  limit: z.number().min(1).max(50).optional().describe('Max results (default 25, max 50)'),
});

export type FindPartInSetsParams = z.infer<typeof FindPartInSetsInput>;

// --- Output types ---

export interface PartInSet {
  set_num: string;
  set_name: string;
  year: number | null;
  color_name: string;
  quantity: number;
}

export interface FindPartInSetsResult {
  part_num: string;
  sets: PartInSet[];
  total: number;
}

// --- Handler ---

export function handler(db: Database.Database, params: FindPartInSetsParams): FindPartInSetsResult {
  const limit = params.limit ?? 25;
  const conditions: string[] = ['ip.part_num = ?'];
  const bindings: unknown[] = [params.part_num];

  if (params.color) {
    const colorId = parseInt(params.color, 10);
    if (!isNaN(colorId)) {
      conditions.push('c.id = ?');
      bindings.push(colorId);
    } else {
      conditions.push('LOWER(c.name) = LOWER(?)');
      bindings.push(params.color);
    }
  }

  const sql = `
    SELECT s.set_num, s.name as set_name, s.year, c.name as color_name,
           SUM(ip.quantity) as quantity
    FROM inventory_parts ip
    JOIN inventories inv ON ip.inventory_id = inv.id
    JOIN sets s ON inv.set_num = s.set_num
    JOIN colors c ON ip.color_id = c.id
    WHERE ${conditions.join(' AND ')}
    GROUP BY s.set_num, c.name
    ORDER BY quantity DESC
    LIMIT ?
  `;
  bindings.push(limit);

  const rows = db.prepare(sql).all(...bindings) as PartInSet[];

  return {
    part_num: params.part_num,
    sets: rows,
    total: rows.length,
  };
}
