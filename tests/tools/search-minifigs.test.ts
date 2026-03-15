import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { seedTestDatabase } from '../fixtures.js';
import { handler } from '../../src/tools/search-minifigs.js';
import { formatSearchMinifigs } from '../../src/format.js';

describe('search_minifigs', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = seedTestDatabase();
  });

  afterEach(() => {
    db.close();
  });

  describe('handler', () => {
    it('searches minifigs by name via FTS5', () => {
      const result = handler(db, { query: 'Chewbacca' });
      expect(result.minifigs).toHaveLength(1);
      expect(result.minifigs[0].fig_num).toBe('fig-000100');
      expect(result.minifigs[0].name).toBe('Chewbacca');
    });

    it('searches by partial name', () => {
      const result = handler(db, { query: 'Luke' });
      expect(result.minifigs).toHaveLength(1);
      expect(result.minifigs[0].fig_num).toBe('fig-000200');
    });

    it('returns empty for no match', () => {
      const result = handler(db, { query: 'xyznonexistent' });
      expect(result.minifigs).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('respects limit', () => {
      const result = handler(db, { query: 'Skywalker OR Chewbacca', limit: 1 });
      expect(result.minifigs).toHaveLength(1);
    });

    it('includes num_parts in results', () => {
      const result = handler(db, { query: 'Chewbacca' });
      expect(result.minifigs[0].num_parts).toBe(4);
    });
  });

  describe('formatter', () => {
    it('formats search results as markdown', () => {
      const result = handler(db, { query: 'Chewbacca' });
      const text = formatSearchMinifigs(result);
      expect(text).toContain('Found 1 minifigure(s)');
      expect(text).toContain('**fig-000100**');
      expect(text).toContain('Chewbacca');
      expect(text).toContain('4 parts');
    });

    it('formats empty results', () => {
      const result = handler(db, { query: 'xyznonexistent' });
      const text = formatSearchMinifigs(result);
      expect(text).toContain('No minifigures found');
    });
  });
});
