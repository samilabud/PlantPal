import { Me, RefreshResponse, SessionResponse } from '@plantpal/shared';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { jwks, sha256Hex } from '@/auth/id-tokens';
import { authIdentities, refreshTokens, users, webhookEvents } from '@/db/schema';
import { hasDb, resetDb, testDb } from '@/test/db';
import { fakeIdp } from '@/test/keys';

import { DELETE as deleteMe, GET as getMe } from '../me/route';
import { POST as appleSignIn } from './apple/route';
import { POST as devSignIn } from './dev/route';
import { POST as googleSignIn } from './google/route';
import { POST as logout } from './logout/route';
import { POST as refresh } from './refresh/route';

import { deleteUserPhotos } from '@/storage/photos';

vi.mock('@/storage/photos', () => ({ deleteUserPhotos: vi.fn(async () => undefined) }));

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('http://test/api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

describe.skipIf(!hasDb)('auth routes (integration)', () => {
  let idp: Awaited<ReturnType<typeof fakeIdp>>;

  beforeAll(async () => {
    idp = await fakeIdp();
    // Point the verifiers at our fake identity provider instead of Apple/Google.
    jwks.apple = idp.keys;
    jwks.google = idp.keys;
  });
  beforeEach(resetDb);

  it('dev sign-in -> /me -> refresh -> logout', async () => {
    const signIn = await devSignIn(post({ name: 'maestro' }));
    expect(signIn.status).toBe(200);
    const session = SessionResponse.parse(await signIn.json());
    expect(session.user).toMatchObject({ email: 'maestro@dev.plantpal.test', plan: 'free' });

    const me = await getMe(
      new Request('http://test', { headers: bearer(session.tokens.accessToken) }),
    );
    expect(Me.parse(await me.json()).id).toBe(session.user.id);

    const refreshed = await refresh(post({ refreshToken: session.tokens.refreshToken }));
    const { tokens } = RefreshResponse.parse(await refreshed.json());
    expect(tokens.refreshToken).not.toBe(session.tokens.refreshToken);

    expect((await logout(post({ refreshToken: tokens.refreshToken }))).status).toBe(200);
    const afterLogout = await refresh(post({ refreshToken: tokens.refreshToken }));
    expect(afterLogout.status).toBe(401);
  });

  it('signing in twice with the same provider account reuses the user', async () => {
    const a = SessionResponse.parse(await (await devSignIn(post({ name: 'same' }))).json());
    const b = SessionResponse.parse(await (await devSignIn(post({ name: 'same' }))).json());
    expect(a.user.id).toBe(b.user.id);
  });

  it('/me without a token is 401 with the shared error body', async () => {
    const res = await getMe(new Request('http://test'));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: { code: 'unauthorized', message: 'Not signed in' },
    });
  });

  it('a bad body is a 400, not a 500', async () => {
    const res = await devSignIn(post({ name: 'NOT VALID!' }));
    expect(res.status).toBe(400);
  });

  it('Apple sign-in verifies the token and keeps the email Apple sent once', async () => {
    const rawNonce = 'nonce-for-this-sign-in-123';
    const identityToken = await idp.sign(
      { sub: 'apple-sub-1', nonce: sha256Hex(rawNonce) },
      { iss: 'https://appleid.apple.com', aud: 'com.samilabud.plantpal.dev' },
    );
    const res = await appleSignIn(post({ identityToken, rawNonce, email: 'first@example.com' }));
    expect(res.status).toBe(200);
    const session = SessionResponse.parse(await res.json());
    expect(session.user).toMatchObject({ email: 'first@example.com', providers: ['apple'] });

    const wrongNonce = await appleSignIn(post({ identityToken, rawNonce: 'x'.repeat(20) }));
    expect(wrongNonce.status).toBe(401);
  });

  it('Google sign-in creates a user with the verified email', async () => {
    const idToken = await idp.sign(
      { sub: 'google-sub-1', email: 'g@example.com', email_verified: true },
      {
        iss: 'https://accounts.google.com',
        aud: 'test-web-client.apps.googleusercontent.com',
      },
    );
    const res = await googleSignIn(post({ idToken }));
    expect(res.status).toBe(200);
    expect(SessionResponse.parse(await res.json()).user).toMatchObject({
      email: 'g@example.com',
      providers: ['google'],
    });
  });

  it('account deletion wipes the user, identities, tokens, webhook log and RevenueCat customer', async () => {
    const session = SessionResponse.parse(
      await (await devSignIn(post({ name: 'to-delete' }))).json(),
    );
    vi.stubEnv('REVENUECAT_SECRET_KEY', 'sk_test_only');
    const fetchSpy = vi.fn(async () => new Response(null, { status: 404 })); // 404 = nothing to delete
    vi.stubGlobal('fetch', fetchSpy);
    await testDb()
      .db.insert(webhookEvents)
      .values({ id: 'evt-1', type: 'RENEWAL', appUserId: session.user.id });
    const res = await deleteMe(
      new Request('http://test/api/me', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...bearer(session.tokens.accessToken) },
        body: '{}',
      }),
    );
    expect(await res.json()).toEqual({ deleted: true, appleRevoked: false });
    expect(deleteUserPhotos).toHaveBeenCalledWith(session.user.id);
    expect(fetchSpy).toHaveBeenCalledWith(
      `https://api.revenuecat.com/v1/subscribers/${session.user.id}`,
      expect.objectContaining({ method: 'DELETE' }),
    );

    const { db } = testDb();
    expect(await db.select().from(users)).toHaveLength(0);
    expect(await db.select().from(authIdentities)).toHaveLength(0);
    expect(await db.select().from(refreshTokens)).toHaveLength(0);
    expect(await db.select().from(webhookEvents)).toHaveLength(0);

    // The still-unexpired access token no longer maps to a user.
    const me = await getMe(
      new Request('http://test', { headers: bearer(session.tokens.accessToken) }),
    );
    expect(me.status).toBe(401);
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('account deletion still succeeds when RevenueCat is down', async () => {
    const session = SessionResponse.parse(
      await (await devSignIn(post({ name: 'rc-down' }))).json(),
    );
    vi.stubEnv('REVENUECAT_SECRET_KEY', 'sk_test_only');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network');
      }),
    );
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = await deleteMe(
      new Request('http://test/api/me', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...bearer(session.tokens.accessToken) },
        body: '{}',
      }),
    );
    expect(res.status).toBe(200);
    expect(await testDb().db.select().from(users)).toHaveLength(0);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
});
