import { SYNC_MAX_CHANGES, SYNC_PAGE_SIZE, type SyncChange } from '@plantpal/shared';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { users } from '@/db/schema';
import { hasDb, resetDb, testDb } from '@/test/db';
import { createUser, uuid } from '@/test/users';

import { clampClientTime, runSync } from './sync-service';

const at = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();
const plantUpsert = (id: string, name: string, clientUpdatedAt = at(0)): SyncChange => ({
  kind: 'plant.upsert',
  id,
  clientUpdatedAt,
  data: { name, wateringIntervalDays: 7, coverPhotoId: null },
});

describe('clampClientTime', () => {
  it('keeps normal times and clamps times far in the future', () => {
    const now = new Date('2026-10-15T12:00:00Z');
    expect(clampClientTime('2026-10-15T11:59:00Z', now).toISOString()).toBe(
      '2026-10-15T11:59:00.000Z',
    );
    expect(clampClientTime('2027-01-01T00:00:00Z', now).toISOString()).toBe(
      '2026-10-15T12:01:00.000Z',
    );
  });
});

describe.skipIf(!hasDb)('runSync (integration)', () => {
  let user: Awaited<ReturnType<typeof createUser>>;
  const sync = (cursor: number, changes: SyncChange[] = [], u = user) =>
    runSync(testDb().db, u.id, { cursor, changes });

  beforeEach(async () => {
    await resetDb();
    user = await createUser();
  });

  it('pushes a new plant and pulls it back with a server version; the cursor advances', async () => {
    const id = uuid();
    const first = await sync(0, [plantUpsert(id, 'Monstera')]);
    expect(first.rejected).toEqual([]);
    expect(first.plants).toMatchObject([{ id, name: 'Monstera', deletedAt: null }]);
    expect(first.cursor).toBe(first.plants[0]!.serverVersion);

    const again = await sync(first.cursor);
    expect(again.plants).toEqual([]);
    expect(again.cursor).toBe(first.cursor);
  });

  it('last write wins: a newer edit replaces, an older edit is rejected and the winner is returned', async () => {
    const id = uuid();
    const created = await sync(0, [plantUpsert(id, 'Fern', at(-60_000))]);

    const newer = await sync(created.cursor, [plantUpsert(id, 'Boston fern', at(-30_000))]);
    expect(newer.rejected).toEqual([]);
    expect(newer.plants[0]!.name).toBe('Boston fern');

    // A device that was offline sends an edit made *before* the one above.
    const older = await sync(newer.cursor, [plantUpsert(id, 'Old name', at(-45_000))]);
    expect(older.rejected).toEqual([{ id, kind: 'plant.upsert', reason: 'stale' }]);
    // Its cursor is already past the winning row, but the winner comes back anyway.
    expect(older.plants).toMatchObject([{ id, name: 'Boston fern' }]);
  });

  it('a phone clock set in the future cannot win forever', async () => {
    const id = uuid();
    await sync(0, [plantUpsert(id, 'From the future', at(24 * 60 * 60_000))]);
    // Two minutes later (real time), a normal edit still wins, because the future one was clamped.
    const r = await runSync(
      testDb().db,
      user.id,
      { cursor: 0, changes: [plantUpsert(id, 'Normal edit', at(2 * 60_000))] },
      new Date(Date.now() + 2 * 60_000),
    );
    expect(r.rejected).toEqual([]);
    expect(r.plants.find((p) => p.id === id)?.name).toBe('Normal edit');
  });

  it("can't overwrite or delete another user's row, and doesn't leak it", async () => {
    const id = uuid();
    await sync(0, [plantUpsert(id, 'Mine')]);
    const intruder = await createUser();

    const r = await sync(
      0,
      [
        plantUpsert(id, 'Hacked', at(1000)),
        { kind: 'plant.delete', id, clientUpdatedAt: at(2000) },
      ],
      intruder,
    );
    expect(r.rejected.map((x) => x.reason)).toEqual(['forbidden', 'forbidden']);
    expect(r.plants).toEqual([]);

    const mine = await sync(0);
    expect(mine.plants).toMatchObject([{ id, name: 'Mine', deletedAt: null }]);
  });

  it('deleting a plant tombstones it and its children, and the tombstones sync', async () => {
    const plantId = uuid();
    const eventId = uuid();
    const photoId = uuid();
    const created = await sync(0, [
      plantUpsert(plantId, 'Cactus', at(-10_000)),
      {
        kind: 'wateringEvent.upsert',
        id: eventId,
        clientUpdatedAt: at(-9_000),
        data: { plantId, wateredAt: at(-9_000) },
      },
      {
        kind: 'plantPhoto.upsert',
        id: photoId,
        clientUpdatedAt: at(-8_000),
        data: { plantId, takenAt: at(-8_000) },
      },
    ]);

    const deleted = await sync(created.cursor, [
      { kind: 'plant.delete', id: plantId, clientUpdatedAt: at(0) },
    ]);
    expect(deleted.plants).toMatchObject([{ id: plantId, deletedAt: expect.any(String) }]);
    expect(deleted.wateringEvents).toMatchObject([{ id: eventId, deletedAt: expect.any(String) }]);
    expect(deleted.plantPhotos).toMatchObject([{ id: photoId, deletedAt: expect.any(String) }]);
  });

  it('a delete for something the server never saw is not an error', async () => {
    const r = await sync(0, [{ kind: 'plant.delete', id: uuid(), clientUpdatedAt: at(0) }]);
    expect(r.rejected).toEqual([]);
  });

  it('rejects a watering for a plant that is not mine', async () => {
    const r = await sync(0, [
      {
        kind: 'wateringEvent.upsert',
        id: uuid(),
        clientUpdatedAt: at(0),
        data: { plantId: uuid(), wateredAt: at(0) },
      },
    ]);
    expect(r.rejected).toMatchObject([{ reason: 'invalid' }]);
  });

  it('two phones watering the same plant offline: both events are kept (no conflict)', async () => {
    const plantId = uuid();
    const created = await sync(0, [plantUpsert(plantId, 'Basil')]);
    const phoneA = {
      kind: 'wateringEvent.upsert' as const,
      id: uuid(),
      clientUpdatedAt: at(1000),
      data: { plantId, wateredAt: at(1000) },
    };
    const phoneB = {
      kind: 'wateringEvent.upsert' as const,
      id: uuid(),
      clientUpdatedAt: at(2000),
      data: { plantId, wateredAt: at(2000) },
    };

    await sync(created.cursor, [phoneA]);
    const r = await sync(created.cursor, [phoneB]);
    expect(r.wateringEvents.map((e) => e.id).sort()).toEqual([phoneA.id, phoneB.id].sort());
  });

  it('retrying the same push is harmless (idempotent)', async () => {
    const change = plantUpsert(uuid(), 'Pothos');
    const first = await sync(0, [change]);
    const retry = await sync(0, [change]);
    // Same timestamp is not newer, so nothing changes; the client just drops it from its outbox.
    expect(retry.rejected).toMatchObject([{ reason: 'stale' }]);
    expect(retry.plants).toHaveLength(1);
    expect(retry.plants[0]!.serverVersion).toBe(first.plants[0]!.serverVersion);
  });

  it('pages through large pulls without losing rows', async () => {
    // Premium: the free plan would stop at 3 plants (see limits.test.ts).
    await testDb().db.update(users).set({ plan: 'premium' }).where(eq(users.id, user.id));
    const total = SYNC_PAGE_SIZE + 10;
    const ids = Array.from({ length: total }, () => uuid());
    for (let i = 0; i < total; i += SYNC_MAX_CHANGES) {
      await sync(
        0,
        ids.slice(i, i + SYNC_MAX_CHANGES).map((id, j) => plantUpsert(id, `p${i + j}`)),
      );
    }
    const page1 = await sync(0);
    expect(page1.plants).toHaveLength(SYNC_PAGE_SIZE);
    expect(page1.hasMore).toBe(true);
    const page2 = await sync(page1.cursor);
    expect(page2.plants).toHaveLength(10);
    expect(page2.hasMore).toBe(false);
    expect(new Set([...page1.plants, ...page2.plants].map((p) => p.id)).size).toBe(total);
  });

  it("only returns this user's rows", async () => {
    await sync(0, [plantUpsert(uuid(), 'Mine')]);
    const other = await createUser();
    await sync(0, [plantUpsert(uuid(), 'Theirs')], other);
    const r = await sync(0);
    expect(r.plants.map((p) => p.name)).toEqual(['Mine']);
  });
});
