import type { SyncRequest, SyncResponse } from '@plantpal/shared';

import { createPlant, getPlant, listPlants, updatePlant } from '@/data/plants';
import { migrate } from '@/db/migrations';
import type { SqlDb } from '@/db/types';
import { uploadPendingPhotos } from '@/sync/photo-uploader';
import { syncOnce } from '@/sync/engine';
import { addPhoto } from '@/data/plants';

import { openTestDb } from '../test/sqlite-node';

jest.mock('expo-crypto', () => ({ randomUUID: () => require('node:crypto').randomUUID() }));

const empty = (cursor: number, extra: Partial<SyncResponse> = {}): SyncResponse => ({
  cursor,
  hasMore: false,
  plants: [],
  wateringEvents: [],
  plantPhotos: [],
  rejected: [],
  ...extra,
});
const plantRecord = (id: string, name: string, serverVersion: number) => ({
  id,
  name,
  wateringIntervalDays: 7,
  coverPhotoId: null,
  clientUpdatedAt: new Date().toISOString(),
  serverVersion,
  deletedAt: null,
});
const outboxCount = async (db: SqlDb) =>
  (await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM outbox', []))!.n;

describe('syncOnce (real SQLite, fake server)', () => {
  let db: SqlDb;
  beforeEach(async () => {
    db = openTestDb();
    await migrate(db);
  });

  it('pushes the outbox, clears it, applies pulled rows and stores the cursor', async () => {
    const id = await createPlant(db, { name: 'Monstera', wateringIntervalDays: 7 });
    const send = jest.fn(async (req: SyncRequest) => {
      expect(req).toMatchObject({ cursor: 0, changes: [{ kind: 'plant.upsert', id }] });
      return empty(5, {
        plants: [
          plantRecord(id, 'Monstera', 5),
          plantRecord('b6a8f6d2-2c3e-4bf7-9a49-0c2f4f1e9e11', 'From my tablet', 4),
        ],
      });
    });

    const result = await syncOnce(db, send);
    expect(result).toMatchObject({ pushed: 1, pulled: 2 });
    expect(await outboxCount(db)).toBe(0);
    expect((await listPlants(db)).map((p) => p.name)).toEqual(['From my tablet', 'Monstera']);

    // Next sync starts from the stored cursor.
    const next = jest.fn(async (_req: SyncRequest) => empty(5));
    await syncOnce(db, next);
    expect(next.mock.calls[0]![0].cursor).toBe(5);
  });

  it('an edit made while the request is in flight is kept and sent in the next round', async () => {
    const id = await createPlant(db, { name: 'v1', wateringIntervalDays: 7 });
    const send = jest
      .fn()
      .mockImplementationOnce(async () => {
        await updatePlant(db, id, { name: 'v2', wateringIntervalDays: 7 }); // user edits mid-request
        return empty(1, { plants: [plantRecord(id, 'v1', 1)] });
      })
      .mockImplementationOnce(async (req: SyncRequest) => {
        expect(req.changes).toMatchObject([{ kind: 'plant.upsert', data: { name: 'v2' } }]);
        return empty(2, { plants: [plantRecord(id, 'v2', 2)] });
      });

    await syncOnce(db, send);
    expect(send).toHaveBeenCalledTimes(2);
    expect((await getPlant(db, id))!.name).toBe('v2'); // the server's stale v1 didn't overwrite it
    expect(await outboxCount(db)).toBe(0);
  });

  it('keeps paging while the server says hasMore', async () => {
    const send = jest
      .fn()
      .mockResolvedValueOnce(
        empty(10, {
          hasMore: true,
          plants: [plantRecord('6f1c1d36-58a1-4a7e-9c2a-1f9f0b1f6b70', 'A', 10)],
        }),
      )
      .mockResolvedValueOnce(
        empty(20, { plants: [plantRecord('6f1c1d36-58a1-4a7e-9c2a-1f9f0b1f6b71', 'B', 20)] }),
      );
    const result = await syncOnce(db, send);
    expect(result.rounds).toBe(2);
    expect(send.mock.calls[1]![0].cursor).toBe(10);
    expect(await listPlants(db)).toHaveLength(2);
  });

  it('a failed request (offline) changes nothing and keeps the outbox', async () => {
    await createPlant(db, { name: 'Offline plant', wateringIntervalDays: 7 });
    const send = jest.fn().mockRejectedValue(new Error('Network request failed'));
    await expect(syncOnce(db, send)).rejects.toThrow('Network request failed');
    expect(await outboxCount(db)).toBe(1);
    expect(await listPlants(db)).toHaveLength(1);
  });

  it('a stale rejection drops the local change and takes the server winner', async () => {
    const id = await createPlant(db, { name: 'Mine (older)', wateringIntervalDays: 7 });
    const send = jest.fn(async () =>
      empty(9, {
        rejected: [{ id, kind: 'plant.upsert', reason: 'stale' as const }],
        plants: [plantRecord(id, 'Theirs (newer)', 9)],
      }),
    );
    await syncOnce(db, send);
    expect((await getPlant(db, id))!.name).toBe('Theirs (newer)');
    expect(await outboxCount(db)).toBe(0);
  });
});

describe('uploadPendingPhotos', () => {
  let db: SqlDb;
  beforeEach(async () => {
    db = openTestDb();
    await migrate(db);
  });

  it('uploads, then queues the photo row; a failure leaves it pending for retry', async () => {
    const plantId = await createPlant(db, { name: 'Pothos', wateringIntervalDays: 5 });
    await addPhoto(db, plantId, 'photo-ok', 'file:///ok.jpg');
    await addPhoto(
      db,
      plantId,
      'photo-bad',
      'file:///bad.jpg',
      new Date(Date.now() + 1000).toISOString(),
    );

    const putFile = jest.fn(async (_url: string, uri: string) => {
      if (uri.includes('bad')) throw new Error('upload failed');
    });
    await expect(
      uploadPendingPhotos(db, {
        fileSize: () => 1234,
        getUploadUrl: async (id) => `https://blob.test/${id}`,
        putFile,
      }),
    ).rejects.toThrow('upload failed');

    const states = await db.getAllAsync<{ id: string; s: string }>(
      'SELECT id, upload_state AS s FROM plant_photos ORDER BY id',
      [],
    );
    expect(states).toEqual([
      { id: 'photo-bad', s: 'pending' },
      { id: 'photo-ok', s: 'done' },
    ]);
    const queued = await db.getAllAsync<{ entity_id: string }>(
      "SELECT entity_id FROM outbox WHERE kind = 'plantPhoto.upsert'",
      [],
    );
    expect(queued).toEqual([{ entity_id: 'photo-ok' }]);
  });
});
