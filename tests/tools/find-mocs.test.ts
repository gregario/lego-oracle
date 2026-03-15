import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { getDatabase, insertSet } from '../../src/data/db.js';
import { handler, formatFindMocs } from '../../src/tools/find-mocs.js';

function seedMocsDb(db: Database.Database): void {
  // A set to look up MOCs for
  insertSet(db, { set_num: '75192-1', name: 'Millennium Falcon', year: 2017, theme_id: null, num_parts: 7541, img_url: null });
  insertSet(db, { set_num: '10179-1', name: 'Millennium Falcon (First Edition)', year: 2007, theme_id: null, num_parts: 5195, img_url: null });
}

function createMocTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS mocs (
      set_num TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      num_parts INTEGER
    );
    CREATE TABLE IF NOT EXISTS moc_parts (
      moc_set_num TEXT NOT NULL,
      set_num TEXT NOT NULL
    );
  `);
}

function seedMocData(db: Database.Database): void {
  createMocTables(db);

  // MOC builds for 75192-1
  db.prepare("INSERT INTO mocs (set_num, name, num_parts) VALUES (?, ?, ?)").run('MOC-1234', 'Falcon Cargo Ship', 3200);
  db.prepare("INSERT INTO mocs (set_num, name, num_parts) VALUES (?, ?, ?)").run('MOC-5678', 'Star Destroyer Alt', 5000);

  db.prepare("INSERT INTO moc_parts (moc_set_num, set_num) VALUES (?, ?)").run('MOC-1234', '75192-1');
  db.prepare("INSERT INTO moc_parts (moc_set_num, set_num) VALUES (?, ?)").run('MOC-5678', '75192-1');
}

describe('find_mocs', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = getDatabase(':memory:');
    seedMocsDb(db);
  });

  describe('no MOC tables', () => {
    it('returns moc_data_available false when mocs table does not exist', () => {
      const result = handler(db, { set_num: '75192-1' });

      expect(result.moc_data_available).toBe(false);
      expect(result.mocs).toHaveLength(0);
      expect(result.set_name).toBe('Millennium Falcon');
    });

    it('includes set_num in result even when no MOC data', () => {
      const result = handler(db, { set_num: '75192-1' });
      expect(result.set_num).toBe('75192-1');
    });
  });

  describe('empty MOC tables', () => {
    it('returns moc_data_available false when mocs table is empty', () => {
      createMocTables(db);

      const result = handler(db, { set_num: '75192-1' });
      expect(result.moc_data_available).toBe(false);
      expect(result.mocs).toHaveLength(0);
    });
  });

  describe('with MOC data', () => {
    beforeEach(() => {
      seedMocData(db);
    });

    it('returns MOC builds for a set', () => {
      const result = handler(db, { set_num: '75192-1' });

      expect(result.moc_data_available).toBe(true);
      expect(result.mocs).toHaveLength(2);
      expect(result.set_name).toBe('Millennium Falcon');
    });

    it('orders MOCs by num_parts descending', () => {
      const result = handler(db, { set_num: '75192-1' });

      expect(result.mocs[0].name).toBe('Star Destroyer Alt');
      expect(result.mocs[0].num_parts).toBe(5000);
      expect(result.mocs[1].name).toBe('Falcon Cargo Ship');
      expect(result.mocs[1].num_parts).toBe(3200);
    });

    it('returns empty MOCs for a set with no alternate builds', () => {
      const result = handler(db, { set_num: '10179-1' });

      expect(result.moc_data_available).toBe(true);
      expect(result.mocs).toHaveLength(0);
    });

    it('returns null set_name for unknown set', () => {
      const result = handler(db, { set_num: '99999-1' });
      expect(result.set_name).toBeNull();
    });
  });

  describe('formatter', () => {
    it('formats no MOC data message with Rebrickable link', () => {
      const result = handler(db, { set_num: '75192-1' });
      const text = formatFindMocs(result);

      expect(text).toContain('No MOC data available');
      expect(text).toContain('rebrickable.com/sets/75192-1/mocs/');
    });

    it('formats MOC list', () => {
      seedMocData(db);
      const result = handler(db, { set_num: '75192-1' });
      const text = formatFindMocs(result);

      expect(text).toContain('Alternate Builds');
      expect(text).toContain('Millennium Falcon');
      expect(text).toContain('Falcon Cargo Ship');
      expect(text).toContain('Star Destroyer Alt');
      expect(text).toContain('2 found');
    });

    it('formats empty MOC results for set with data available', () => {
      seedMocData(db);
      const result = handler(db, { set_num: '10179-1' });
      const text = formatFindMocs(result);

      expect(text).toContain('No alternate builds');
    });
  });
});
