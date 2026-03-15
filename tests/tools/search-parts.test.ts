import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { seedTestDatabase } from '../fixtures.js';
import { handler } from '../../src/tools/search-parts.js';
import { formatSearchParts } from '../../src/format.js';

describe('search_parts', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = seedTestDatabase();
  });

  afterEach(() => {
    db.close();
  });

  describe('handler', () => {
    it('searches parts by name via FTS5', () => {
      const result = handler(db, { query: 'Brick' });
      expect(result.parts.length).toBeGreaterThanOrEqual(2);
      const partNums = result.parts.map(p => p.part_num);
      expect(partNums).toContain('3001');
      expect(partNums).toContain('3010');
    });

    it('searches for plates', () => {
      const result = handler(db, { query: 'Plate' });
      expect(result.parts.length).toBeGreaterThanOrEqual(2);
      const partNums = result.parts.map(p => p.part_num);
      expect(partNums).toContain('3023');
      expect(partNums).toContain('3710');
    });

    it('filters by category', () => {
      const result = handler(db, { category: 'Plates' });
      expect(result.parts).toHaveLength(2);
      for (const part of result.parts) {
        expect(part.category_name).toBe('Plates');
      }
    });

    it('filters by colour name', () => {
      const result = handler(db, { color: 'Black' });
      expect(result.parts.length).toBeGreaterThan(0);
      // Parts 3001, 3023, 3710 appear in Black in fixtures
      const partNums = result.parts.map(p => p.part_num);
      expect(partNums).toContain('3001');
    });

    it('filters by colour ID', () => {
      const result = handler(db, { color: '0' }); // Black = 0
      expect(result.parts.length).toBeGreaterThan(0);
    });

    it('filters by material', () => {
      const result = handler(db, { material: 'Plastic' });
      expect(result.parts.length).toBeGreaterThan(0);
      for (const part of result.parts) {
        expect(part.part_material).toBe('Plastic');
      }
    });

    it('combines FTS5 query with category filter', () => {
      const result = handler(db, { query: 'Brick', category: 'Bricks' });
      expect(result.parts.length).toBeGreaterThanOrEqual(2);
      for (const part of result.parts) {
        expect(part.category_name).toBe('Bricks');
      }
    });

    it('returns empty for no match', () => {
      const result = handler(db, { query: 'xyznonexistent' });
      expect(result.parts).toHaveLength(0);
    });

    it('respects limit', () => {
      const result = handler(db, { query: 'Brick', limit: 1 });
      expect(result.parts).toHaveLength(1);
    });
  });

  describe('formatter', () => {
    it('formats part results as markdown', () => {
      const result = handler(db, { query: 'Brick' });
      const text = formatSearchParts(result);
      expect(text).toContain('Found');
      expect(text).toContain('part(s)');
      expect(text).toContain('**3001**');
      expect(text).toContain('Brick 2 x 4');
    });

    it('formats empty results', () => {
      const result = handler(db, { query: 'xyznonexistent' });
      const text = formatSearchParts(result);
      expect(text).toContain('No parts found');
    });
  });
});
