import { Platform } from 'react-native';
import { create } from 'zustand';

import { registerDevice, unregisterDevice } from '@/api';
import { getDb } from '@/db/database';

import { getPermissionState, getPushToken } from './notifications';

type PushState = { status: 'unknown' | 'registered' | 'failed' | 'off'; error: string | null };
export const usePushStore = create<PushState>()(() => ({ status: 'unknown', error: null }));

async function storedToken() {
  const row = await (
    await getDb()
  ).getFirstAsync<{ value: string }>("SELECT value FROM sync_state WHERE key = 'pushToken'", []);
  return row?.value ?? null;
}

/**
 * Tell the server where to push. Safe to call often: it registers again only when the token
 * changed (new install, OS rotated it). Failures are shown in Settings, never thrown.
 */
export async function registerForPush() {
  if ((await getPermissionState()) !== 'granted') {
    usePushStore.setState({ status: 'off', error: null });
    return;
  }
  try {
    const token = await getPushToken();
    if (token !== (await storedToken())) {
      await registerDevice(token, Platform.OS === 'ios' ? 'ios' : 'android');
      await (
        await getDb()
      ).runAsync(
        "INSERT INTO sync_state (key, value) VALUES ('pushToken', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
        [token],
      );
    }
    usePushStore.setState({ status: 'registered', error: null });
  } catch (e) {
    usePushStore.setState({ status: 'failed', error: e instanceof Error ? e.message : String(e) });
  }
}

/** On sign-out: stop pushing to this phone for this account (best effort). */
export async function unregisterFromPush() {
  const token = await storedToken().catch(() => null);
  if (token) await unregisterDevice(token).catch(() => undefined);
  usePushStore.setState({ status: 'off', error: null });
}
