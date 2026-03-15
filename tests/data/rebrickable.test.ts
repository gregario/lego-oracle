import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { getDatabase, searchSets, searchParts, searchMinifigs } from '../../src/data/db.js';
import {
  ingestThemes,
  ingestColors,
  ingestPartCategories,
  ingestParts,
  ingestSets,
  ingestMinifigs,
  ingestInventories,
  ingestInventoryParts,
  ingestInventorySets,
  ingestInventoryMinifigs,
  ingestPartRelationships,
  clearAllData,
} from '../../src/data/rebrickable.js';

describe('Rebrickable CSV Ingestion', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = getDatabase(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  describe('ingestThemes', () => {
    it('parses and inserts themes CSV', () => {
      const csv = `id,name,parent_id
1,Technic,
2,Star Wars,
3,Episode IV,2`;
      const count = ingestThemes(db, csv);
      expect(count).toBe(3);

      const rows = db.prepare('SELECT * FROM themes ORDER BY id').all() as Array<{ id: number; name: string; parent_id: number | null }>;
      expect(rows).toHaveLength(3);
      expect(rows[0].name).toBe('Technic');
      expect(rows[0].parent_id).toBeNull();
      expect(rows[2].parent_id).toBe(2);
    });
  });

  describe('ingestColors', () => {
    it('parses and inserts colors CSV with is_trans flag', () => {
      const csv = `id,name,rgb,is_trans
0,Black,05131D,f
15,White,FFFFFF,f
36,Trans-Red,C91A09,t`;
      const count = ingestColors(db, csv);
      expect(count).toBe(3);

      const rows = db.prepare('SELECT * FROM colors ORDER BY id').all() as Array<{ id: number; name: string; is_trans: number }>;
      expect(rows[0].is_trans).toBe(0);
      expect(rows[2].is_trans).toBe(1);
      expect(rows[2].name).toBe('Trans-Red');
    });
  });

  describe('ingestPartCategories', () => {
    it('parses and inserts part categories CSV', () => {
      const csv = `id,name
1,Bricks
2,Plates
3,Tiles`;
      const count = ingestPartCategories(db, csv);
      expect(count).toBe(3);
    });
  });

  describe('ingestParts', () => {
    it('parses and inserts parts CSV', () => {
      // Need part_categories for FK
      ingestPartCategories(db, `id,name\n1,Bricks`);

      const csv = `part_num,name,part_cat_id,part_material
3001,Brick 2 x 4,1,Plastic
3002,Brick 2 x 3,1,Plastic
60479,Plate 1 x 12,1,`;
      const count = ingestParts(db, csv);
      expect(count).toBe(3);

      const row = db.prepare('SELECT * FROM parts WHERE part_num = ?').get('60479') as { part_material: string | null };
      expect(row.part_material).toBeNull();
    });
  });

  describe('ingestSets', () => {
    it('parses and inserts sets CSV', () => {
      ingestThemes(db, `id,name,parent_id\n1,Star Wars,`);

      const csv = `set_num,name,year,theme_id,num_parts,img_url
75192-1,Millennium Falcon,2017,1,7541,https://example.com/75192.jpg
10030-1,Imperial Star Destroyer,2002,1,3104,`;
      const count = ingestSets(db, csv);
      expect(count).toBe(2);

      const row = db.prepare('SELECT * FROM sets WHERE set_num = ?').get('75192-1') as { num_parts: number; img_url: string };
      expect(row.num_parts).toBe(7541);
      expect(row.img_url).toBe('https://example.com/75192.jpg');
    });
  });

  describe('ingestMinifigs', () => {
    it('parses and inserts minifigs CSV', () => {
      const csv = `fig_num,name,num_parts,img_url
fig-000001,Luke Skywalker,4,https://example.com/luke.jpg
fig-000002,Han Solo,4,`;
      const count = ingestMinifigs(db, csv);
      expect(count).toBe(2);
    });
  });

  describe('ingestInventories', () => {
    it('parses and inserts inventories CSV', () => {
      ingestThemes(db, `id,name,parent_id\n1,Star Wars,`);
      ingestSets(db, `set_num,name,year,theme_id,num_parts,img_url\n75192-1,Millennium Falcon,2017,1,7541,`);

      const csv = `id,set_num,version
1,75192-1,1
2,75192-1,2`;
      const count = ingestInventories(db, csv);
      expect(count).toBe(2);
    });
  });

  describe('ingestInventoryParts', () => {
    it('parses and inserts inventory parts CSV with is_spare flag', () => {
      // Set up dependencies
      ingestThemes(db, `id,name,parent_id\n1,Star Wars,`);
      ingestColors(db, `id,name,rgb,is_trans\n0,Black,05131D,f`);
      ingestPartCategories(db, `id,name\n1,Bricks`);
      ingestParts(db, `part_num,name,part_cat_id,part_material\n3001,Brick 2 x 4,1,Plastic`);
      ingestSets(db, `set_num,name,year,theme_id,num_parts,img_url\n75192-1,Millennium Falcon,2017,1,7541,`);
      ingestInventories(db, `id,set_num,version\n1,75192-1,1`);

      const csv = `inventory_id,part_num,color_id,quantity,is_spare,img_url
1,3001,0,10,f,
1,3001,0,2,t,`;
      const count = ingestInventoryParts(db, csv);
      expect(count).toBe(2);

      const rows = db.prepare('SELECT * FROM inventory_parts WHERE inventory_id = 1').all() as Array<{ is_spare: number; quantity: number }>;
      expect(rows).toHaveLength(2);
      // One spare, one not
      const spares = rows.filter(r => r.is_spare === 1);
      expect(spares).toHaveLength(1);
      expect(spares[0].quantity).toBe(2);
    });
  });

  describe('ingestInventorySets', () => {
    it('parses and inserts inventory sets CSV', () => {
      ingestThemes(db, `id,name,parent_id\n1,Star Wars,`);
      ingestSets(db, `set_num,name,year,theme_id,num_parts,img_url\n75192-1,Millennium Falcon,2017,1,7541,\n30000-1,Mini Set,2017,1,10,`);
      ingestInventories(db, `id,set_num,version\n1,75192-1,1`);

      const csv = `inventory_id,set_num,quantity
1,30000-1,2`;
      const count = ingestInventorySets(db, csv);
      expect(count).toBe(1);
    });
  });

  describe('ingestInventoryMinifigs', () => {
    it('parses and inserts inventory minifigs CSV', () => {
      ingestThemes(db, `id,name,parent_id\n1,Star Wars,`);
      ingestSets(db, `set_num,name,year,theme_id,num_parts,img_url\n75192-1,Millennium Falcon,2017,1,7541,`);
      ingestMinifigs(db, `fig_num,name,num_parts,img_url\nfig-000001,Luke Skywalker,4,`);
      ingestInventories(db, `id,set_num,version\n1,75192-1,1`);

      const csv = `inventory_id,fig_num,quantity
1,fig-000001,1`;
      const count = ingestInventoryMinifigs(db, csv);
      expect(count).toBe(1);
    });
  });

  describe('ingestPartRelationships', () => {
    it('parses and inserts part relationships CSV', () => {
      const csv = `rel_type,child_part_num,parent_part_num
M,3001a,3001
P,3001pr0001,3001`;
      const count = ingestPartRelationships(db, csv);
      expect(count).toBe(2);

      const rows = db.prepare('SELECT * FROM part_relationships WHERE parent_part_num = ?').all('3001') as Array<{ rel_type: string }>;
      expect(rows).toHaveLength(2);
    });
  });

  describe('FTS5 population via ingestion', () => {
    it('populates FTS indexes through CSV ingestion triggers', () => {
      ingestThemes(db, `id,name,parent_id\n1,Star Wars,`);
      ingestSets(db, `set_num,name,year,theme_id,num_parts,img_url\n75192-1,Millennium Falcon,2017,1,7541,\n10030-1,Imperial Star Destroyer,2002,1,3104,`);
      ingestPartCategories(db, `id,name\n1,Bricks`);
      ingestParts(db, `part_num,name,part_cat_id,part_material\n3001,Brick 2 x 4,1,Plastic\n3002,Brick 2 x 3,1,Plastic`);
      ingestMinifigs(db, `fig_num,name,num_parts,img_url\nfig-000001,Luke Skywalker,4,\nfig-000002,Han Solo,4,`);

      // FTS should be populated by triggers
      expect(searchSets(db, 'Falcon')).toHaveLength(1);
      expect(searchParts(db, 'Brick')).toHaveLength(2);
      expect(searchMinifigs(db, 'Solo')).toHaveLength(1);
    });
  });

  describe('clearAllData', () => {
    it('clears all tables and rebuilds FTS', () => {
      ingestThemes(db, `id,name,parent_id\n1,Star Wars,`);
      ingestSets(db, `set_num,name,year,theme_id,num_parts,img_url\n75192-1,Millennium Falcon,2017,1,7541,`);

      clearAllData(db);

      const count = (db.prepare('SELECT COUNT(*) as count FROM sets').get() as { count: number }).count;
      expect(count).toBe(0);

      // FTS should also be cleared
      expect(searchSets(db, 'Falcon')).toHaveLength(0);
    });
  });

  describe('batch processing', () => {
    it('handles large batches correctly', () => {
      // Generate 2500 themes to test batch boundaries (BATCH_SIZE = 1000)
      const lines = ['id,name,parent_id'];
      for (let i = 1; i <= 2500; i++) {
        lines.push(`${i},Theme ${i},`);
      }
      const csv = lines.join('\n');
      const count = ingestThemes(db, csv);
      expect(count).toBe(2500);

      const dbCount = (db.prepare('SELECT COUNT(*) as count FROM themes').get() as { count: number }).count;
      expect(dbCount).toBe(2500);
    });
  });
});
