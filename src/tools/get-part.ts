import { z } from 'zod';
import type Database from 'better-sqlite3';

// --- Input schema ---

export const GetPartInput = z.object({
  part_num: z.string().describe('Part number to look up (e.g. "3001")'),
});

export type GetPartParams = z.infer<typeof GetPartInput>;

// --- Output types ---

export interface RelatedPart {
  rel_type: string;
  part_num: string;
  part_name: string | null;
}

export interface PartColorInfo {
  color_id: number;
  color_name: string;
  color_rgb: string | null;
}

export interface PartDetail {
  part_num: string;
  name: string;
  category_name: string | null;
  part_material: string | null;
  colors: PartColorInfo[];
  molds: RelatedPart[];
  prints: RelatedPart[];
  alternates: RelatedPart[];
}

export type GetPartResult = {
  found: true;
  part: PartDetail;
} | {
  found: false;
  message: string;
  suggestions?: string[];
};

// --- Handler ---

export function handler(db: Database.Database, params: GetPartParams): GetPartResult {
  const partRow = db.prepare(`
    SELECT p.part_num, p.name, pc.name as category_name, p.part_material
    FROM parts p
    LEFT JOIN part_categories pc ON p.part_cat_id = pc.id
    WHERE p.part_num = ?
  `).get(params.part_num) as {
    part_num: string; name: string; category_name: string | null; part_material: string | null;
  } | undefined;

  if (!partRow) {
    const suggestions = db.prepare(
      'SELECT part_num, name FROM parts WHERE part_num LIKE ? OR LOWER(name) LIKE LOWER(?) LIMIT 5'
    ).all(`${params.part_num}%`, `%${params.part_num}%`) as Array<{ part_num: string; name: string }>;

    return {
      found: false,
      message: `No part found with number "${params.part_num}"`,
      suggestions: suggestions.length > 0
        ? suggestions.map(s => `${s.part_num} (${s.name})`)
        : undefined,
    };
  }

  // Get available colours from inventory data
  const colors = db.prepare(`
    SELECT DISTINCT c.id as color_id, c.name as color_name, c.rgb as color_rgb
    FROM inventory_parts ip
    JOIN colors c ON ip.color_id = c.id
    WHERE ip.part_num = ?
    ORDER BY c.name
  `).all(params.part_num) as PartColorInfo[];

  // Get part relationships where this part is the parent
  const childRelations = db.prepare(`
    SELECT pr.rel_type, pr.child_part_num as part_num, p.name as part_name
    FROM part_relationships pr
    LEFT JOIN parts p ON pr.child_part_num = p.part_num
    WHERE pr.parent_part_num = ?
    ORDER BY pr.rel_type, pr.child_part_num
  `).all(params.part_num) as RelatedPart[];

  // Get part relationships where this part is the child
  const parentRelations = db.prepare(`
    SELECT pr.rel_type, pr.parent_part_num as part_num, p.name as part_name
    FROM part_relationships pr
    LEFT JOIN parts p ON pr.parent_part_num = p.part_num
    WHERE pr.child_part_num = ?
    ORDER BY pr.rel_type, pr.parent_part_num
  `).all(params.part_num) as RelatedPart[];

  const allRelations = [...childRelations, ...parentRelations];

  const molds = allRelations.filter(r => r.rel_type === 'M');
  const prints = allRelations.filter(r => r.rel_type === 'P');
  const alternates = allRelations.filter(r => r.rel_type === 'A' || r.rel_type === 'T');

  return {
    found: true,
    part: {
      part_num: partRow.part_num,
      name: partRow.name,
      category_name: partRow.category_name,
      part_material: partRow.part_material,
      colors,
      molds,
      prints,
      alternates,
    },
  };
}
