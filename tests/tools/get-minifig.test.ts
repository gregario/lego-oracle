import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { seedTestDatabase } from '../fixtures.js';
import { handler } from '../../src/tools/get-minifig.js';
import { formatGetMinifig } from '../../src/format.js';

describe('get_minifig', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = seedTestDatabase();
  });

  afterEach(() => {
    db.close();
  });

  describe('handler', () => {
    it('finds a minifig by exact fig_num', () => {
      const result = handler(db, { fig_num: 'fig-000100' });
      expect(result.found).toBe(true);
      if (!result.found) return;
      expect(result.minifig.name).toBe('Chewbacca');
      expect(result.minifig.num_parts).toBe(4);
    });

    it('finds a minifig by name via FTS5', () => {
      const result = handler(db, { name: 'Chewbacca' });
      expect(result.found).toBe(true);
      if (!result.found) return;
      expect(result.minifig.fig_num).toBe('fig-000100');
    });

    it('finds a minifig by partial name via LIKE fallback', () => {
      const result = handler(db, { name: 'Luke' });
      expect(result.found).toBe(true);
      if (!result.found) return;
      expect(result.minifig.fig_num).toBe('fig-000200');
    });

    it('returns not found for unknown minifig', () => {
      const result = handler(db, { fig_num: 'fig-999999' });
      expect(result.found).toBe(false);
      if (result.found) return;
      expect(result.message).toContain('fig-999999');
    });

    it('returns error when neither fig_num nor name provided', () => {
      const result = handler(db, {});
      expect(result.found).toBe(false);
    });

    it('includes all sets the minifig appears in', () => {
      const result = handler(db, { fig_num: 'fig-000200' }); // Luke Skywalker
      expect(result.found).toBe(true);
      if (!result.found) return;
      // Luke appears in Millennium Falcon and X-wing
      expect(result.minifig.sets).toHaveLength(2);
      const setNums = result.minifig.sets.map(s => s.set_num).sort();
      expect(setNums).toEqual(['75192-1', '75301-1']);
    });

    it('includes set year and theme in appearances', () => {
      const result = handler(db, { fig_num: 'fig-000100' }); // Chewbacca
      expect(result.found).toBe(true);
      if (!result.found) return;
      expect(result.minifig.sets).toHaveLength(1);
      expect(result.minifig.sets[0].set_name).toBe('Millennium Falcon');
      expect(result.minifig.sets[0].year).toBe(2017);
      expect(result.minifig.sets[0].theme_name).toBe('Star Wars');
    });

    it('includes quantity in set appearances', () => {
      const result = handler(db, { fig_num: 'fig-000100' });
      expect(result.found).toBe(true);
      if (!result.found) return;
      expect(result.minifig.sets[0].quantity).toBe(1);
    });
  });

  describe('formatter', () => {
    it('formats minifig details as markdown', () => {
      const result = handler(db, { fig_num: 'fig-000200' });
      const text = formatGetMinifig(result);
      expect(text).toContain('# Luke Skywalker');
      expect(text).toContain('fig-000200');
      expect(text).toContain('Appears in 2 set(s)');
      expect(text).toContain('Millennium Falcon');
      expect(text).toContain('X-wing Fighter');
    });

    it('formats not-found result', () => {
      const result = handler(db, { fig_num: 'fig-999999' });
      const text = formatGetMinifig(result);
      expect(text).toContain('No minifig found');
    });
  });
});
