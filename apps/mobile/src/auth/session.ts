import {
  DeleteAccountResponse,
  Me,
  OkResponse,
  RefreshResponse,
  SessionResponse,
  type AuthTokens,
} from '@plantpal/shared';

import { ApiError } from '@/api/client';
import { publicApi } from '@/api/http';

import { useAuthStore } from './auth-store';
import { tokenStore } from './token-store';

/** Refresh this long before expiry, so a request never leaves with an almost-dead token. */
const EXPIRY_MARGIN_MS = 60_000;

async function saveSession(tokens: AuthTokens, user: Me) {
  await Promise.all([tokenStore.setRefreshToken(tokens.refreshToken), tokenStore.setUser(user)]);
  useAuthStore
    .getState()
    .setSignedIn(user, { token: tokens.accessToken, expiresAt: tokens.accessTokenExpiresAt });
}

/** Signs out on this device only. Safe to call many times. */
export async function clearLocalSession() {
  await tokenStore.clear();
  useAuthStore.getState().setSignedOut();
}

let inflight: Promise<string | null> | null = null;

/**
 * Single-flight refresh: if five requests get a 401 at once, they share ONE refresh call.
 * Without this, the second call would send an already-rotated token, the server would see
 * "reuse", and revoke the session.
 * - 401 from the server: the session is over, so sign out.
 * - Network error: keep the session (offline-first) and let the request fail.
 */
export function refreshAccessToken(): Promise<string | null> {
  inflight ??= (async () => {
    try {
      const refreshToken = await tokenStore.getRefreshToken();
      if (!refreshToken) {
        await clearLocalSession();
        return null;
      }
      const { tokens } = await publicApi.request('/api/auth/refresh', {
        method: 'POST',
        body: { refreshToken },
        schema: RefreshResponse,
      });
      await tokenStore.setRefreshToken(tokens.refreshToken);
      useAuthStore
        .getState()
        .setAccess({ token: tokens.accessToken, expiresAt: tokens.accessTokenExpiresAt });
      return tokens.accessToken;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) await clearLocalSession();
      return null;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export async function getAccessToken(): Promise<string | null> {
  const { status, accessToken, accessTokenExpiresAt } = useAuthStore.getState();
  if (status !== 'signedIn') return null;
  if (accessToken && accessTokenExpiresAt && accessTokenExpiresAt - Date.now() > EXPIRY_MARGIN_MS) {
    return accessToken;
  }
  return refreshAccessToken();
}

/**
 * App start: a stored refresh token + cached profile means "signed in", even offline.
 * The access token is fetched lazily on the first API call.
 */
export async function restoreSession() {
  const [refreshToken, user] = await Promise.all([
    tokenStore.getRefreshToken(),
    tokenStore.getUser(),
  ]);
  if (refreshToken && user) useAuthStore.getState().setSignedIn(user);
  else await clearLocalSession();
}

export async function signInWithServer(
  path: '/api/auth/apple' | '/api/auth/google' | '/api/auth/dev',
  body: unknown,
) {
  const session = await publicApi.request(path, { method: 'POST', body, schema: SessionResponse });
  await saveSession(session.tokens, session.user);
  return session.user;
}

/** Server-side revoke is best effort: the device forgets the session either way. */
export async function signOutOfServer() {
  const refreshToken = await tokenStore.getRefreshToken();
  if (refreshToken) {
    await publicApi
      .request('/api/auth/logout', { method: 'POST', body: { refreshToken }, schema: OkResponse })
      .catch(() => undefined);
  }
  await clearLocalSession();
}

export async function deleteAccountOnServer(
  request: (body: unknown) => Promise<DeleteAccountResponse>,
  body: { appleAuthorizationCode?: string; appleClientId?: string },
) {
  const result = await request(body);
  await clearLocalSession();
  return result;
}
