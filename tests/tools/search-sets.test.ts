import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { seedTestDatabase } from '../fixtures.js';
import { handler } from '../../src/tools/search-sets.js';
import { formatSearchSets } from '../../src/format.js';

describe('search_sets', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = seedTestDatabase();
  });

  afterEach(() => {
    db.close();
  });

  describe('handler', () => {
    it('searches sets by name via FTS5', () => {
      const result = handler(db, { query: 'Falcon' });
      expect(result.sets).toHaveLength(1);
      expect(result.sets[0].set_num).toBe('75192-1');
      expect(result.sets[0].name).toBe('Millennium Falcon');
    });

    it('searches sets by partial name', () => {
      const result = handler(db, { query: 'Porsche' });
      expect(result.sets).toHaveLength(1);
      expect(result.sets[0].set_num).toBe('42056-1');
    });

    it('filters by theme (exact name)', () => {
      const result = handler(db, { theme: 'Star Wars' });
      expect(result.sets).toHaveLength(2);
      const setNums = result.sets.map(s => s.set_num).sort();
      expect(setNums).toEqual(['75192-1', '75301-1']);
    });

    it('filters by theme recursively (parent theme includes children)', () => {
      const result = handler(db, { theme: 'LEGO' });
      // All 3 sets should match since Star Wars and Technic are children of LEGO
      expect(result.sets).toHaveLength(3);
    });

    it('filters by year range', () => {
      const result = handler(db, { year_min: 2017, year_max: 2021 });
      expect(result.sets).toHaveLength(2);
      const setNums = result.sets.map(s => s.set_num).sort();
      expect(setNums).toEqual(['75192-1', '75301-1']);
    });

    it('filters by minimum parts', () => {
      const result = handler(db, { min_parts: 5000 });
      expect(result.sets).toHaveLength(1);
      expect(result.sets[0].set_num).toBe('75192-1');
    });

    it('filters by maximum parts', () => {
      const result = handler(db, { max_parts: 500 });
      expect(result.sets).toHaveLength(1);
      expect(result.sets[0].set_num).toBe('75301-1');
    });

    it('combines FTS5 query with theme filter', () => {
      const result = handler(db, { query: 'Falcon', theme: 'Star Wars' });
      expect(result.sets).toHaveLength(1);
      expect(result.sets[0].set_num).toBe('75192-1');
    });

    it('combines multiple filters', () => {
      const result = handler(db, { theme: 'Star Wars', year_min: 2020, min_parts: 100 });
      expect(result.sets).toHaveLength(1);
      expect(result.sets[0].set_num).toBe('75301-1');
    });

    it('returns empty for no match', () => {
      const result = handler(db, { query: 'xyznonexistent' });
      expect(result.sets).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('respects limit parameter', () => {
      const result = handler(db, { theme: 'LEGO', limit: 2 });
      expect(result.sets).toHaveLength(2);
    });

    it('includes theme name in results', () => {
      const result = handler(db, { query: 'Falcon' });
      expect(result.sets[0].theme_name).toBe('Star Wars');
    });
  });

  describe('formatter', () => {
    it('formats search results as markdown', () => {
      const result = handler(db, { query: 'Falcon' });
      const text = formatSearchSets(result);
      expect(text).toContain('Found 1 set(s)');
      expect(text).toContain('**75192-1**');
      expect(text).toContain('Millennium Falcon');
      expect(text).toContain('2017');
      expect(text).toContain('7541 parts');
    });

    it('formats empty results', () => {
      const result = handler(db, { query: 'xyznonexistent' });
      const text = formatSearchSets(result);
      expect(text).toContain('No sets found');
    });
  });
});
