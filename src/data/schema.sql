-- LEGO Oracle Schema
-- Data source: Rebrickable (rebrickable.com)

-- Core lookup tables
CREATE TABLE IF NOT EXISTS themes (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id INTEGER,
  FOREIGN KEY (parent_id) REFERENCES themes(id)
);

CREATE TABLE IF NOT EXISTS colors (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  rgb TEXT,
  is_trans INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS part_categories (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);

-- Main entity tables
CREATE TABLE IF NOT EXISTS parts (
  part_num TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  part_cat_id INTEGER,
  part_material TEXT,
  FOREIGN KEY (part_cat_id) REFERENCES part_categories(id)
);

CREATE TABLE IF NOT EXISTS sets (
  set_num TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  year INTEGER,
  theme_id INTEGER,
  num_parts INTEGER,
  img_url TEXT,
  FOREIGN KEY (theme_id) REFERENCES themes(id)
);

CREATE TABLE IF NOT EXISTS minifigs (
  fig_num TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  num_parts INTEGER,
  img_url TEXT
);

-- Inventory tables (link sets to their contents)
CREATE TABLE IF NOT EXISTS inventories (
  id INTEGER PRIMARY KEY,
  set_num TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (set_num) REFERENCES sets(set_num)
);

CREATE TABLE IF NOT EXISTS inventory_parts (
  inventory_id INTEGER NOT NULL,
  part_num TEXT NOT NULL,
  color_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  is_spare INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (inventory_id) REFERENCES inventories(id),
  FOREIGN KEY (part_num) REFERENCES parts(part_num),
  FOREIGN KEY (color_id) REFERENCES colors(id)
);

CREATE TABLE IF NOT EXISTS inventory_sets (
  inventory_id INTEGER NOT NULL,
  set_num TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (inventory_id) REFERENCES inventories(id),
  FOREIGN KEY (set_num) REFERENCES sets(set_num)
);

CREATE TABLE IF NOT EXISTS inventory_minifigs (
  inventory_id INTEGER NOT NULL,
  fig_num TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (inventory_id) REFERENCES inventories(id),
  FOREIGN KEY (fig_num) REFERENCES minifigs(fig_num)
);

-- Part relationships
CREATE TABLE IF NOT EXISTS part_relationships (
  rel_type TEXT NOT NULL,
  child_part_num TEXT NOT NULL,
  parent_part_num TEXT NOT NULL
);

-- FTS5 search indexes
CREATE VIRTUAL TABLE IF NOT EXISTS sets_fts USING fts5(name, content='sets', content_rowid='rowid');
CREATE VIRTUAL TABLE IF NOT EXISTS parts_fts USING fts5(name, content='parts', content_rowid='rowid');
CREATE VIRTUAL TABLE IF NOT EXISTS minifigs_fts USING fts5(name, content='minifigs', content_rowid='rowid');

-- FTS sync triggers (sets)
CREATE TRIGGER IF NOT EXISTS sets_ai AFTER INSERT ON sets BEGIN
  INSERT INTO sets_fts(rowid, name) VALUES (new.rowid, new.name);
END;
CREATE TRIGGER IF NOT EXISTS sets_ad AFTER DELETE ON sets BEGIN
  INSERT INTO sets_fts(sets_fts, rowid, name) VALUES ('delete', old.rowid, old.name);
END;

-- FTS sync triggers (parts)
CREATE TRIGGER IF NOT EXISTS parts_ai AFTER INSERT ON parts BEGIN
  INSERT INTO parts_fts(rowid, name) VALUES (new.rowid, new.name);
END;
CREATE TRIGGER IF NOT EXISTS parts_ad AFTER DELETE ON parts BEGIN
  INSERT INTO parts_fts(parts_fts, rowid, name) VALUES ('delete', old.rowid, old.name);
END;

-- FTS sync triggers (minifigs)
CREATE TRIGGER IF NOT EXISTS minifigs_ai AFTER INSERT ON minifigs BEGIN
  INSERT INTO minifigs_fts(rowid, name) VALUES (new.rowid, new.name);
END;
CREATE TRIGGER IF NOT EXISTS minifigs_ad AFTER DELETE ON minifigs BEGIN
  INSERT INTO minifigs_fts(minifigs_fts, rowid, name) VALUES ('delete', old.rowid, old.name);
END;

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_sets_theme ON sets(theme_id);
CREATE INDEX IF NOT EXISTS idx_sets_year ON sets(year);
CREATE INDEX IF NOT EXISTS idx_inventory_parts_part ON inventory_parts(part_num);
CREATE INDEX IF NOT EXISTS idx_inventory_parts_color ON inventory_parts(color_id);
CREATE INDEX IF NOT EXISTS idx_inventory_parts_inv ON inventory_parts(inventory_id);
CREATE INDEX IF NOT EXISTS idx_inventories_set ON inventories(set_num);
CREATE INDEX IF NOT EXISTS idx_inventory_minifigs_fig ON inventory_minifigs(fig_num);
CREATE INDEX IF NOT EXISTS idx_inventory_minifigs_inv ON inventory_minifigs(inventory_id);
CREATE INDEX IF NOT EXISTS idx_themes_parent ON themes(parent_id);
CREATE INDEX IF NOT EXISTS idx_part_rel_child ON part_relationships(child_part_num);
CREATE INDEX IF NOT EXISTS idx_part_rel_parent ON part_relationships(parent_part_num);
