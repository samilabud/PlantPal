import { beforeEach, describe, expect, it, vi } from 'vitest';

import { devices } from '@/db/schema';
import { hasDb, resetDb, testDb } from '@/test/db';
import { createUser } from '@/test/users';

import { GET as cron } from '../cron/reminders/route';
import { POST as testPush } from '../push/test/route';
import { DELETE as unregister, POST as register } from './route';

const req = (method: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request('http://test', {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
const t = 'ExponentPushToken[abc123]';

describe.skipIf(!hasDb)('device and push routes (integration)', () => {
  beforeEach(async () => {
    await resetDb();
    vi.unstubAllGlobals();
  });

  it('registers a token, moves it when another account signs in on the phone, and unregisters', async () => {
    const alice = await createUser();
    const bob = await createUser();
    expect(
      (await register(req('POST', { expoPushToken: t, platform: 'android' }, alice.auth))).status,
    ).toBe(200);
    await register(req('POST', { expoPushToken: t, platform: 'android' }, bob.auth));

    const rows = await testDb().db.select().from(devices);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.userId).toBe(bob.id);

    await unregister(req('DELETE', { expoPushToken: t }, alice.auth)); // not hers anymore: no effect
    expect(await testDb().db.select().from(devices)).toHaveLength(1);
    await unregister(req('DELETE', { expoPushToken: t }, bob.auth));
    expect(await testDb().db.select().from(devices)).toHaveLength(0);
  });

  it('rejects something that is not an Expo push token', async () => {
    const u = await createUser();
    const res = await register(req('POST', { expoPushToken: 'hello', platform: 'ios' }, u.auth));
    expect(res.status).toBe(400);
  });

  it('cron refuses requests without the secret', async () => {
    const res = await cron(
      new Request('http://test', { headers: { authorization: 'Bearer wrong' } }),
    );
    expect(res.status).toBe(401);
    expect((await cron(new Request('http://test'))).status).toBe(401);
  });

  it('cron runs with the secret (nothing overdue: nothing sent)', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const res = await cron(
      new Request('http://test', {
        headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ devices: 0, accepted: 0 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('manual test push goes to my devices with a deep link', async () => {
    const u = await createUser();
    await register(req('POST', { expoPushToken: t, platform: 'android' }, u.auth));
    const fetchSpy = vi.fn(
      async () => new Response(JSON.stringify({ data: [{ status: 'ok', id: 'x1' }] })),
    );
    vi.stubGlobal('fetch', fetchSpy);

    const plantId = '6f1c1d36-58a1-4a7e-9c2a-1f9f0b1f6b7e';
    const res = await testPush(req('POST', { plantId }, u.auth));
    expect(await res.json()).toEqual({ devices: 1, accepted: 1, failed: 0, removedTokens: 0 });
    const sent = JSON.parse(
      (fetchSpy.mock.calls[0] as unknown as [string, RequestInit])[1].body as string,
    );
    expect(sent).toMatchObject([
      { to: t, data: { url: `/plants/${plantId}` }, channelId: 'reminders' },
    ]);
  });
});
