import { z } from 'zod';
import type Database from 'better-sqlite3';

// --- Input schema ---

export const BrowseThemesInput = z.object({
  theme: z.string().optional().describe(
    'Theme name or numeric ID. Omit to list all top-level themes with set counts.'
  ),
});

export type BrowseThemesParams = z.infer<typeof BrowseThemesInput>;

// --- Output types ---

export interface ThemeSummary {
  id: number;
  name: string;
  set_count: number;
  sub_theme_count: number;
}

export interface BrowseThemesResult {
  theme_name: string | null;
  themes: ThemeSummary[];
  direct_set_count: number;
  total_set_count: number;
}

// --- Handler ---

export function handler(db: Database.Database, params: BrowseThemesParams): BrowseThemesResult {
  if (!params.theme) {
    return browseTopLevel(db);
  }
  return browseTheme(db, params.theme);
}

function browseTopLevel(db: Database.Database): BrowseThemesResult {
  // Get all top-level themes with recursive set counts
  const themes = db.prepare(`
    WITH RECURSIVE theme_tree AS (
      SELECT id, id AS root_id FROM themes WHERE parent_id IS NULL
      UNION ALL
      SELECT t.id, tt.root_id
      FROM themes t
      JOIN theme_tree tt ON t.parent_id = tt.id
    )
    SELECT
      th.id,
      th.name,
      COALESCE(counts.set_count, 0) AS set_count,
      COALESCE(sub.sub_count, 0) AS sub_theme_count
    FROM themes th
    LEFT JOIN (
      SELECT tt.root_id, COUNT(s.set_num) AS set_count
      FROM theme_tree tt
      JOIN sets s ON s.theme_id = tt.id
      GROUP BY tt.root_id
    ) counts ON counts.root_id = th.id
    LEFT JOIN (
      SELECT parent_id, COUNT(*) AS sub_count
      FROM themes
      WHERE parent_id IS NOT NULL
      GROUP BY parent_id
    ) sub ON sub.parent_id = th.id
    WHERE th.parent_id IS NULL
    ORDER BY COALESCE(counts.set_count, 0) DESC, th.name
  `).all() as Array<{ id: number; name: string; set_count: number; sub_theme_count: number }>;

  const totalSets = themes.reduce((sum, t) => sum + t.set_count, 0);

  return {
    theme_name: null,
    themes: themes.map(t => ({
      id: t.id,
      name: t.name,
      set_count: t.set_count,
      sub_theme_count: t.sub_theme_count,
    })),
    direct_set_count: 0,
    total_set_count: totalSets,
  };
}

function browseTheme(db: Database.Database, themeQuery: string): BrowseThemesResult {
  // Try numeric ID first, then name match
  let themeRow: { id: number; name: string } | undefined;

  const numericId = Number(themeQuery);
  if (!Number.isNaN(numericId) && String(numericId) === themeQuery) {
    themeRow = db.prepare('SELECT id, name FROM themes WHERE id = ?').get(numericId) as typeof themeRow;
  }

  if (!themeRow) {
    // Case-insensitive name match
    themeRow = db.prepare('SELECT id, name FROM themes WHERE LOWER(name) = LOWER(?)').get(themeQuery) as typeof themeRow;
  }

  if (!themeRow) {
    // Partial name match
    themeRow = db.prepare('SELECT id, name FROM themes WHERE LOWER(name) LIKE LOWER(?)').get(`%${themeQuery}%`) as typeof themeRow;
  }

  if (!themeRow) {
    return {
      theme_name: null,
      themes: [],
      direct_set_count: 0,
      total_set_count: 0,
    };
  }

  const themeId = themeRow.id;

  // Direct sets in this theme
  const directCount = (db.prepare(
    'SELECT COUNT(*) AS cnt FROM sets WHERE theme_id = ?'
  ).get(themeId) as { cnt: number }).cnt;

  // Sub-themes with their recursive set counts
  const subThemes = db.prepare(`
    WITH RECURSIVE sub_tree AS (
      SELECT id FROM themes WHERE id = ?
      UNION ALL
      SELECT t.id FROM themes t JOIN sub_tree st ON t.parent_id = st.id
    )
    SELECT
      th.id,
      th.name,
      COALESCE(counts.set_count, 0) AS set_count,
      COALESCE(sub.sub_count, 0) AS sub_theme_count
    FROM themes th
    LEFT JOIN (
      WITH RECURSIVE child_tree AS (
        SELECT id, id AS root_id FROM themes
        UNION ALL
        SELECT t.id, ct.root_id FROM themes t JOIN child_tree ct ON t.parent_id = ct.id
      )
      SELECT ct.root_id, COUNT(s.set_num) AS set_count
      FROM child_tree ct
      JOIN sets s ON s.theme_id = ct.id
      GROUP BY ct.root_id
    ) counts ON counts.root_id = th.id
    LEFT JOIN (
      SELECT parent_id, COUNT(*) AS sub_count
      FROM themes
      WHERE parent_id IS NOT NULL
      GROUP BY parent_id
    ) sub ON sub.parent_id = th.id
    WHERE th.parent_id = ?
    ORDER BY COALESCE(counts.set_count, 0) DESC, th.name
  `).all(themeId, themeId) as Array<{ id: number; name: string; set_count: number; sub_theme_count: number }>;

  // Total sets in theme + all sub-themes
  const totalSets = (db.prepare(`
    WITH RECURSIVE sub_tree AS (
      SELECT id FROM themes WHERE id = ?
      UNION ALL
      SELECT t.id FROM themes t JOIN sub_tree st ON t.parent_id = st.id
    )
    SELECT COUNT(*) AS cnt FROM sets WHERE theme_id IN (SELECT id FROM sub_tree)
  `).get(themeId) as { cnt: number }).cnt;

  return {
    theme_name: themeRow.name,
    themes: subThemes.map(t => ({
      id: t.id,
      name: t.name,
      set_count: t.set_count,
      sub_theme_count: t.sub_theme_count,
    })),
    direct_set_count: directCount,
    total_set_count: totalSets,
  };
}

// --- Formatter ---

export function formatBrowseThemes(result: BrowseThemesResult): string {
  if (result.theme_name === null && result.themes.length === 0) {
    return 'No themes found.';
  }

  const lines: string[] = [];

  if (result.theme_name === null) {
    // Top-level listing
    lines.push(`# LEGO Themes (${result.themes.length} top-level themes, ${result.total_set_count} total sets)\n`);
    for (const t of result.themes) {
      const sub = t.sub_theme_count > 0 ? ` (${t.sub_theme_count} sub-themes)` : '';
      lines.push(`- **${t.name}** (ID: ${t.id}): ${t.set_count} sets${sub}`);
    }
  } else {
    // Specific theme
    lines.push(`# ${result.theme_name}\n`);
    lines.push(`Total sets (including sub-themes): ${result.total_set_count}`);
    lines.push(`Direct sets: ${result.direct_set_count}\n`);

    if (result.themes.length > 0) {
      lines.push(`## Sub-themes (${result.themes.length})\n`);
      for (const t of result.themes) {
        const sub = t.sub_theme_count > 0 ? ` (${t.sub_theme_count} sub-themes)` : '';
        lines.push(`- **${t.name}** (ID: ${t.id}): ${t.set_count} sets${sub}`);
      }
    } else {
      lines.push('No sub-themes.');
    }
  }

  return lines.join('\n');
}
