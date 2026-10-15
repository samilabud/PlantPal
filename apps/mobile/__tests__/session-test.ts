import { ApiError } from '@/api/client';
import { publicApi } from '@/api/http';
import { useAuthStore } from '@/auth/auth-store';
import { getAccessToken, refreshAccessToken, restoreSession } from '@/auth/session';
import { tokenStore } from '@/auth/token-store';

import { testUser } from '../test/utils';

jest.mock('expo-secure-store', () => require('../test/utils').mockSecureStore());
jest.mock('@/api/http', () => ({ publicApi: { request: jest.fn() } }));

const request = jest.mocked(publicApi.request);

function tokens(n: number, expiresInMs = 15 * 60_000) {
  return {
    tokens: {
      accessToken: `access-${n}`,
      refreshToken: `refresh-${n}`,
      accessTokenExpiresAt: new Date(Date.now() + expiresInMs).toISOString(),
    },
  };
}

async function signedIn() {
  await tokenStore.setRefreshToken('refresh-0');
  await tokenStore.setUser(testUser);
  await restoreSession();
}

describe('session', () => {
  beforeEach(async () => {
    request.mockReset();
    await tokenStore.clear();
    useAuthStore.getState().setSignedOut();
  });

  it('restores a stored session offline, without a network call', async () => {
    await signedIn();
    expect(useAuthStore.getState()).toMatchObject({ status: 'signedIn', user: testUser });
    expect(request).not.toHaveBeenCalled();
  });

  it('is signed out when nothing is stored', async () => {
    await restoreSession();
    expect(useAuthStore.getState().status).toBe('signedOut');
  });

  it('shares one refresh call between parallel callers (single flight)', async () => {
    await signedIn();
    request.mockImplementation(async () => tokens(1));

    const results = await Promise.all([
      refreshAccessToken(),
      refreshAccessToken(),
      refreshAccessToken(),
    ]);
    expect(results).toEqual(['access-1', 'access-1', 'access-1']);
    expect(request).toHaveBeenCalledTimes(1);
    expect(await tokenStore.getRefreshToken()).toBe('refresh-1');
  });

  it('signs out when the server rejects the refresh token', async () => {
    await signedIn();
    request.mockRejectedValue(new ApiError('http', 'reused', 401, 'unauthorized'));

    await expect(refreshAccessToken()).resolves.toBeNull();
    expect(useAuthStore.getState().status).toBe('signedOut');
    expect(await tokenStore.getRefreshToken()).toBeNull();
  });

  it('stays signed in when the refresh fails because the phone is offline', async () => {
    await signedIn();
    request.mockRejectedValue(new ApiError('network', 'Network request failed'));

    await expect(refreshAccessToken()).resolves.toBeNull();
    expect(useAuthStore.getState().status).toBe('signedIn');
    expect(await tokenStore.getRefreshToken()).toBe('refresh-0');
  });

  it('reuses a fresh access token and refreshes one that is about to expire', async () => {
    await signedIn();
    request.mockResolvedValueOnce(tokens(1, 30_000)); // expires in 30 s: inside the margin
    expect(await getAccessToken()).toBe('access-1');

    request.mockResolvedValueOnce(tokens(2));
    expect(await getAccessToken()).toBe('access-2'); // the 30 s token was refreshed
    expect(await getAccessToken()).toBe('access-2'); // now fresh: no new call
    expect(request).toHaveBeenCalledTimes(2);
  });
});
