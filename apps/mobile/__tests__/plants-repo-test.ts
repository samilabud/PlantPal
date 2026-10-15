import {
  addPhoto,
  createPlant,
  deletePlant,
  getPlant,
  listPhotos,
  listPlants,
  updatePlant,
  waterPlant,
} from '@/data/plants';
import { migrate } from '@/db/migrations';
import type { SqlDb } from '@/db/types';

import { openTestDb } from '../test/sqlite-node';

jest.mock('expo-crypto', () => ({ randomUUID: () => require('node:crypto').randomUUID() }));

const outbox = (db: SqlDb) =>
  db.getAllAsync<{ seq: number; kind: string; entity_id: string }>(
    'SELECT seq, kind, entity_id FROM outbox ORDER BY seq',
    [],
  );

describe('plant repository (real SQLite)', () => {
  let db: SqlDb;
  beforeEach(async () => {
    db = openTestDb();
    await migrate(db);
  });

  it('migrations are idempotent', async () => {
    await expect(migrate(db)).resolves.toBeUndefined();
  });

  it('creating a plant writes the row and queues it, atomically', async () => {
    const id = await createPlant(db, { name: 'Monstera', wateringIntervalDays: 7 });
    expect(await getPlant(db, id)).toMatchObject({
      name: 'Monstera',
      wateringIntervalDays: 7,
      lastWateredAt: null,
    });
    expect(await outbox(db)).toMatchObject([{ kind: 'plant.upsert', entity_id: id }]);
  });

  it('two edits before syncing collapse into one pending change with a new seq', async () => {
    const id = await createPlant(db, { name: 'Fern', wateringIntervalDays: 3 });
    const [before] = await outbox(db);
    await updatePlant(db, id, { name: 'Boston fern', wateringIntervalDays: 4 });
    const after = await outbox(db);
    expect(after).toHaveLength(1);
    expect(after[0]!.seq).toBeGreaterThan(before!.seq);
  });

  it('watering adds an event and moves "last watered"', async () => {
    const id = await createPlant(db, { name: 'Basil', wateringIntervalDays: 2 });
    await waterPlant(db, id, '2026-10-14T09:00:00.000Z');
    await waterPlant(db, id, '2026-10-15T09:00:00.000Z');
    expect((await listPlants(db))[0]!.lastWateredAt).toBe('2026-10-15T09:00:00.000Z');
    expect((await outbox(db)).filter((r) => r.kind === 'wateringEvent.upsert')).toHaveLength(2);
  });

  it('deleting hides the plant, queues one delete and drops its pending children', async () => {
    const id = await createPlant(db, { name: 'Cactus', wateringIntervalDays: 14 });
    await waterPlant(db, id);
    await deletePlant(db, id);
    expect(await listPlants(db)).toEqual([]);
    expect((await outbox(db)).map((r) => r.kind)).toEqual(['plant.delete']);
  });

  it('a new photo is pending (not queued) and becomes the cover', async () => {
    const id = await createPlant(db, { name: 'Pothos', wateringIntervalDays: 5 });
    await addPhoto(db, id, 'photo-1', 'file:///photos/photo-1.jpg');
    expect(await listPhotos(db, id)).toMatchObject([{ id: 'photo-1', uploadState: 'pending' }]);
    expect((await getPlant(db, id))!.coverPhotoId).toBe('photo-1');
    expect((await outbox(db)).map((r) => r.kind)).toEqual(['plant.upsert']); // the cover change only
  });
});
