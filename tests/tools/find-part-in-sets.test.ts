import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { seedTestDatabase } from '../fixtures.js';
import { handler } from '../../src/tools/find-part-in-sets.js';
import { formatFindPartInSets } from '../../src/format.js';

describe('find_part_in_sets', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = seedTestDatabase();
  });

  afterEach(() => {
    db.close();
  });

  describe('handler', () => {
    it('finds all sets containing a part', () => {
      const result = handler(db, { part_num: '3001' });
      expect(result.sets.length).toBe(3); // MF=Black, Porsche=DarkRed, X-wing=White
      expect(result.part_num).toBe('3001');
    });

    it('sorts by quantity descending', () => {
      const result = handler(db, { part_num: '3001' });
      // Millennium Falcon has 20x Black, Porsche has 10x Dark Red, X-wing has 8x White
      expect(result.sets[0].quantity).toBe(20);
      expect(result.sets[1].quantity).toBe(10);
      expect(result.sets[2].quantity).toBe(8);
    });

    it('filters by colour name', () => {
      const result = handler(db, { part_num: '3001', color: 'Black' });
      expect(result.sets).toHaveLength(1);
      expect(result.sets[0].set_num).toBe('75192-1');
      expect(result.sets[0].color_name).toBe('Black');
    });

    it('filters by colour ID', () => {
      const result = handler(db, { part_num: '3001', color: '0' }); // Black = 0
      expect(result.sets).toHaveLength(1);
      expect(result.sets[0].set_num).toBe('75192-1');
    });

    it('returns empty for part not in any set', () => {
      const result = handler(db, { part_num: '3001pr0001' });
      expect(result.sets).toHaveLength(0);
    });

    it('includes set name and year', () => {
      const result = handler(db, { part_num: '3001', color: 'Black' });
      expect(result.sets[0].set_name).toBe('Millennium Falcon');
      expect(result.sets[0].year).toBe(2017);
    });

    it('respects limit', () => {
      const result = handler(db, { part_num: '3001', limit: 1 });
      expect(result.sets).toHaveLength(1);
    });
  });

  describe('formatter', () => {
    it('formats results as markdown', () => {
      const result = handler(db, { part_num: '3001' });
      const text = formatFindPartInSets(result);
      expect(text).toContain('Part 3001 appears in');
      expect(text).toContain('**75192-1**');
      expect(text).toContain('Millennium Falcon');
      expect(text).toContain('[Black]');
    });

    it('formats empty results', () => {
      const result = handler(db, { part_num: '3001pr0001' });
      const text = formatFindPartInSets(result);
      expect(text).toContain('not found in any sets');
    });
  });
});
