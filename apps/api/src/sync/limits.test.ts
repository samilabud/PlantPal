import { randomUUID } from 'node:crypto';

import { FREE_PLANT_LIMIT, type SyncChange } from '@plantpal/shared';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { users } from '@/db/schema';
import { hasDb, resetDb, testDb } from '@/test/db';
import { createUser } from '@/test/users';

import { runSync } from './sync-service';

const now = () => new Date().toISOString();
const plant = (id = randomUUID(), name = 'p'): SyncChange => ({
  kind: 'plant.upsert',
  id,
  clientUpdatedAt: now(),
  data: { name, wateringIntervalDays: 7, coverPhotoId: null },
});
const photo = (plantId: string): SyncChange => ({
  kind: 'plantPhoto.upsert',
  id: randomUUID(),
  clientUpdatedAt: now(),
  data: { plantId, takenAt: now() },
});

describe.skipIf(!hasDb)('plan limits in sync (integration)', () => {
  let user: Awaited<ReturnType<typeof createUser>>;
  const sync = (changes: SyncChange[]) => runSync(testDb().db, user.id, { cursor: 0, changes });
  const setPlan = (plan: 'free' | 'premium', planExpiresAt: Date | null = null) =>
    testDb().db.update(users).set({ plan, planExpiresAt }).where(eq(users.id, user.id));

  beforeEach(async () => {
    await resetDb();
    user = await createUser();
  });

  it(`free users can create ${FREE_PLANT_LIMIT} plants; the next one is rejected with "limit"`, async () => {
    const r = await sync(Array.from({ length: FREE_PLANT_LIMIT + 1 }, () => plant()));
    expect(r.rejected.map((x) => x.reason)).toEqual(['limit']);
    expect(r.plants.filter((p) => !p.deletedAt)).toHaveLength(FREE_PLANT_LIMIT);
  });

  it('premium users have no plant limit', async () => {
    await setPlan('premium', new Date(Date.now() + 86_400_000));
    const r = await sync(Array.from({ length: FREE_PLANT_LIMIT + 2 }, () => plant()));
    expect(r.rejected).toEqual([]);
  });

  it('an expired premium is treated as free', async () => {
    await setPlan('premium', new Date(Date.now() - 1000));
    const r = await sync(Array.from({ length: FREE_PLANT_LIMIT + 1 }, () => plant()));
    expect(r.rejected.map((x) => x.reason)).toEqual(['limit']);
  });

  it('after downgrading, existing plants can still be edited, watered and deleted', async () => {
    await setPlan('premium');
    const ids = Array.from({ length: FREE_PLANT_LIMIT + 2 }, () => randomUUID());
    await sync(ids.map((id) => plant(id)));
    await setPlan('free');

    const r = await sync([
      plant(ids[0], 'renamed'),
      {
        kind: 'wateringEvent.upsert',
        id: randomUUID(),
        clientUpdatedAt: now(),
        data: { plantId: ids[1]!, wateredAt: now() },
      },
      { kind: 'plant.delete', id: ids[2]!, clientUpdatedAt: now() },
    ]);
    expect(r.rejected).toEqual([]);
  });

  it('free users get one photo per plant; premium keeps a photo history', async () => {
    const p = randomUUID();
    await sync([plant(p)]);
    const r = await sync([photo(p), photo(p)]);
    expect(r.rejected.map((x) => x.reason)).toEqual(['limit']);

    await setPlan('premium');
    expect((await sync([photo(p)])).rejected).toEqual([]);
  });
});
