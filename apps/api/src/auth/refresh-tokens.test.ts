import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { refreshTokens, users } from '@/db/schema';
import { hasDb, resetDb, testDb } from '@/test/db';

import { issueRefreshToken, revokeRefreshTokenFamily, rotateRefreshToken } from './refresh-tokens';

describe.skipIf(!hasDb)('refresh token rotation (integration)', () => {
  let userId: string;

  beforeEach(async () => {
    await resetDb();
    const [user] = await testDb().db.insert(users).values({}).returning({ id: users.id });
    userId = user!.id;
  });

  it('stores only a hash of the token', async () => {
    const { raw } = await issueRefreshToken(testDb().db, userId);
    const rows = await testDb().db.select().from(refreshTokens);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.tokenHash).not.toBe(raw);
  });

  it('rotates: the old token stops working and the new one works', async () => {
    const { db } = testDb();
    const first = await issueRefreshToken(db, userId);
    const second = await rotateRefreshToken(db, first.raw);
    expect(second.userId).toBe(userId);
    expect(second.refreshToken).not.toBe(first.raw);

    const third = await rotateRefreshToken(db, second.refreshToken);
    expect(third.userId).toBe(userId);
  });

  it('detects reuse of an old token and revokes the whole family', async () => {
    const { db } = testDb();
    const first = await issueRefreshToken(db, userId);
    const second = await rotateRefreshToken(db, first.raw);

    // An attacker replays the stolen first token...
    await expect(rotateRefreshToken(db, first.raw)).rejects.toMatchObject({
      status: 401,
      message: expect.stringMatching(/reused/),
    });
    // ...so the legitimate newer token is dead too.
    await expect(rotateRefreshToken(db, second.refreshToken)).rejects.toMatchObject({
      status: 401,
    });
  });

  it('rejects an expired token', async () => {
    const { db } = testDb();
    const past = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    const { raw } = await issueRefreshToken(db, userId, undefined, past);
    await expect(rotateRefreshToken(db, raw)).rejects.toMatchObject({
      message: expect.stringMatching(/expired/),
    });
  });

  it('lets only one of two parallel refreshes win', async () => {
    const { db } = testDb();
    const { raw } = await issueRefreshToken(db, userId);
    const results = await Promise.allSettled([
      rotateRefreshToken(db, raw),
      rotateRefreshToken(db, raw),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });

  it('logout revokes only that family', async () => {
    const { db } = testDb();
    const phone = await issueRefreshToken(db, userId);
    const tablet = await issueRefreshToken(db, userId);
    await revokeRefreshTokenFamily(db, phone.raw);

    await expect(rotateRefreshToken(db, phone.raw)).rejects.toMatchObject({ status: 401 });
    await expect(rotateRefreshToken(db, tablet.raw)).resolves.toMatchObject({ userId });
    const active = await db.select().from(refreshTokens).where(eq(refreshTokens.userId, userId));
    expect(active.length).toBeGreaterThan(0);
  });
});
