import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';
import { create } from 'zustand';

import { toUserMessage } from '@/errors/user-message';
import { ApiError, getMe, getPhotoUploadUrl, postSync, putPhotoFile } from '@/api';
import { useAuthStore } from '@/auth/auth-store';
import { notifyDataChanged } from '@/data/live';
import { pendingCount } from '@/data/outbox';
import { getDb } from '@/db/database';
import { localFileSize } from '@/photos/capture';

import { syncOnce } from './engine';
import { uploadPendingPhotos } from './photo-uploader';

type SyncState = {
  status: 'idle' | 'syncing' | 'offline' | 'error';
  lastSyncedAt: string | null;
  pending: number;
  error: string | null;
  /** How many new items the server refused because of the free plan (0 = nothing to show). */
  refusedByLimit: number;
};

export const useSyncStore = create<SyncState>()(() => ({
  status: 'idle',
  lastSyncedAt: null,
  pending: 0,
  error: null,
  refusedByLimit: 0,
}));

const DEBOUNCE_MS = 1500;
let timer: ReturnType<typeof setTimeout> | null = null;
let running: Promise<void> | null = null;
let runAgain = false;

/**
 * Ask for a sync. Calls are debounced (typing three edits = one sync) and single-flight
 * (a request during a sync runs one more time afterwards, never in parallel).
 */
export function requestSync(options: { immediate?: boolean } = {}) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(
    () => {
      timer = null;
      if (running) {
        runAgain = true;
        return;
      }
      running = run().finally(() => {
        running = null;
        if (runAgain) {
          runAgain = false;
          requestSync({ immediate: true });
        }
      });
    },
    options.immediate ? 0 : DEBOUNCE_MS,
  );
}

/** For pull-to-refresh: resolves when the sync is done. */
export async function syncNow() {
  requestSync({ immediate: true });
  await new Promise((r) => setTimeout(r, 10));
  await running;
}

async function run() {
  if (useAuthStore.getState().status !== 'signedIn') return;
  const db = await getDb();
  const set = useSyncStore.setState;

  const net = await NetInfo.fetch();
  if (net.isConnected === false) {
    set({ status: 'offline', pending: await pendingCount(db) });
    return;
  }

  set({ status: 'syncing', error: null });
  try {
    await uploadPendingPhotos(db, {
      fileSize: localFileSize,
      getUploadUrl: getPhotoUploadUrl,
      putFile: putPhotoFile,
    });
    const result = await syncOnce(db, postSync);
    set({ status: 'idle', lastSyncedAt: new Date().toISOString() });
    if (result.overLimit) recordLimitRefusals(result.overLimit);
  } catch (error) {
    const offline =
      error instanceof ApiError && (error.kind === 'network' || error.kind === 'timeout');
    set({
      status: offline ? 'offline' : 'error',
      error: offline ? null : toUserMessage(error, 'sync'),
    });
  } finally {
    set({ pending: await pendingCount(db) });
    notifyDataChanged();
  }
}

/** Every local write calls this: refresh the screens now, sync a moment later. */
export async function afterLocalWrite() {
  notifyDataChanged();
  useSyncStore.setState({ pending: await pendingCount(await getDb()) });
  requestSync();
}

/** When to sync: now, when the network comes back, and when the app returns to the foreground. */
export function startSyncTriggers() {
  let wasOffline = false;
  const unsubscribeNet = NetInfo.addEventListener((state) => {
    const offline = state.isConnected === false;
    if (offline) useSyncStore.setState({ status: 'offline' });
    if (wasOffline && !offline) requestSync({ immediate: true });
    wasOffline = offline;
  });
  const appState = AppState.addEventListener('change', (next) => {
    if (next === 'active') requestSync({ immediate: true });
  });
  requestSync({ immediate: true });

  return () => {
    unsubscribeNet();
    appState.remove();
    if (timer) clearTimeout(timer);
  };
}

export const dismissLimitNotice = () => useSyncStore.setState({ refusedByLimit: 0 });

/**
 * The server refused new items because of the free plan. Count them for the notice, and
 * refresh the profile: the refusal means our cached plan is out of date.
 */
export function recordLimitRefusals(count: number) {
  useSyncStore.setState((s) => ({ refusedByLimit: s.refusedByLimit + count }));
  getMe()
    .then((me) => useAuthStore.getState().setUser(me))
    .catch(() => undefined);
}
