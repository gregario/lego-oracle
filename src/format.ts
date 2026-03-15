/**
 * Response formatters that convert raw tool results into readable text for LLMs.
 * Tools return formatted markdown text, not raw JSON.
 */

import type { SearchSetsResult } from './tools/search-sets.js';
import type { GetSetResult } from './tools/get-set.js';
import type { SearchPartsResult } from './tools/search-parts.js';
import type { GetPartResult } from './tools/get-part.js';
import type { FindPartInSetsResult } from './tools/find-part-in-sets.js';
import type { SearchMinifigsResult } from './tools/search-minifigs.js';
import type { GetMinifigResult } from './tools/get-minifig.js';

// --- Set tools ---

export function formatSearchSets(result: SearchSetsResult): string {
  if (result.sets.length === 0) {
    return 'No sets found matching your search criteria.';
  }

  const lines: string[] = [`Found ${result.total} set(s):\n`];

  for (const set of result.sets) {
    const yearPart = set.year ? ` (${set.year})` : '';
    const themePart = set.theme_name ? ` [${set.theme_name}]` : '';
    const partsPart = set.num_parts ? ` -- ${set.num_parts} parts` : '';
    lines.push(`- **${set.set_num}** ${set.name}${yearPart}${themePart}${partsPart}`);
  }

  return lines.join('\n');
}

export function formatGetSet(result: GetSetResult): string {
  if (!result.found) {
    let text = result.message;
    if (result.suggestions && result.suggestions.length > 0) {
      text += `\n\nDid you mean: ${result.suggestions.join(', ')}?`;
    }
    return text;
  }

  const set = result.set;
  const lines: string[] = [];

  // Header
  lines.push(`# ${set.name}`);
  lines.push(`Set number: ${set.set_num}`);

  // Metadata
  const meta: string[] = [];
  if (set.year) meta.push(`Year: ${set.year}`);
  if (set.num_parts) meta.push(`Parts: ${set.num_parts}`);
  if (set.theme_path.length > 0) meta.push(`Theme: ${set.theme_path.join(' > ')}`);
  if (meta.length > 0) {
    lines.push(meta.join(' | '));
  }

  if (set.img_url) {
    lines.push(`Image: ${set.img_url}`);
  }

  // Inventory parts grouped by category
  if (set.inventory_parts.length > 0) {
    lines.push('\n## Parts');

    const byCategory = new Map<string, typeof set.inventory_parts>();
    for (const part of set.inventory_parts) {
      const cat = part.category_name ?? 'Uncategorized';
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat)!.push(part);
    }

    for (const [category, parts] of byCategory) {
      lines.push(`\n### ${category}`);
      for (const part of parts) {
        const colorPart = part.color_name ? ` (${part.color_name})` : '';
        const sparePart = part.is_spare ? ' [spare]' : '';
        lines.push(`- ${part.quantity}x ${part.part_num} ${part.part_name}${colorPart}${sparePart}`);
      }
    }
  }

  // Minifigs
  if (set.minifigs.length > 0) {
    lines.push('\n## Minifigures');
    for (const fig of set.minifigs) {
      lines.push(`- ${fig.quantity}x ${fig.fig_num} ${fig.name}`);
    }
  }

  return lines.join('\n');
}

// --- Part tools ---

export function formatSearchParts(result: SearchPartsResult): string {
  if (result.parts.length === 0) {
    return 'No parts found matching your search criteria.';
  }

  const lines: string[] = [`Found ${result.total} part(s):\n`];

  for (const part of result.parts) {
    const catPart = part.category_name ? ` [${part.category_name}]` : '';
    const matPart = part.part_material ? ` (${part.part_material})` : '';
    lines.push(`- **${part.part_num}** ${part.name}${catPart}${matPart}`);
  }

  return lines.join('\n');
}

export function formatGetPart(result: GetPartResult): string {
  if (!result.found) {
    let text = result.message;
    if (result.suggestions && result.suggestions.length > 0) {
      text += `\n\nDid you mean: ${result.suggestions.join(', ')}?`;
    }
    return text;
  }

  const part = result.part;
  const lines: string[] = [];

  // Header
  lines.push(`# ${part.name}`);
  lines.push(`Part number: ${part.part_num}`);

  const meta: string[] = [];
  if (part.category_name) meta.push(`Category: ${part.category_name}`);
  if (part.part_material) meta.push(`Material: ${part.part_material}`);
  if (meta.length > 0) {
    lines.push(meta.join(' | '));
  }

  // Available colours
  if (part.colors.length > 0) {
    lines.push('\n## Available Colours');
    for (const c of part.colors) {
      const rgbPart = c.color_rgb ? ` #${c.color_rgb}` : '';
      lines.push(`- ${c.color_name}${rgbPart}`);
    }
  }

  // Related parts
  if (part.molds.length > 0) {
    lines.push('\n## Mold Variants');
    for (const r of part.molds) {
      lines.push(`- ${r.part_num}${r.part_name ? ` (${r.part_name})` : ''}`);
    }
  }

  if (part.prints.length > 0) {
    lines.push('\n## Printed Variants');
    for (const r of part.prints) {
      lines.push(`- ${r.part_num}${r.part_name ? ` (${r.part_name})` : ''}`);
    }
  }

  if (part.alternates.length > 0) {
    lines.push('\n## Alternates');
    for (const r of part.alternates) {
      lines.push(`- ${r.part_num}${r.part_name ? ` (${r.part_name})` : ''}`);
    }
  }

  return lines.join('\n');
}

export function formatFindPartInSets(result: FindPartInSetsResult): string {
  if (result.sets.length === 0) {
    return `Part ${result.part_num} was not found in any sets.`;
  }

  const lines: string[] = [`Part ${result.part_num} appears in ${result.total} set(s):\n`];

  for (const entry of result.sets) {
    const yearPart = entry.year ? ` (${entry.year})` : '';
    lines.push(`- ${entry.quantity}x in **${entry.set_num}** ${entry.set_name}${yearPart} [${entry.color_name}]`);
  }

  return lines.join('\n');
}

// --- Minifig tools ---

export function formatSearchMinifigs(result: SearchMinifigsResult): string {
  if (result.minifigs.length === 0) {
    return 'No minifigures found matching your search criteria.';
  }

  const lines: string[] = [`Found ${result.total} minifigure(s):\n`];

  for (const fig of result.minifigs) {
    const partsPart = fig.num_parts ? ` (${fig.num_parts} parts)` : '';
    lines.push(`- **${fig.fig_num}** ${fig.name}${partsPart}`);
  }

  return lines.join('\n');
}

export function formatGetMinifig(result: GetMinifigResult): string {
  if (!result.found) {
    let text = result.message;
    if (result.suggestions && result.suggestions.length > 0) {
      text += `\n\nDid you mean: ${result.suggestions.join(', ')}?`;
    }
    return text;
  }

  const fig = result.minifig;
  const lines: string[] = [];

  // Header
  lines.push(`# ${fig.name}`);
  lines.push(`Figure number: ${fig.fig_num}`);

  if (fig.num_parts) {
    lines.push(`Parts: ${fig.num_parts}`);
  }

  if (fig.img_url) {
    lines.push(`Image: ${fig.img_url}`);
  }

  // Sets this minifig appears in
  if (fig.sets.length > 0) {
    lines.push(`\n## Appears in ${fig.sets.length} set(s)`);
    for (const set of fig.sets) {
      const yearPart = set.year ? ` (${set.year})` : '';
      const themePart = set.theme_name ? ` [${set.theme_name}]` : '';
      lines.push(`- ${set.quantity}x in **${set.set_num}** ${set.set_name}${yearPart}${themePart}`);
    }
  } else {
    lines.push('\nThis minifigure does not appear in any sets.');
  }

  return lines.join('\n');
}
