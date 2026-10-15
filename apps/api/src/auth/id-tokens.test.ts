import { beforeAll, describe, expect, it } from 'vitest';

import { fakeIdp } from '@/test/keys';

import { sha256Hex, verifyAppleIdToken, verifyGoogleIdToken } from './id-tokens';

const APPLE_ISS = 'https://appleid.apple.com';
const APPLE_AUD = 'com.samilabud.plantpal.dev';
const GOOGLE_AUD = 'web-client.apps.googleusercontent.com';
const rawNonce = 'a-random-nonce-of-decent-length';

let idp: Awaited<ReturnType<typeof fakeIdp>>;
beforeAll(async () => {
  idp = await fakeIdp();
});

describe('verifyAppleIdToken', () => {
  const verify = (token: string, nonce = rawNonce) =>
    verifyAppleIdToken(token, { rawNonce: nonce, audiences: [APPLE_AUD], keys: idp.keys });

  it('accepts a valid token and returns the subject and email', async () => {
    const token = await idp.sign(
      { sub: 'apple-user-1', email: 'a@privaterelay.appleid.com', nonce: sha256Hex(rawNonce) },
      { iss: APPLE_ISS, aud: APPLE_AUD },
    );
    await expect(verify(token)).resolves.toEqual({
      subject: 'apple-user-1',
      email: 'a@privaterelay.appleid.com',
    });
  });

  it('rejects a replayed token with the wrong nonce', async () => {
    const token = await idp.sign(
      { sub: 'u', nonce: sha256Hex(rawNonce) },
      { iss: APPLE_ISS, aud: APPLE_AUD },
    );
    await expect(verify(token, 'another-nonce-entirely-xyz')).rejects.toMatchObject({
      status: 401,
      code: 'invalid_id_token',
    });
  });

  it('rejects a token for another app (aud)', async () => {
    const token = await idp.sign(
      { sub: 'u', nonce: sha256Hex(rawNonce) },
      { iss: APPLE_ISS, aud: 'com.other.app' },
    );
    await expect(verify(token)).rejects.toMatchObject({ status: 401 });
  });

  it('rejects a token from another issuer', async () => {
    const token = await idp.sign(
      { sub: 'u', nonce: sha256Hex(rawNonce) },
      { iss: 'https://evil.example', aud: APPLE_AUD },
    );
    await expect(verify(token)).rejects.toMatchObject({ status: 401 });
  });

  it('rejects an expired token', async () => {
    const token = await idp.sign(
      { sub: 'u', nonce: sha256Hex(rawNonce) },
      { iss: APPLE_ISS, aud: APPLE_AUD, expiresIn: '-1m' },
    );
    await expect(verify(token)).rejects.toMatchObject({ status: 401 });
  });

  it('rejects a token signed by an unknown key', async () => {
    const other = await fakeIdp();
    const token = await other.sign(
      { sub: 'u', nonce: sha256Hex(rawNonce) },
      { iss: APPLE_ISS, aud: APPLE_AUD },
    );
    await expect(verify(token)).rejects.toMatchObject({ status: 401 });
  });
});

describe('verifyGoogleIdToken', () => {
  const verify = (token: string) =>
    verifyGoogleIdToken(token, { audiences: [GOOGLE_AUD], keys: idp.keys });

  it('accepts both Google issuer spellings', async () => {
    for (const iss of ['https://accounts.google.com', 'accounts.google.com']) {
      const token = await idp.sign(
        { sub: 'g-1', email: 'g@example.com', email_verified: true },
        { iss, aud: GOOGLE_AUD },
      );
      await expect(verify(token)).resolves.toEqual({ subject: 'g-1', email: 'g@example.com' });
    }
  });

  it('drops an unverified email', async () => {
    const token = await idp.sign(
      { sub: 'g-2', email: 'g@example.com', email_verified: false },
      { iss: 'https://accounts.google.com', aud: GOOGLE_AUD },
    );
    await expect(verify(token)).resolves.toEqual({ subject: 'g-2', email: null });
  });

  it('rejects a token issued to another client id', async () => {
    const token = await idp.sign(
      { sub: 'g-3' },
      { iss: 'https://accounts.google.com', aud: 'someone-else' },
    );
    await expect(verify(token)).rejects.toMatchObject({ status: 401 });
  });
});
