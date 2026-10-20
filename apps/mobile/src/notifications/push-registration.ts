import { Platform } from 'react-native';
import { create } from 'zustand';

import { registerDevice, unregisterDevice } from '@/api';
import { getDb } from '@/db/database';
import { currentLanguage } from '@/i18n';

import { getPermissionState, getPushToken } from './notifications';

type PushState = { status: 'unknown' | 'registered' | 'failed' | 'off'; error: string | null };
export const usePushStore = create<PushState>()(() => ({ status: 'unknown', error: null }));

async function stored(key: 'pushToken' | 'pushLanguage') {
  const row = await (
    await getDb()
  ).getFirstAsync<{ value: string }>('SELECT value FROM sync_state WHERE key = ?', [key]);
  return row?.value ?? null;
}
const storedToken = () => stored('pushToken');

async function remember(key: 'pushToken' | 'pushLanguage', value: string) {
  await (
    await getDb()
  ).runAsync(
    'INSERT INTO sync_state (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
    [key, value],
  );
}

/**
 * Tell the server where to push, and in which language. Safe to call often: it registers again
 * only when the token (new install, OS rotated it) or the app's language changed. Failures are
 * shown in Settings, never thrown.
 */
export async function registerForPush() {
  if ((await getPermissionState()) !== 'granted') {
    usePushStore.setState({ status: 'off', error: null });
    return;
  }
  try {
    const token = await getPushToken();
    const language = currentLanguage();
    if (token !== (await storedToken()) || language !== (await stored('pushLanguage'))) {
      await registerDevice(token, Platform.OS === 'ios' ? 'ios' : 'android', language);
      await remember('pushToken', token);
      await remember('pushLanguage', language);
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
