import { z } from 'zod';
import type Database from 'better-sqlite3';

// --- Input schema ---

export const CompareSetsInput = z.object({
  set_nums: z.array(z.string()).min(2).max(4).describe(
    'Array of 2-4 LEGO set numbers to compare side by side'
  ),
});

export type CompareSetsParams = z.infer<typeof CompareSetsInput>;

// --- Output types ---

export interface SetComparison {
  set_num: string;
  found: boolean;
  name: string | null;
  year: number | null;
  theme: string | null;
  num_parts: number | null;
  minifig_count: number;
}

export interface CompareSetsResult {
  sets: SetComparison[];
  shared_parts_count: number;
  shared_parts: Array<{ part_num: string; name: string }>;
}

// --- Handler ---

export function handler(db: Database.Database, params: CompareSetsParams): CompareSetsResult {
  const setNums = params.set_nums;
  const sets: SetComparison[] = [];

  for (const setNum of setNums) {
    const row = db.prepare(`
      SELECT s.set_num, s.name, s.year, s.num_parts, t.name AS theme_name
      FROM sets s
      LEFT JOIN themes t ON s.theme_id = t.id
      WHERE s.set_num = ?
    `).get(setNum) as { set_num: string; name: string; year: number | null; num_parts: number | null; theme_name: string | null } | undefined;

    if (!row) {
      sets.push({
        set_num: setNum,
        found: false,
        name: null,
        year: null,
        theme: null,
        num_parts: null,
        minifig_count: 0,
      });
      continue;
    }

    // Count minifigs
    const minifigCount = (db.prepare(`
      SELECT COALESCE(SUM(im.quantity), 0) AS cnt
      FROM inventory_minifigs im
      JOIN inventories inv ON im.inventory_id = inv.id
      WHERE inv.set_num = ?
    `).get(setNum) as { cnt: number }).cnt;

    sets.push({
      set_num: setNum,
      found: true,
      name: row.name,
      year: row.year,
      theme: row.theme_name,
      num_parts: row.num_parts,
      minifig_count: minifigCount,
    });
  }

  // Find shared parts: parts that appear in ALL compared sets (only among found sets)
  const foundSetNums = sets.filter(s => s.found).map(s => s.set_num);
  let sharedParts: Array<{ part_num: string; name: string }> = [];

  if (foundSetNums.length >= 2) {
    // For each set, get the distinct part_nums from its inventories
    // Then find the intersection across all sets
    const placeholders = foundSetNums.map(() => '?').join(', ');
    const numSets = foundSetNums.length;

    sharedParts = db.prepare(`
      SELECT ip.part_num, p.name
      FROM inventory_parts ip
      JOIN inventories inv ON ip.inventory_id = inv.id
      JOIN parts p ON ip.part_num = p.part_num
      WHERE inv.set_num IN (${placeholders})
      GROUP BY ip.part_num
      HAVING COUNT(DISTINCT inv.set_num) = ?
      ORDER BY p.name
      LIMIT 50
    `).all(...foundSetNums, numSets) as Array<{ part_num: string; name: string }>;
  }

  return {
    sets,
    shared_parts_count: sharedParts.length,
    shared_parts: sharedParts,
  };
}

// --- Formatter ---

export function formatCompareSets(result: CompareSetsResult): string {
  const lines: string[] = [];

  lines.push(`# Set Comparison (${result.sets.length} sets)\n`);

  // Table header
  lines.push('| | ' + result.sets.map(s => s.found ? `**${s.name}**` : `~~${s.set_num}~~`).join(' | ') + ' |');
  lines.push('|---|' + result.sets.map(() => '---').join('|') + '|');

  // Set number row
  lines.push('| Set # | ' + result.sets.map(s => s.set_num).join(' | ') + ' |');

  // Year row
  lines.push('| Year | ' + result.sets.map(s => s.found ? String(s.year ?? 'N/A') : 'Not found').join(' | ') + ' |');

  // Theme row
  lines.push('| Theme | ' + result.sets.map(s => s.found ? (s.theme ?? 'N/A') : '-').join(' | ') + ' |');

  // Parts row
  lines.push('| Parts | ' + result.sets.map(s => s.found ? String(s.num_parts ?? 'N/A') : '-').join(' | ') + ' |');

  // Minifigs row
  lines.push('| Minifigs | ' + result.sets.map(s => s.found ? String(s.minifig_count) : '-').join(' | ') + ' |');

  // Not-found notice
  const notFound = result.sets.filter(s => !s.found);
  if (notFound.length > 0) {
    lines.push('');
    lines.push(`**Not found:** ${notFound.map(s => s.set_num).join(', ')}`);
  }

  // Shared parts
  lines.push('');
  if (result.shared_parts_count > 0) {
    lines.push(`## Shared Parts (${result.shared_parts_count})\n`);
    for (const p of result.shared_parts) {
      lines.push(`- ${p.name} (${p.part_num})`);
    }
  } else {
    const foundCount = result.sets.filter(s => s.found).length;
    if (foundCount >= 2) {
      lines.push('No shared parts found between these sets.');
    }
  }

  return lines.join('\n');
}
