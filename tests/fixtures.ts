/**
 * Shared test fixtures for LEGO Oracle tool tests.
 * Seeds an in-memory database with known LEGO data.
 */

import Database from 'better-sqlite3';
import {
  getDatabase,
  insertTheme,
  insertColor,
  insertPartCategory,
  insertPart,
  insertSet,
  insertMinifig,
  insertInventory,
  insertInventoryPart,
  insertInventoryMinifig,
  insertPartRelationship,
} from '../src/data/db.js';

/**
 * Creates and seeds an in-memory database with known test data.
 *
 * Themes: LEGO (parent), Star Wars (child), Technic (child)
 * Colours: Black (0), White (15), Dark Red (59)
 * Part categories: Bricks (11), Plates (14)
 * Parts: Brick 2x4, Brick 1x4, Plate 1x2, Plate 1x4
 * Sets: Millennium Falcon, Porsche 911, X-wing
 * Minifigs: Chewbacca, Luke Skywalker
 * Inventories linking sets to parts and minifigs
 * Part relationships: 3001 mold of 3001pr0001
 */
export function seedTestDatabase(): Database.Database {
  const db = getDatabase(':memory:');

  // --- Themes ---
  insertTheme(db, { id: 1, name: 'LEGO', parent_id: null });
  insertTheme(db, { id: 18, name: 'Star Wars', parent_id: 1 });
  insertTheme(db, { id: 1, name: 'LEGO', parent_id: null }); // idempotent
  insertTheme(db, { id: 35, name: 'Technic', parent_id: 1 });

  // --- Colours ---
  insertColor(db, { id: 0, name: 'Black', rgb: '05131D', is_trans: 0 });
  insertColor(db, { id: 15, name: 'White', rgb: 'FFFFFF', is_trans: 0 });
  insertColor(db, { id: 59, name: 'Dark Red', rgb: '6C0F1B', is_trans: 0 });

  // --- Part categories ---
  insertPartCategory(db, { id: 11, name: 'Bricks' });
  insertPartCategory(db, { id: 14, name: 'Plates' });

  // --- Parts ---
  insertPart(db, { part_num: '3001', name: 'Brick 2 x 4', part_cat_id: 11, part_material: 'Plastic' });
  insertPart(db, { part_num: '3010', name: 'Brick 1 x 4', part_cat_id: 11, part_material: 'Plastic' });
  insertPart(db, { part_num: '3023', name: 'Plate 1 x 2', part_cat_id: 14, part_material: 'Plastic' });
  insertPart(db, { part_num: '3710', name: 'Plate 1 x 4', part_cat_id: 14, part_material: 'Plastic' });
  // Printed variant for part relationship testing
  insertPart(db, { part_num: '3001pr0001', name: 'Brick 2 x 4 with Print', part_cat_id: 11, part_material: 'Plastic' });

  // --- Sets ---
  insertSet(db, {
    set_num: '75192-1', name: 'Millennium Falcon', year: 2017,
    theme_id: 18, num_parts: 7541, img_url: 'https://example.com/75192.jpg',
  });
  insertSet(db, {
    set_num: '42056-1', name: 'Porsche 911 GT3 RS', year: 2016,
    theme_id: 35, num_parts: 2704, img_url: 'https://example.com/42056.jpg',
  });
  insertSet(db, {
    set_num: '75301-1', name: 'Luke Skywalker X-wing Fighter', year: 2021,
    theme_id: 18, num_parts: 474, img_url: 'https://example.com/75301.jpg',
  });

  // --- Minifigs ---
  insertMinifig(db, { fig_num: 'fig-000100', name: 'Chewbacca', num_parts: 4, img_url: null });
  insertMinifig(db, { fig_num: 'fig-000200', name: 'Luke Skywalker', num_parts: 5, img_url: null });

  // --- Inventories ---
  // Millennium Falcon inventory
  insertInventory(db, { id: 1, set_num: '75192-1', version: 1 });
  // Porsche inventory
  insertInventory(db, { id: 2, set_num: '42056-1', version: 1 });
  // X-wing inventory
  insertInventory(db, { id: 3, set_num: '75301-1', version: 1 });

  // --- Inventory parts ---
  // Millennium Falcon parts
  insertInventoryPart(db, { inventory_id: 1, part_num: '3001', color_id: 0, quantity: 20, is_spare: 0 });
  insertInventoryPart(db, { inventory_id: 1, part_num: '3010', color_id: 15, quantity: 15, is_spare: 0 });
  insertInventoryPart(db, { inventory_id: 1, part_num: '3023', color_id: 0, quantity: 30, is_spare: 0 });
  insertInventoryPart(db, { inventory_id: 1, part_num: '3710', color_id: 59, quantity: 5, is_spare: 0 });

  // Porsche parts
  insertInventoryPart(db, { inventory_id: 2, part_num: '3001', color_id: 59, quantity: 10, is_spare: 0 });
  insertInventoryPart(db, { inventory_id: 2, part_num: '3023', color_id: 15, quantity: 25, is_spare: 0 });

  // X-wing parts
  insertInventoryPart(db, { inventory_id: 3, part_num: '3001', color_id: 15, quantity: 8, is_spare: 0 });
  insertInventoryPart(db, { inventory_id: 3, part_num: '3710', color_id: 0, quantity: 12, is_spare: 0 });

  // --- Inventory minifigs ---
  // Millennium Falcon minifigs
  insertInventoryMinifig(db, { inventory_id: 1, fig_num: 'fig-000100', quantity: 1 });
  insertInventoryMinifig(db, { inventory_id: 1, fig_num: 'fig-000200', quantity: 1 });

  // X-wing minifigs
  insertInventoryMinifig(db, { inventory_id: 3, fig_num: 'fig-000200', quantity: 1 });

  // --- Part relationships ---
  // 3001 is a mold parent of 3001pr0001 (printed version)
  insertPartRelationship(db, { rel_type: 'M', child_part_num: '3001pr0001', parent_part_num: '3001' });

  return db;
}
