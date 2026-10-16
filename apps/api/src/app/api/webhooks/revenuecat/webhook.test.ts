import { randomUUID } from 'node:crypto';

import { Me } from '@plantpal/shared';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { users, webhookEvents } from '@/db/schema';
import { hasDb, resetDb, testDb } from '@/test/db';
import { signedWebhook, subscriber } from '@/test/revenuecat';
import { createUser } from '@/test/users';

import { POST as syncSubscription } from '../../subscription/sync/route';
import { POST as webhook } from './route';

const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();
const planOf = async (id: string) =>
  (
    await testDb()
      .db.select({ plan: users.plan, exp: users.planExpiresAt })
      .from(users)
      .where(eq(users.id, id))
  )[0]!;

describe.skipIf(!hasDb)('RevenueCat webhook (integration)', () => {
  let user: Awaited<ReturnType<typeof createUser>>;
  const fetchSpy = vi.fn();

  beforeEach(async () => {
    await resetDb();
    await testDb().db.delete(webhookEvents);
    user = await createUser();
    vi.stubEnv('REVENUECAT_SECRET_KEY', 'sk_test_only');
    vi.stubGlobal('fetch', fetchSpy);
    fetchSpy.mockReset();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('INITIAL_PURCHASE -> reads the entitlement from RevenueCat -> user is premium', async () => {
    fetchSpy.mockResolvedValue(subscriber(inDays(30)));
    const res = await webhook(
      signedWebhook({
        type: 'INITIAL_PURCHASE',
        app_user_id: user.id,
        entitlement_ids: ['premium'],
      }),
    );
    expect(res.status).toBe(200);
    expect(fetchSpy.mock.calls[0]![0]).toBe(`https://api.revenuecat.com/v1/subscribers/${user.id}`);
    expect((await planOf(user.id)).plan).toBe('premium');
  });

  it('REPLAY: the same event delivered twice is processed once', async () => {
    fetchSpy.mockResolvedValue(subscriber(inDays(30)));
    const event = { id: randomUUID(), type: 'RENEWAL', app_user_id: user.id };
    const first = await webhook(signedWebhook(event));
    const second = await webhook(signedWebhook(event)); // RevenueCat re-signs retries: fresh t/v1
    expect(await first.json()).toMatchObject({ ok: true, users: 1 });
    expect(await second.json()).toEqual({ ok: true, duplicate: true });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('OUT OF ORDER: an old EXPIRATION arriving after a renewal cannot downgrade the user', async () => {
    // RevenueCat says: active for 30 more days (the renewal already happened).
    // A fresh Response per call: a Response body can only be read once.
    fetchSpy.mockImplementation(async () => subscriber(inDays(30)));
    const renewal = await webhook(signedWebhook({ type: 'RENEWAL', app_user_id: user.id }));
    const lateExpiration = await webhook(
      signedWebhook({ type: 'EXPIRATION', app_user_id: user.id, entitlement_ids: ['premium'] }),
    );
    // Both must be fully processed, or this test would pass for the wrong reason.
    expect([renewal.status, lateExpiration.status]).toEqual([200, 200]);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect((await planOf(user.id)).plan).toBe('premium'); // the event's type didn't matter, the state did
  });

  it('EXPIRATION when RevenueCat agrees -> free', async () => {
    fetchSpy
      .mockResolvedValueOnce(subscriber(inDays(30)))
      .mockResolvedValueOnce(subscriber(inDays(-1)));
    await webhook(signedWebhook({ type: 'INITIAL_PURCHASE', app_user_id: user.id }));
    await webhook(signedWebhook({ type: 'EXPIRATION', app_user_id: user.id }));
    expect(await planOf(user.id)).toEqual({ plan: 'free', exp: null });
  });

  it('if RevenueCat is down: non-200 (so it retries) and the retry processes the event', async () => {
    const event = { id: randomUUID(), type: 'INITIAL_PURCHASE', app_user_id: user.id };
    fetchSpy.mockResolvedValueOnce(new Response('oops', { status: 500 }));
    expect((await webhook(signedWebhook(event))).status).toBe(502);
    expect((await planOf(user.id)).plan).toBe('free');

    fetchSpy.mockResolvedValueOnce(subscriber(inDays(30)));
    expect((await webhook(signedWebhook(event))).status).toBe(200);
    expect((await planOf(user.id)).plan).toBe('premium');
  });

  it('rejects unsigned, wrongly signed and tampered requests before touching the database', async () => {
    const e = { type: 'INITIAL_PURCHASE', app_user_id: user.id };
    expect((await webhook(signedWebhook(e, { auth: 'Bearer wrong' }))).status).toBe(401);
    expect((await webhook(signedWebhook(e, { secret: 'not-the-secret' }))).status).toBe(401);
    expect((await webhook(signedWebhook(e, { tamper: true }))).status).toBe(401);
    expect(
      (await webhook(signedWebhook(e, { t: Math.floor(Date.now() / 1000) - 3600 }))).status,
    ).toBe(401);
    expect(await testDb().db.select().from(webhookEvents)).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('ignores events for ids that are not our users (e.g. anonymous RevenueCat ids)', async () => {
    const res = await webhook(
      signedWebhook({ type: 'INITIAL_PURCHASE', app_user_id: '$RCAnonymousID:abc' }),
    );
    expect(await res.json()).toEqual({ ok: true, users: 0 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('POST /api/subscription/sync: the app asks right after buying; the server checks RevenueCat itself', async () => {
    fetchSpy.mockResolvedValue(subscriber(inDays(365)));
    const res = await syncSubscription(
      new Request('http://test', { method: 'POST', headers: user.auth }),
    );
    const me = Me.parse(await res.json());
    expect(me.plan).toBe('premium');
    expect(me.planExpiresAt).not.toBeNull();
  });
});
