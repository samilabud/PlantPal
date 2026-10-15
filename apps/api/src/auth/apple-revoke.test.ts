import { decodeJwt, decodeProtectedHeader, exportPKCS8, generateKeyPair } from 'jose';
import { describe, expect, it, vi } from 'vitest';

import { revokeAppleGrant } from './apple-revoke';

async function appleKeyConfig() {
  const { privateKey } = await generateKeyPair('ES256', { extractable: true });
  return { teamId: 'TEAM123456', keyId: 'KEY1234567', privateKey: await exportPKCS8(privateKey) };
}

const ok = (body: unknown = {}) => new Response(JSON.stringify(body), { status: 200 });

describe('revokeAppleGrant', () => {
  it('exchanges the code, then revokes the refresh token with a valid client secret', async () => {
    const cfg = await appleKeyConfig();
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(ok({ refresh_token: 'apple-refresh', access_token: 'apple-access' }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    const result = await revokeAppleGrant('auth-code', {
      cfg,
      clientId: 'com.samilabud.plantpal.dev',
      fetchFn,
    });
    expect(result).toBe(true);

    const [tokenUrl, tokenInit] = fetchFn.mock.calls[0]!;
    expect(tokenUrl).toBe('https://appleid.apple.com/auth/token');
    const tokenForm = new URLSearchParams(tokenInit.body);
    expect(tokenForm.get('grant_type')).toBe('authorization_code');
    expect(tokenForm.get('code')).toBe('auth-code');

    const secret = tokenForm.get('client_secret')!;
    expect(decodeProtectedHeader(secret)).toMatchObject({ alg: 'ES256', kid: 'KEY1234567' });
    expect(decodeJwt(secret)).toMatchObject({
      iss: 'TEAM123456',
      sub: 'com.samilabud.plantpal.dev',
      aud: 'https://appleid.apple.com',
    });

    const [revokeUrl, revokeInit] = fetchFn.mock.calls[1]!;
    expect(revokeUrl).toBe('https://appleid.apple.com/auth/revoke');
    const revokeForm = new URLSearchParams(revokeInit.body);
    expect(revokeForm.get('token')).toBe('apple-refresh');
    expect(revokeForm.get('token_type_hint')).toBe('refresh_token');
  });

  it('returns false (and does not throw) when Apple rejects the code', async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce(new Response('{}', { status: 400 }));
    const result = await revokeAppleGrant('bad', {
      cfg: await appleKeyConfig(),
      clientId: 'x',
      fetchFn,
    });
    expect(result).toBe(false);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
