import type { Me } from '@plantpal/shared';
import * as SecureStore from 'expo-secure-store';

/**
 * The refresh token lives in the Keychain (iOS) / Keystore-encrypted storage (Android).
 * The access token is never written to disk: it lives in memory and is re-created by a refresh.
 * AFTER_FIRST_UNLOCK lets background tasks (sync, M3) read it while the phone is locked.
 */
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};
const REFRESH_KEY = 'plantpal.refreshToken';
const USER_KEY = 'plantpal.user';

export const tokenStore = {
  getRefreshToken: () => SecureStore.getItemAsync(REFRESH_KEY, OPTIONS),
  setRefreshToken: (token: string) => SecureStore.setItemAsync(REFRESH_KEY, token, OPTIONS),

  /** The cached profile lets the app open signed-in while offline. */
  async getUser(): Promise<Me | null> {
    const raw = await SecureStore.getItemAsync(USER_KEY, OPTIONS);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Me;
    } catch {
      return null;
    }
  },
  setUser: (user: Me) => SecureStore.setItemAsync(USER_KEY, JSON.stringify(user), OPTIONS),

  async clear() {
    await Promise.all([
      SecureStore.deleteItemAsync(REFRESH_KEY, OPTIONS),
      SecureStore.deleteItemAsync(USER_KEY, OPTIONS),
    ]);
  },
};
