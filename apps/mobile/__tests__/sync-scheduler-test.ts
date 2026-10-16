import NetInfo from '@react-native-community/netinfo';

import { useAuthStore } from '@/auth/auth-store';
import { getDb } from '@/db/database';
import { syncOnce } from '@/sync/engine';
import { requestSync, useSyncStore } from '@/sync/sync-manager';

import { testUser } from '../test/utils';

jest.mock('@/api', () => ({
  ApiError: class extends Error {},
  getMe: jest.fn(),
  postSync: jest.fn(),
  getPhotoUploadUrl: jest.fn(),
  putPhotoFile: jest.fn(),
}));
jest.mock('@/db/database', () => ({ getDb: jest.fn() }));
jest.mock('@/photos/capture', () => ({ localFileSize: jest.fn() }));
jest.mock('@/sync/engine', () => ({ syncOnce: jest.fn() }));
jest.mock('@/sync/photo-uploader', () => ({ uploadPendingPhotos: jest.fn(async () => 0) }));
jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(),
  addEventListener: jest.fn(),
}));

const fakeDb = { getFirstAsync: jest.fn(async () => ({ n: 0 })) };

describe('sync scheduler', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.mocked(getDb).mockResolvedValue(fakeDb as never);
    jest.mocked(NetInfo.fetch).mockResolvedValue({ isConnected: true } as never);
    jest
      .mocked(syncOnce)
      .mockReset()
      .mockResolvedValue({ pushed: 0, pulled: 0, rejected: 0, rounds: 1, overLimit: 0 });
    useAuthStore.getState().setSignedIn(testUser);
  });
  afterEach(() => jest.useRealTimers());

  const flush = async () => {
    await jest.advanceTimersByTimeAsync(2000);
    await jest.advanceTimersByTimeAsync(0);
  };

  it('debounces: three quick edits produce one sync', async () => {
    requestSync();
    requestSync();
    requestSync();
    await flush();
    expect(syncOnce).toHaveBeenCalledTimes(1);
  });

  it('single flight: a request during a sync runs once more afterwards, never in parallel', async () => {
    let finish!: () => void;
    jest
      .mocked(syncOnce)
      .mockImplementationOnce(
        () =>
          new Promise(
            (resolve) =>
              (finish = () =>
                resolve({ pushed: 0, pulled: 0, rejected: 0, rounds: 1, overLimit: 0 })),
          ),
      );
    requestSync({ immediate: true });
    await jest.advanceTimersByTimeAsync(0);
    await jest.advanceTimersByTimeAsync(0);
    requestSync({ immediate: true }); // arrives while the first sync is running
    await jest.advanceTimersByTimeAsync(0);
    expect(syncOnce).toHaveBeenCalledTimes(1);

    finish();
    await flush();
    expect(syncOnce).toHaveBeenCalledTimes(2);
  });

  it('offline: no request, status says offline', async () => {
    jest.mocked(NetInfo.fetch).mockResolvedValue({ isConnected: false } as never);
    requestSync({ immediate: true });
    await flush();
    expect(syncOnce).not.toHaveBeenCalled();
    expect(useSyncStore.getState().status).toBe('offline');
  });
});
