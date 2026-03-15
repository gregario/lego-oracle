import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { seedTestDatabase } from '../fixtures.js';
import { handler } from '../../src/tools/get-part.js';
import { formatGetPart } from '../../src/format.js';

describe('get_part', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = seedTestDatabase();
  });

  afterEach(() => {
    db.close();
  });

  describe('handler', () => {
    it('finds a part by exact part_num', () => {
      const result = handler(db, { part_num: '3001' });
      expect(result.found).toBe(true);
      if (!result.found) return;
      expect(result.part.name).toBe('Brick 2 x 4');
      expect(result.part.category_name).toBe('Bricks');
      expect(result.part.part_material).toBe('Plastic');
    });

    it('returns not found for unknown part', () => {
      const result = handler(db, { part_num: '99999' });
      expect(result.found).toBe(false);
      if (result.found) return;
      expect(result.message).toContain('99999');
    });

    it('includes available colours from inventory data', () => {
      const result = handler(db, { part_num: '3001' });
      expect(result.found).toBe(true);
      if (!result.found) return;
      expect(result.part.colors.length).toBeGreaterThan(0);
      const colorNames = result.part.colors.map(c => c.color_name);
      expect(colorNames).toContain('Black');
      expect(colorNames).toContain('White');
      expect(colorNames).toContain('Dark Red');
    });

    it('includes mold relationships', () => {
      const result = handler(db, { part_num: '3001' });
      expect(result.found).toBe(true);
      if (!result.found) return;
      expect(result.part.molds.length).toBeGreaterThan(0);
      const moldNums = result.part.molds.map(m => m.part_num);
      expect(moldNums).toContain('3001pr0001');
    });

    it('shows parent relationship from child side', () => {
      const result = handler(db, { part_num: '3001pr0001' });
      expect(result.found).toBe(true);
      if (!result.found) return;
      // The printed variant should show its parent mold
      expect(result.part.molds.length).toBeGreaterThan(0);
      const moldNums = result.part.molds.map(m => m.part_num);
      expect(moldNums).toContain('3001');
    });

    it('returns suggestions for partial match', () => {
      const result = handler(db, { part_num: '300' });
      expect(result.found).toBe(false);
      if (result.found) return;
      expect(result.suggestions).toBeDefined();
      expect(result.suggestions!.length).toBeGreaterThan(0);
    });
  });

  describe('formatter', () => {
    it('formats part details as markdown', () => {
      const result = handler(db, { part_num: '3001' });
      const text = formatGetPart(result);
      expect(text).toContain('# Brick 2 x 4');
      expect(text).toContain('3001');
      expect(text).toContain('Category: Bricks');
      expect(text).toContain('## Available Colours');
      expect(text).toContain('## Mold Variants');
      expect(text).toContain('3001pr0001');
    });

    it('formats not-found result', () => {
      const result = handler(db, { part_num: '99999' });
      const text = formatGetPart(result);
      expect(text).toContain('No part found');
    });
  });
});
