import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { seedTestDatabase } from '../fixtures.js';
import { handler } from '../../src/tools/get-set.js';
import { formatGetSet } from '../../src/format.js';

describe('get_set', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = seedTestDatabase();
  });

  afterEach(() => {
    db.close();
  });

  describe('handler', () => {
    it('finds a set by exact set_num', () => {
      const result = handler(db, { set_num: '75192-1' });
      expect(result.found).toBe(true);
      if (!result.found) return;
      expect(result.set.name).toBe('Millennium Falcon');
      expect(result.set.year).toBe(2017);
      expect(result.set.num_parts).toBe(7541);
    });

    it('finds a set by name via FTS5', () => {
      const result = handler(db, { name: 'Falcon' });
      expect(result.found).toBe(true);
      if (!result.found) return;
      expect(result.set.set_num).toBe('75192-1');
    });

    it('finds a set by partial name via LIKE fallback', () => {
      const result = handler(db, { name: 'Porsche' });
      expect(result.found).toBe(true);
      if (!result.found) return;
      expect(result.set.set_num).toBe('42056-1');
    });

    it('returns not found with suggestions for unknown set', () => {
      const result = handler(db, { set_num: '99999-1' });
      expect(result.found).toBe(false);
      if (result.found) return;
      expect(result.message).toContain('99999-1');
    });

    it('returns error when neither set_num nor name provided', () => {
      const result = handler(db, {});
      expect(result.found).toBe(false);
    });

    it('includes theme hierarchy path', () => {
      const result = handler(db, { set_num: '75192-1' });
      expect(result.found).toBe(true);
      if (!result.found) return;
      // Theme path should be LEGO > Star Wars
      expect(result.set.theme_path).toEqual(['LEGO', 'Star Wars']);
    });

    it('includes inventory parts grouped by category', () => {
      const result = handler(db, { set_num: '75192-1' });
      expect(result.found).toBe(true);
      if (!result.found) return;
      expect(result.set.inventory_parts.length).toBeGreaterThan(0);

      // Check that parts have category and colour info
      const brick = result.set.inventory_parts.find(p => p.part_num === '3001');
      expect(brick).toBeDefined();
      expect(brick!.category_name).toBe('Bricks');
      expect(brick!.color_name).toBe('Black');
      expect(brick!.quantity).toBe(20);
    });

    it('includes minifig list', () => {
      const result = handler(db, { set_num: '75192-1' });
      expect(result.found).toBe(true);
      if (!result.found) return;
      expect(result.set.minifigs).toHaveLength(2);

      const chewie = result.set.minifigs.find(m => m.fig_num === 'fig-000100');
      expect(chewie).toBeDefined();
      expect(chewie!.name).toBe('Chewbacca');
    });

    it('returns empty minifig list for sets without minifigs', () => {
      const result = handler(db, { set_num: '42056-1' });
      expect(result.found).toBe(true);
      if (!result.found) return;
      expect(result.set.minifigs).toHaveLength(0);
    });
  });

  describe('formatter', () => {
    it('formats full set details as markdown', () => {
      const result = handler(db, { set_num: '75192-1' });
      const text = formatGetSet(result);
      expect(text).toContain('# Millennium Falcon');
      expect(text).toContain('75192-1');
      expect(text).toContain('LEGO > Star Wars');
      expect(text).toContain('## Parts');
      expect(text).toContain('### Bricks');
      expect(text).toContain('## Minifigures');
      expect(text).toContain('Chewbacca');
    });

    it('formats not-found result with suggestions', () => {
      const result = handler(db, { name: 'xyznonexistent' });
      const text = formatGetSet(result);
      expect(text).toContain('No set found');
    });
  });
});
