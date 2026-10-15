import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { devices, pushTickets } from '@/db/schema';
import { runSync } from '@/sync/sync-service';
import { hasDb, resetDb, testDb } from '@/test/db';
import { createUser } from '@/test/users';

import { processReceipts, sendPushes, type PushMessage } from './expo-push';
import { buildReminderMessages, digestFor, findOverduePlants } from './reminders';

const token = (n: number | string) => `ExponentPushToken[device-${n}]`;
const message = (to: string): PushMessage => ({
  to,
  title: 't',
  body: 'b',
  data: { url: '/' },
  sound: 'default',
  channelId: 'reminders',
});
const reply = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

async function addDevice(userId: string, t: string) {
  await testDb().db.insert(devices).values({ userId, expoPushToken: t, platform: 'android' });
}

describe('digestFor', () => {
  it('deep links to the plant when there is one', () => {
    expect(digestFor([{ id: 'p1', name: 'Fern' }])).toMatchObject({
      title: '🪴 Fern needs water',
      data: { url: '/plants/p1' },
    });
  });
  it('summarises many plants and opens the list', () => {
    const d = digestFor(['A', 'B', 'C', 'D', 'E'].map((n) => ({ id: n, name: n })));
    expect(d).toMatchObject({
      title: '🪴 5 plants need water',
      body: 'A, B, C and 2 more',
      data: { url: '/' },
    });
  });
});

describe.skipIf(!hasDb)('push (integration)', () => {
  let user: Awaited<ReturnType<typeof createUser>>;
  beforeEach(async () => {
    await resetDb();
    await testDb().db.delete(pushTickets);
    user = await createUser();
  });

  it('sends in batches of 100 and stores the ok tickets', async () => {
    const fetchFn = vi.fn(async (_url: string, init: RequestInit) => {
      const batch = JSON.parse(init.body as string) as PushMessage[];
      return reply({ data: batch.map(() => ({ status: 'ok', id: randomUUID() })) });
    });
    const messages = Array.from({ length: 150 }, (_, i) => message(token(i)));
    const result = await sendPushes(testDb().db, messages, fetchFn as unknown as typeof fetch);

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchFn.mock.calls[0]![1].body as string)).toHaveLength(100);
    expect(result).toEqual({ accepted: 150, failed: 0, removedTokens: 0 });
    expect(await testDb().db.select().from(pushTickets)).toHaveLength(150);
  });

  it('forgets a token as soon as Expo says DeviceNotRegistered', async () => {
    await addDevice(user.id, token('dead'));
    await addDevice(user.id, token('alive'));
    const fetchFn = vi.fn(async () =>
      reply({
        data: [
          { status: 'error', message: 'not registered', details: { error: 'DeviceNotRegistered' } },
          { status: 'ok', id: 'ticket-1' },
        ],
      }),
    );
    const result = await sendPushes(
      testDb().db,
      [message(token('dead')), message(token('alive'))],
      fetchFn as unknown as typeof fetch,
    );
    expect(result).toEqual({ accepted: 1, failed: 1, removedTokens: 1 });
    const left = await testDb().db.select({ t: devices.expoPushToken }).from(devices);
    expect(left).toEqual([{ t: token('alive') }]);
  });

  it('reads receipts after 15 minutes and removes dead tokens', async () => {
    await addDevice(user.id, token('a'));
    await addDevice(user.id, token('b'));
    const old = new Date(Date.now() - 20 * 60_000);
    await testDb()
      .db.insert(pushTickets)
      .values([
        { id: 'r-ok', expoPushToken: token('a'), createdAt: old },
        { id: 'r-dead', expoPushToken: token('b'), createdAt: old },
        { id: 'r-new', expoPushToken: token('a') }, // too recent: not checked yet
      ]);
    const fetchFn = vi.fn(async (_url: string, init: RequestInit) => {
      expect(JSON.parse(init.body as string).ids.sort()).toEqual(['r-dead', 'r-ok']);
      return reply({
        data: {
          'r-ok': { status: 'ok' },
          'r-dead': { status: 'error', details: { error: 'DeviceNotRegistered' } },
        },
      });
    });

    const result = await processReceipts(testDb().db, fetchFn as unknown as typeof fetch);
    expect(result).toEqual({ checked: 2, removedTokens: 1 });
    expect((await testDb().db.select().from(pushTickets)).map((t) => t.id)).toEqual(['r-new']);
    expect(
      await testDb()
        .db.select()
        .from(devices)
        .where(eq(devices.expoPushToken, token('b'))),
    ).toEqual([]);
  });

  it('finds plants that are overdue by 12h+ (and ignores watered and deleted ones)', async () => {
    const now = new Date();
    const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();
    const [thirsty, fine, gone] = [randomUUID(), randomUUID(), randomUUID()];
    const plant = (id: string, name: string, interval: number) => ({
      kind: 'plant.upsert' as const,
      id,
      clientUpdatedAt: daysAgo(10),
      data: { name, wateringIntervalDays: interval, coverPhotoId: null },
    });
    const water = (plantId: string, at: string) => ({
      kind: 'wateringEvent.upsert' as const,
      id: randomUUID(),
      clientUpdatedAt: at,
      data: { plantId, wateredAt: at },
    });
    await runSync(testDb().db, user.id, {
      cursor: 0,
      changes: [
        plant(thirsty, 'Thirsty', 3),
        water(thirsty, daysAgo(5)), // due 2 days ago
        plant(fine, 'Fine', 7),
        water(fine, daysAgo(1)), // due in 6 days
        plant(gone, 'Gone', 1),
        water(gone, daysAgo(5)),
        { kind: 'plant.delete', id: gone, clientUpdatedAt: daysAgo(0) },
      ],
    });

    const overdue = await findOverduePlants(testDb().db, now);
    expect(overdue.map((p) => p.name)).toEqual(['Thirsty']);

    await addDevice(user.id, token('phone'));
    const messages = await buildReminderMessages(testDb().db, now);
    expect(messages).toMatchObject([{ to: token('phone'), data: { url: `/plants/${thirsty}` } }]);
  });
});
