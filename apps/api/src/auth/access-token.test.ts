import { describe, expect, it } from 'vitest';

import { ACCESS_TOKEN_TTL_SECONDS, signAccessToken, verifyAccessToken } from './access-token';

const secret = new TextEncoder().encode('a'.repeat(32));
const userId = '6f1c1d36-58a1-4a7e-9c2a-1f9f0b1f6b7e';

describe('access tokens', () => {
  it('round-trips the user id and expires after 15 minutes', async () => {
    const now = new Date(Math.floor(Date.now() / 1000) * 1000);
    const { token, expiresAt } = await signAccessToken(userId, secret, now);
    expect(await verifyAccessToken(token, secret)).toBe(userId);
    expect(Math.round((expiresAt.getTime() - now.getTime()) / 1000)).toBe(ACCESS_TOKEN_TTL_SECONDS);
  });

  it('rejects a token signed with another secret', async () => {
    const { token } = await signAccessToken(userId, new TextEncoder().encode('b'.repeat(32)));
    await expect(verifyAccessToken(token, secret)).rejects.toMatchObject({ status: 401 });
  });

  it('rejects an expired token', async () => {
    const { token } = await signAccessToken(userId, secret, new Date(Date.now() - 16 * 60_000));
    await expect(verifyAccessToken(token, secret)).rejects.toMatchObject({ status: 401 });
  });
});
