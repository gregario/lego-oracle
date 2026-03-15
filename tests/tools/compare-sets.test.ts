import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import {
  getDatabase,
  insertTheme,
  insertSet,
  insertPart,
  insertPartCategory,
  insertColor,
  insertInventory,
  insertInventoryPart,
  insertMinifig,
  insertInventoryMinifig,
} from '../../src/data/db.js';
import { handler, formatCompareSets } from '../../src/tools/compare-sets.js';

function seedCompareDb(db: Database.Database): void {
  // Themes
  insertTheme(db, { id: 1, name: 'Star Wars', parent_id: null });
  insertTheme(db, { id: 2, name: 'City', parent_id: null });

  // Part categories
  insertPartCategory(db, { id: 1, name: 'Bricks' });

  // Colors
  insertColor(db, { id: 0, name: 'Black', rgb: '000000', is_trans: 0 });
  insertColor(db, { id: 1, name: 'Blue', rgb: '0000FF', is_trans: 0 });
  insertColor(db, { id: 4, name: 'Red', rgb: 'FF0000', is_trans: 0 });

  // Parts (shared between sets)
  insertPart(db, { part_num: '3001', name: 'Brick 2 x 4', part_cat_id: 1, part_material: 'Plastic' });
  insertPart(db, { part_num: '3003', name: 'Brick 2 x 2', part_cat_id: 1, part_material: 'Plastic' });
  insertPart(db, { part_num: '3010', name: 'Brick 1 x 4', part_cat_id: 1, part_material: 'Plastic' });
  insertPart(db, { part_num: '3020', name: 'Plate 2 x 4', part_cat_id: 1, part_material: 'Plastic' });

  // Sets
  insertSet(db, { set_num: '75192-1', name: 'Millennium Falcon', year: 2017, theme_id: 1, num_parts: 7541, img_url: null });
  insertSet(db, { set_num: '75159-1', name: 'Death Star', year: 2016, theme_id: 1, num_parts: 4016, img_url: null });
  insertSet(db, { set_num: '60316-1', name: 'Police Station', year: 2022, theme_id: 2, num_parts: 668, img_url: null });

  // Minifigs
  insertMinifig(db, { fig_num: 'fig-001', name: 'Han Solo', num_parts: 4, img_url: null });
  insertMinifig(db, { fig_num: 'fig-002', name: 'Chewbacca', num_parts: 5, img_url: null });
  insertMinifig(db, { fig_num: 'fig-003', name: 'Police Officer', num_parts: 4, img_url: null });

  // Inventories
  insertInventory(db, { id: 1, set_num: '75192-1', version: 1 });
  insertInventory(db, { id: 2, set_num: '75159-1', version: 1 });
  insertInventory(db, { id: 3, set_num: '60316-1', version: 1 });

  // Inventory parts: 75192-1 has parts 3001, 3003, 3010
  insertInventoryPart(db, { inventory_id: 1, part_num: '3001', color_id: 0, quantity: 10, is_spare: 0 });
  insertInventoryPart(db, { inventory_id: 1, part_num: '3003', color_id: 0, quantity: 20, is_spare: 0 });
  insertInventoryPart(db, { inventory_id: 1, part_num: '3010', color_id: 1, quantity: 5, is_spare: 0 });

  // Inventory parts: 75159-1 has parts 3001, 3003, 3020
  insertInventoryPart(db, { inventory_id: 2, part_num: '3001', color_id: 0, quantity: 15, is_spare: 0 });
  insertInventoryPart(db, { inventory_id: 2, part_num: '3003', color_id: 4, quantity: 8, is_spare: 0 });
  insertInventoryPart(db, { inventory_id: 2, part_num: '3020', color_id: 1, quantity: 12, is_spare: 0 });

  // Inventory parts: 60316-1 has parts 3001, 3020
  insertInventoryPart(db, { inventory_id: 3, part_num: '3001', color_id: 0, quantity: 5, is_spare: 0 });
  insertInventoryPart(db, { inventory_id: 3, part_num: '3020', color_id: 4, quantity: 3, is_spare: 0 });

  // Inventory minifigs
  insertInventoryMinifig(db, { inventory_id: 1, fig_num: 'fig-001', quantity: 1 });
  insertInventoryMinifig(db, { inventory_id: 1, fig_num: 'fig-002', quantity: 1 });
  insertInventoryMinifig(db, { inventory_id: 2, fig_num: 'fig-001', quantity: 1 });
  insertInventoryMinifig(db, { inventory_id: 3, fig_num: 'fig-003', quantity: 2 });
}

describe('compare_sets', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = getDatabase(':memory:');
    seedCompareDb(db);
  });

  describe('basic comparison', () => {
    it('compares two sets', () => {
      const result = handler(db, { set_nums: ['75192-1', '75159-1'] });

      expect(result.sets).toHaveLength(2);
      expect(result.sets[0].found).toBe(true);
      expect(result.sets[0].name).toBe('Millennium Falcon');
      expect(result.sets[1].found).toBe(true);
      expect(result.sets[1].name).toBe('Death Star');
    });

    it('includes year, theme, and part count', () => {
      const result = handler(db, { set_nums: ['75192-1', '60316-1'] });

      expect(result.sets[0].year).toBe(2017);
      expect(result.sets[0].theme).toBe('Star Wars');
      expect(result.sets[0].num_parts).toBe(7541);

      expect(result.sets[1].year).toBe(2022);
      expect(result.sets[1].theme).toBe('City');
      expect(result.sets[1].num_parts).toBe(668);
    });

    it('includes minifig counts', () => {
      const result = handler(db, { set_nums: ['75192-1', '75159-1', '60316-1'] });

      expect(result.sets[0].minifig_count).toBe(2); // Han + Chewie
      expect(result.sets[1].minifig_count).toBe(1); // Han
      expect(result.sets[2].minifig_count).toBe(2); // 2x Police Officer
    });
  });

  describe('shared parts', () => {
    it('finds shared parts between two sets', () => {
      const result = handler(db, { set_nums: ['75192-1', '75159-1'] });

      // Both have 3001 and 3003
      expect(result.shared_parts_count).toBe(2);
      const partNums = result.shared_parts.map(p => p.part_num);
      expect(partNums).toContain('3001');
      expect(partNums).toContain('3003');
    });

    it('finds shared parts across three sets', () => {
      const result = handler(db, { set_nums: ['75192-1', '75159-1', '60316-1'] });

      // All three have 3001
      expect(result.shared_parts_count).toBe(1);
      expect(result.shared_parts[0].part_num).toBe('3001');
      expect(result.shared_parts[0].name).toBe('Brick 2 x 4');
    });

    it('returns no shared parts when sets have nothing in common', () => {
      // 60316-1 has 3001 and 3020. 75192-1 has 3001, 3003, 3010.
      // They share 3001. But let's test with an imaginary set
      insertSet(db, { set_num: '99999-1', name: 'Unique Set', year: 2024, theme_id: 1, num_parts: 10, img_url: null });
      insertInventory(db, { id: 99, set_num: '99999-1', version: 1 });
      insertPart(db, { part_num: '9999', name: 'Unique Part', part_cat_id: 1, part_material: 'Plastic' });
      insertInventoryPart(db, { inventory_id: 99, part_num: '9999', color_id: 0, quantity: 1, is_spare: 0 });

      const result = handler(db, { set_nums: ['99999-1', '60316-1'] });
      expect(result.shared_parts_count).toBe(0);
    });
  });

  describe('not found sets', () => {
    it('marks unknown sets as not found', () => {
      const result = handler(db, { set_nums: ['75192-1', 'FAKE-1'] });

      expect(result.sets[0].found).toBe(true);
      expect(result.sets[1].found).toBe(false);
      expect(result.sets[1].name).toBeNull();
      expect(result.sets[1].set_num).toBe('FAKE-1');
    });

    it('still finds shared parts among found sets', () => {
      const result = handler(db, { set_nums: ['75192-1', '75159-1', 'FAKE-1'] });

      // Shared parts should only consider found sets
      expect(result.shared_parts_count).toBe(2); // 3001, 3003
    });

    it('returns no shared parts when only one set found', () => {
      const result = handler(db, { set_nums: ['75192-1', 'FAKE-1'] });
      expect(result.shared_parts_count).toBe(0);
    });
  });

  describe('formatter', () => {
    it('formats comparison table', () => {
      const result = handler(db, { set_nums: ['75192-1', '75159-1'] });
      const text = formatCompareSets(result);

      expect(text).toContain('Set Comparison');
      expect(text).toContain('Millennium Falcon');
      expect(text).toContain('Death Star');
      expect(text).toContain('2017');
      expect(text).toContain('Star Wars');
      expect(text).toContain('Shared Parts');
    });

    it('formats not-found sets', () => {
      const result = handler(db, { set_nums: ['75192-1', 'FAKE-1'] });
      const text = formatCompareSets(result);

      expect(text).toContain('Not found');
      expect(text).toContain('FAKE-1');
    });
  });
});
