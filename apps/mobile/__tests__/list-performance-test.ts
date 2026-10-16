import { listPlants } from '@/data/plants';
import { migrate } from '@/db/migrations';
import type { SqlDb } from '@/db/types';

import { openTestDb } from '../test/sqlite-node';

/**
 * Performance check for the main list query (M6). The list computes "last watered" per plant
 * with a correlated subquery, the classic way a list gets slower as data grows. We measure it
 * with far more data than a real user has, and check SQLite uses the index instead of scanning.
 */
const PLANTS = 1000;
const WATERINGS_PER_PLANT = 30;

async function seed(db: SqlDb) {
  await db.withExclusiveTransactionAsync(async (tx) => {
    for (let p = 0; p < PLANTS; p++) {
      const id = `plant-${p}`;
      await tx.runAsync(
        `INSERT INTO plants (id, name, watering_interval_days, client_updated_at) VALUES (?, ?, 7, '2026-01-01T00:00:00Z')`,
        [id, `Plant ${String(p).padStart(4, '0')}`],
      );
      for (let w = 0; w < WATERINGS_PER_PLANT; w++) {
        const at = new Date(Date.UTC(2026, 0, 1 + w)).toISOString();
        await tx.runAsync(
          'INSERT INTO watering_events (id, plant_id, watered_at, client_updated_at) VALUES (?, ?, ?, ?)',
          [`${id}-w${w}`, id, at, at],
        );
      }
    }
  });
}

describe('plant list query performance', () => {
  let db: SqlDb;
  beforeAll(async () => {
    db = openTestDb();
    await migrate(db);
    await seed(db);
  });

  it('uses the (plant_id, watered_at) index for "last watered", not a table scan', async () => {
    const plan = await db.getAllAsync<{ detail: string }>(
      `EXPLAIN QUERY PLAN SELECT MAX(w.watered_at) FROM watering_events w
       WHERE w.plant_id = ? AND w.deleted_at IS NULL`,
      ['plant-1'],
    );
    const text = plan.map((r) => r.detail).join(' | ');
    expect(text).toMatch(/USING INDEX watering_events_plant/);
    expect(text).not.toMatch(/SCAN w\b/);
  });

  it(`lists ${PLANTS} plants (${PLANTS * WATERINGS_PER_PLANT} waterings) fast`, async () => {
    await listPlants(db); // warm up
    const runs = 5;
    const start = performance.now();
    for (let i = 0; i < runs; i++) {
      const rows = await listPlants(db);
      expect(rows).toHaveLength(PLANTS);
      expect(rows[0]!.lastWateredAt).toBe('2026-01-30T00:00:00.000Z');
    }
    const avg = (performance.now() - start) / runs;
    console.log(
      `[perf] listPlants: ${PLANTS} plants, ${PLANTS * WATERINGS_PER_PLANT} waterings -> ${avg.toFixed(1)} ms avg`,
    );
    // Generous budget so CI noise can't make it flaky; a full table scan per plant blows past it.
    expect(avg).toBeLessThan(200);
  });

  it('for comparison: the same query without the index (why the index matters)', async () => {
    await db.execAsync('DROP INDEX watering_events_plant');
    const start = performance.now();
    await listPlants(db);
    const withoutIndex = performance.now() - start;
    console.log(`[perf] listPlants WITHOUT the index -> ${withoutIndex.toFixed(1)} ms`);
    await db.execAsync(
      'CREATE INDEX watering_events_plant ON watering_events (plant_id, watered_at)',
    );
    expect(withoutIndex).toBeGreaterThan(0);
  });
});
