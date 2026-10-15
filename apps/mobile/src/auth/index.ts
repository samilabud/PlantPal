import { DeleteAccountResponse } from '@plantpal/shared';
import Constants from 'expo-constants';

import { api } from '@/api';
import { env } from '@/config/env';

import { useAuthStore } from './auth-store';
import { appleCredential } from './providers/apple';
import { googleIdToken, googleSignOut } from './providers/google';
import { cancelAllReminders } from '@/notifications/notifications';
import { unregisterFromPush } from '@/notifications/push-registration';

import { deleteAccountOnServer, signInWithServer, signOutOfServer } from './session';

export { useAuthStore } from './auth-store';
export { isAppleSignInAvailable } from './providers/apple';
export { isGoogleSignInConfigured } from './providers/google';
export { restoreSession } from './session';

/** Dev sign-in exists only in development builds; the server also refuses it in production. */
export const isDevSignInEnabled = __DEV__ || env.appVariant === 'development';

/** Each action returns false when the user cancelled, true on success, and throws on failure. */
export async function signInWithApple(): Promise<boolean> {
  const credential = await appleCredential();
  if (!credential) return false;
  await signInWithServer('/api/auth/apple', {
    identityToken: credential.identityToken,
    rawNonce: credential.rawNonce,
    email: credential.email,
  });
  return true;
}

export async function signInWithGoogle(): Promise<boolean> {
  const idToken = await googleIdToken();
  if (!idToken) return false;
  await signInWithServer('/api/auth/google', { idToken });
  return true;
}

export async function signInDev(name = 'dev'): Promise<boolean> {
  if (!isDevSignInEnabled) return false;
  await signInWithServer('/api/auth/dev', { name });
  return true;
}

export async function signOut() {
  await googleSignOut({ revoke: false });
  // While the access token still works: stop server pushes to this phone for this account.
  await unregisterFromPush();
  await cancelAllReminders().catch(() => undefined);
  await signOutOfServer();
}

/**
 * Permanent deletion. Apple users confirm with Apple once more: that gives a fresh
 * authorization code, which the server needs to revoke the Apple grant.
 * Returns false if the user cancels that confirmation.
 */
export async function deleteAccount(): Promise<boolean> {
  const providers = useAuthStore.getState().user?.providers ?? [];
  const body: { appleAuthorizationCode?: string; appleClientId?: string } = {};

  if (providers.includes('apple')) {
    const credential = await appleCredential();
    if (!credential) return false;
    body.appleAuthorizationCode = credential.authorizationCode ?? undefined;
    body.appleClientId = Constants.expoConfig?.ios?.bundleIdentifier;
  }

  await deleteAccountOnServer(
    (b) => api.request('/api/me', { method: 'DELETE', body: b, schema: DeleteAccountResponse }),
    body,
  );
  if (providers.includes('google')) await googleSignOut({ revoke: true });
  await cancelAllReminders().catch(() => undefined); // devices rows were deleted with the account
  return true;
}
