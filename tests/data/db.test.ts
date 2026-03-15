import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import {
  getDatabase,
  getTableNames,
  insertTheme,
  insertColor,
  insertPartCategory,
  insertPart,
  insertSet,
  insertMinifig,
  insertInventory,
  insertInventoryPart,
  insertInventorySet,
  insertInventoryMinifig,
  insertPartRelationship,
  getSetByNum,
  getPartByNum,
  getMinifigByNum,
  searchSets,
  searchParts,
  searchMinifigs,
} from '../../src/data/db.js';

describe('Database', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = getDatabase(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  describe('schema creation', () => {
    it('creates all expected tables', () => {
      const tables = getTableNames(db);
      expect(tables).toContain('themes');
      expect(tables).toContain('colors');
      expect(tables).toContain('part_categories');
      expect(tables).toContain('parts');
      expect(tables).toContain('sets');
      expect(tables).toContain('minifigs');
      expect(tables).toContain('inventories');
      expect(tables).toContain('inventory_parts');
      expect(tables).toContain('inventory_sets');
      expect(tables).toContain('inventory_minifigs');
      expect(tables).toContain('part_relationships');
    });

    it('creates FTS5 virtual tables', () => {
      const tables = getTableNames(db);
      expect(tables).toContain('sets_fts');
      expect(tables).toContain('parts_fts');
      expect(tables).toContain('minifigs_fts');
    });

    it('is idempotent (can run schema twice)', () => {
      // Second call should not throw
      const db2 = getDatabase(':memory:');
      expect(getTableNames(db2).length).toBeGreaterThan(0);
      db2.close();
    });
  });

  describe('themes', () => {
    it('inserts and queries themes', () => {
      insertTheme(db, { id: 1, name: 'Star Wars', parent_id: null });
      insertTheme(db, { id: 2, name: 'Episode IV', parent_id: 1 });

      const rows = db.prepare('SELECT * FROM themes ORDER BY id').all() as Array<{ id: number; name: string; parent_id: number | null }>;
      expect(rows).toHaveLength(2);
      expect(rows[0].name).toBe('Star Wars');
      expect(rows[1].parent_id).toBe(1);
    });
  });

  describe('colors', () => {
    it('inserts and queries colors', () => {
      insertColor(db, { id: 0, name: 'Black', rgb: '05131D', is_trans: 0 });
      insertColor(db, { id: 1, name: 'Blue', rgb: '0055BF', is_trans: 0 });
      insertColor(db, { id: 15, name: 'Trans-Clear', rgb: 'EEEEEE', is_trans: 1 });

      const rows = db.prepare('SELECT * FROM colors ORDER BY id').all() as Array<{ id: number; name: string; is_trans: number }>;
      expect(rows).toHaveLength(3);
      expect(rows[2].is_trans).toBe(1);
    });
  });

  describe('part_categories', () => {
    it('inserts and queries part categories', () => {
      insertPartCategory(db, { id: 1, name: 'Bricks' });
      const row = db.prepare('SELECT * FROM part_categories WHERE id = 1').get() as { name: string };
      expect(row.name).toBe('Bricks');
    });
  });

  describe('parts', () => {
    it('inserts and queries parts', () => {
      insertPartCategory(db, { id: 1, name: 'Bricks' });
      insertPart(db, { part_num: '3001', name: 'Brick 2 x 4', part_cat_id: 1, part_material: 'Plastic' });

      const part = getPartByNum(db, '3001');
      expect(part).toBeDefined();
      expect(part!.name).toBe('Brick 2 x 4');
      expect(part!.part_material).toBe('Plastic');
    });
  });

  describe('sets', () => {
    it('inserts and queries sets', () => {
      insertTheme(db, { id: 1, name: 'Star Wars', parent_id: null });
      insertSet(db, { set_num: '75192-1', name: 'Millennium Falcon', year: 2017, theme_id: 1, num_parts: 7541, img_url: null });

      const set = getSetByNum(db, '75192-1');
      expect(set).toBeDefined();
      expect(set!.name).toBe('Millennium Falcon');
      expect(set!.num_parts).toBe(7541);
    });
  });

  describe('minifigs', () => {
    it('inserts and queries minifigs', () => {
      insertMinifig(db, { fig_num: 'fig-000001', name: 'Luke Skywalker', num_parts: 4, img_url: null });

      const fig = getMinifigByNum(db, 'fig-000001');
      expect(fig).toBeDefined();
      expect(fig!.name).toBe('Luke Skywalker');
    });
  });

  describe('inventories', () => {
    it('inserts and queries inventories', () => {
      insertTheme(db, { id: 1, name: 'Star Wars', parent_id: null });
      insertSet(db, { set_num: '75192-1', name: 'Millennium Falcon', year: 2017, theme_id: 1, num_parts: 7541, img_url: null });
      insertInventory(db, { id: 1, set_num: '75192-1', version: 1 });

      const row = db.prepare('SELECT * FROM inventories WHERE id = 1').get() as { set_num: string };
      expect(row.set_num).toBe('75192-1');
    });
  });

  describe('inventory_parts', () => {
    it('inserts and queries inventory parts', () => {
      insertTheme(db, { id: 1, name: 'Star Wars', parent_id: null });
      insertColor(db, { id: 0, name: 'Black', rgb: '05131D', is_trans: 0 });
      insertPartCategory(db, { id: 1, name: 'Bricks' });
      insertPart(db, { part_num: '3001', name: 'Brick 2 x 4', part_cat_id: 1, part_material: 'Plastic' });
      insertSet(db, { set_num: '75192-1', name: 'Millennium Falcon', year: 2017, theme_id: 1, num_parts: 7541, img_url: null });
      insertInventory(db, { id: 1, set_num: '75192-1', version: 1 });
      insertInventoryPart(db, { inventory_id: 1, part_num: '3001', color_id: 0, quantity: 10, is_spare: 0 });

      const rows = db.prepare('SELECT * FROM inventory_parts WHERE inventory_id = 1').all() as Array<{ quantity: number }>;
      expect(rows).toHaveLength(1);
      expect(rows[0].quantity).toBe(10);
    });
  });

  describe('inventory_sets', () => {
    it('inserts and queries inventory sets', () => {
      insertTheme(db, { id: 1, name: 'Star Wars', parent_id: null });
      insertSet(db, { set_num: '75192-1', name: 'Millennium Falcon', year: 2017, theme_id: 1, num_parts: 7541, img_url: null });
      insertSet(db, { set_num: '30000-1', name: 'Mini Set', year: 2017, theme_id: 1, num_parts: 10, img_url: null });
      insertInventory(db, { id: 1, set_num: '75192-1', version: 1 });
      insertInventorySet(db, { inventory_id: 1, set_num: '30000-1', quantity: 2 });

      const rows = db.prepare('SELECT * FROM inventory_sets WHERE inventory_id = 1').all() as Array<{ set_num: string; quantity: number }>;
      expect(rows).toHaveLength(1);
      expect(rows[0].set_num).toBe('30000-1');
    });
  });

  describe('inventory_minifigs', () => {
    it('inserts and queries inventory minifigs', () => {
      insertTheme(db, { id: 1, name: 'Star Wars', parent_id: null });
      insertSet(db, { set_num: '75192-1', name: 'Millennium Falcon', year: 2017, theme_id: 1, num_parts: 7541, img_url: null });
      insertMinifig(db, { fig_num: 'fig-000001', name: 'Luke Skywalker', num_parts: 4, img_url: null });
      insertInventory(db, { id: 1, set_num: '75192-1', version: 1 });
      insertInventoryMinifig(db, { inventory_id: 1, fig_num: 'fig-000001', quantity: 1 });

      const rows = db.prepare('SELECT * FROM inventory_minifigs WHERE inventory_id = 1').all() as Array<{ fig_num: string }>;
      expect(rows).toHaveLength(1);
      expect(rows[0].fig_num).toBe('fig-000001');
    });
  });

  describe('part_relationships', () => {
    it('inserts and queries part relationships', () => {
      insertPartRelationship(db, { rel_type: 'M', child_part_num: '3001a', parent_part_num: '3001' });

      const rows = db.prepare('SELECT * FROM part_relationships WHERE parent_part_num = ?').all('3001') as Array<{ rel_type: string; child_part_num: string }>;
      expect(rows).toHaveLength(1);
      expect(rows[0].rel_type).toBe('M');
      expect(rows[0].child_part_num).toBe('3001a');
    });
  });

  describe('FTS5 search', () => {
    beforeEach(() => {
      insertTheme(db, { id: 1, name: 'Star Wars', parent_id: null });
      insertSet(db, { set_num: '75192-1', name: 'Millennium Falcon', year: 2017, theme_id: 1, num_parts: 7541, img_url: null });
      insertSet(db, { set_num: '10030-1', name: 'Imperial Star Destroyer', year: 2002, theme_id: 1, num_parts: 3104, img_url: null });
      insertPartCategory(db, { id: 1, name: 'Bricks' });
      insertPart(db, { part_num: '3001', name: 'Brick 2 x 4', part_cat_id: 1, part_material: 'Plastic' });
      insertPart(db, { part_num: '3002', name: 'Brick 2 x 3', part_cat_id: 1, part_material: 'Plastic' });
      insertMinifig(db, { fig_num: 'fig-000001', name: 'Luke Skywalker', num_parts: 4, img_url: null });
      insertMinifig(db, { fig_num: 'fig-000002', name: 'Han Solo', num_parts: 4, img_url: null });
    });

    it('searches sets by name', () => {
      const results = searchSets(db, 'Falcon');
      expect(results).toHaveLength(1);
      expect(results[0].set_num).toBe('75192-1');
    });

    it('searches parts by name', () => {
      const results = searchParts(db, 'Brick');
      expect(results).toHaveLength(2);
    });

    it('searches minifigs by name', () => {
      const results = searchMinifigs(db, 'Skywalker');
      expect(results).toHaveLength(1);
      expect(results[0].fig_num).toBe('fig-000001');
    });

    it('returns empty results for no match', () => {
      expect(searchSets(db, 'xyznonexistent')).toHaveLength(0);
      expect(searchParts(db, 'xyznonexistent')).toHaveLength(0);
      expect(searchMinifigs(db, 'xyznonexistent')).toHaveLength(0);
    });

    it('respects limit parameter', () => {
      const results = searchParts(db, 'Brick', 1);
      expect(results).toHaveLength(1);
    });
  });
});
