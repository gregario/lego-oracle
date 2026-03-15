import { z } from 'zod';
import type Database from 'better-sqlite3';

// --- Input schema ---

export const FindMocsInput = z.object({
  set_num: z.string().describe('LEGO set number (e.g. "75192-1" for the Millennium Falcon)'),
});

export type FindMocsParams = z.infer<typeof FindMocsInput>;

// --- Output types ---

export interface MocSummary {
  moc_set_num: string;
  name: string;
  num_parts: number;
}

export interface FindMocsResult {
  set_num: string;
  set_name: string | null;
  mocs: MocSummary[];
  moc_data_available: boolean;
}

// --- Handler ---

export function handler(db: Database.Database, params: FindMocsParams): FindMocsResult {
  const setNum = params.set_num;

  // Look up the set name
  const setRow = db.prepare('SELECT name FROM sets WHERE set_num = ?').get(setNum) as { name: string } | undefined;

  // Check if the mocs table exists (it may not be in the schema yet)
  const mocsTableExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='mocs'"
  ).get() as { name: string } | undefined;

  if (!mocsTableExists) {
    return {
      set_num: setNum,
      set_name: setRow?.name ?? null,
      mocs: [],
      moc_data_available: false,
    };
  }

  // Check if the mocs table has any data
  const mocCount = (db.prepare('SELECT COUNT(*) AS cnt FROM mocs').get() as { cnt: number }).cnt;

  if (mocCount === 0) {
    return {
      set_num: setNum,
      set_name: setRow?.name ?? null,
      mocs: [],
      moc_data_available: false,
    };
  }

  // Query MOCs for this set
  const mocs = db.prepare(`
    SELECT set_num AS moc_set_num, name, num_parts
    FROM mocs
    WHERE set_num IN (
      SELECT moc_set_num FROM moc_parts WHERE set_num = ?
    )
    ORDER BY num_parts DESC
  `).all(setNum) as MocSummary[];

  return {
    set_num: setNum,
    set_name: setRow?.name ?? null,
    mocs,
    moc_data_available: true,
  };
}

// --- Formatter ---

export function formatFindMocs(result: FindMocsResult): string {
  const lines: string[] = [];
  const setLabel = result.set_name
    ? `${result.set_name} (${result.set_num})`
    : result.set_num;

  if (!result.moc_data_available) {
    lines.push(`# Alternate Builds for ${setLabel}\n`);
    lines.push('No MOC data available in this database.');
    lines.push(`Visit https://rebrickable.com/sets/${result.set_num}/mocs/ for community alternate builds.`);
    return lines.join('\n');
  }

  if (result.mocs.length === 0) {
    lines.push(`# Alternate Builds for ${setLabel}\n`);
    lines.push('No alternate builds (MOCs) found for this set.');
    lines.push(`Check https://rebrickable.com/sets/${result.set_num}/mocs/ for the latest community contributions.`);
    return lines.join('\n');
  }

  lines.push(`# Alternate Builds for ${setLabel} (${result.mocs.length} found)\n`);
  for (const moc of result.mocs) {
    lines.push(`- **${moc.name}** (${moc.moc_set_num}): ${moc.num_parts} parts`);
  }

  return lines.join('\n');
}
