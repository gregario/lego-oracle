import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { getDatabase, insertTheme, insertSet } from '../../src/data/db.js';
import { handler, formatBrowseThemes } from '../../src/tools/browse-themes.js';

function seedThemesDb(db: Database.Database): void {
  // Top-level themes
  insertTheme(db, { id: 1, name: 'Star Wars', parent_id: null });
  insertTheme(db, { id: 2, name: 'City', parent_id: null });
  insertTheme(db, { id: 3, name: 'Technic', parent_id: null });

  // Sub-themes under Star Wars
  insertTheme(db, { id: 10, name: 'Original Trilogy', parent_id: 1 });
  insertTheme(db, { id: 11, name: 'Prequel Trilogy', parent_id: 1 });

  // Sub-sub-theme
  insertTheme(db, { id: 20, name: 'Episode IV', parent_id: 10 });

  // Sub-theme under City
  insertTheme(db, { id: 30, name: 'Police', parent_id: 2 });

  // Sets in various themes
  insertSet(db, { set_num: '75192-1', name: 'Millennium Falcon', year: 2017, theme_id: 10, num_parts: 7541, img_url: null });
  insertSet(db, { set_num: '75159-1', name: 'Death Star', year: 2016, theme_id: 10, num_parts: 4016, img_url: null });
  insertSet(db, { set_num: '75021-1', name: 'Republic Gunship', year: 2013, theme_id: 11, num_parts: 1175, img_url: null });
  insertSet(db, { set_num: '75341-1', name: 'Landspeeder', year: 2022, theme_id: 20, num_parts: 1890, img_url: null });
  insertSet(db, { set_num: '60316-1', name: 'Police Station', year: 2022, theme_id: 30, num_parts: 668, img_url: null });
  insertSet(db, { set_num: '42143-1', name: 'Ferrari Daytona SP3', year: 2022, theme_id: 3, num_parts: 3778, img_url: null });
}

describe('browse_themes', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = getDatabase(':memory:');
    seedThemesDb(db);
  });

  describe('top-level (no input)', () => {
    it('returns all top-level themes', () => {
      const result = handler(db, {});

      expect(result.theme_name).toBeNull();
      expect(result.themes).toHaveLength(3);
    });

    it('includes recursive set counts', () => {
      const result = handler(db, {});

      // Star Wars: 4 sets (2 in Original Trilogy, 1 in Prequel, 1 in Episode IV)
      const starWars = result.themes.find(t => t.name === 'Star Wars');
      expect(starWars).toBeDefined();
      expect(starWars!.set_count).toBe(4);

      // City: 1 set (in Police sub-theme)
      const city = result.themes.find(t => t.name === 'City');
      expect(city).toBeDefined();
      expect(city!.set_count).toBe(1);

      // Technic: 1 set
      const technic = result.themes.find(t => t.name === 'Technic');
      expect(technic).toBeDefined();
      expect(technic!.set_count).toBe(1);
    });

    it('orders by set count descending', () => {
      const result = handler(db, {});

      expect(result.themes[0].name).toBe('Star Wars');
    });

    it('includes sub-theme counts', () => {
      const result = handler(db, {});

      const starWars = result.themes.find(t => t.name === 'Star Wars');
      expect(starWars!.sub_theme_count).toBe(2); // Original Trilogy + Prequel Trilogy

      const technic = result.themes.find(t => t.name === 'Technic');
      expect(technic!.sub_theme_count).toBe(0);
    });

    it('reports total set count', () => {
      const result = handler(db, {});
      expect(result.total_set_count).toBe(6);
    });
  });

  describe('specific theme by name', () => {
    it('finds theme by exact name', () => {
      const result = handler(db, { theme: 'Star Wars' });

      expect(result.theme_name).toBe('Star Wars');
      expect(result.themes).toHaveLength(2); // Original Trilogy + Prequel Trilogy
    });

    it('finds theme case-insensitively', () => {
      const result = handler(db, { theme: 'star wars' });
      expect(result.theme_name).toBe('Star Wars');
    });

    it('finds theme by partial name', () => {
      const result = handler(db, { theme: 'Star' });
      expect(result.theme_name).toBe('Star Wars');
    });

    it('returns sub-themes with set counts', () => {
      const result = handler(db, { theme: 'Star Wars' });

      const ot = result.themes.find(t => t.name === 'Original Trilogy');
      expect(ot).toBeDefined();
      // Original Trilogy has 2 direct + 1 in Episode IV sub-theme = 3
      expect(ot!.set_count).toBe(3);

      const pt = result.themes.find(t => t.name === 'Prequel Trilogy');
      expect(pt).toBeDefined();
      expect(pt!.set_count).toBe(1);
    });

    it('returns direct set count for the theme', () => {
      const result = handler(db, { theme: 'Star Wars' });
      // Star Wars itself has no direct sets (they're in sub-themes)
      expect(result.direct_set_count).toBe(0);
    });

    it('returns total set count including all descendants', () => {
      const result = handler(db, { theme: 'Star Wars' });
      expect(result.total_set_count).toBe(4);
    });
  });

  describe('specific theme by ID', () => {
    it('finds theme by numeric ID', () => {
      const result = handler(db, { theme: '1' });
      expect(result.theme_name).toBe('Star Wars');
    });

    it('shows sub-sub-themes correctly', () => {
      const result = handler(db, { theme: '10' }); // Original Trilogy
      expect(result.theme_name).toBe('Original Trilogy');
      expect(result.themes).toHaveLength(1); // Episode IV
      expect(result.themes[0].name).toBe('Episode IV');
      expect(result.themes[0].set_count).toBe(1);
    });
  });

  describe('unknown theme', () => {
    it('returns empty result for unknown theme', () => {
      const result = handler(db, { theme: 'Nonexistent Theme' });
      expect(result.theme_name).toBeNull();
      expect(result.themes).toHaveLength(0);
      expect(result.total_set_count).toBe(0);
    });
  });

  describe('formatter', () => {
    it('formats top-level themes', () => {
      const result = handler(db, {});
      const text = formatBrowseThemes(result);

      expect(text).toContain('LEGO Themes');
      expect(text).toContain('Star Wars');
      expect(text).toContain('City');
      expect(text).toContain('Technic');
    });

    it('formats specific theme with sub-themes', () => {
      const result = handler(db, { theme: 'Star Wars' });
      const text = formatBrowseThemes(result);

      expect(text).toContain('# Star Wars');
      expect(text).toContain('Sub-themes');
      expect(text).toContain('Original Trilogy');
      expect(text).toContain('Prequel Trilogy');
    });

    it('formats unknown theme', () => {
      const result = handler(db, { theme: 'Nonexistent' });
      const text = formatBrowseThemes(result);

      expect(text).toContain('No themes found');
    });
  });
});
