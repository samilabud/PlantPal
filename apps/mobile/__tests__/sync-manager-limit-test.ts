import { getMe } from '@/api';
import { useAuthStore } from '@/auth/auth-store';
import { recordLimitRefusals, useSyncStore } from '@/sync/sync-manager';

import { testUser } from '../test/utils';

jest.mock('@/api', () => ({ getMe: jest.fn(), ApiError: class extends Error {} }));
jest.mock('@/db/database', () => ({ getDb: jest.fn() }));
jest.mock('@/photos/capture', () => ({ localFileSize: jest.fn() }));
jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(),
  addEventListener: jest.fn(),
}));

describe('recordLimitRefusals', () => {
  it('counts refusals for the notice and refreshes the cached profile', async () => {
    jest.mocked(getMe).mockResolvedValue({ ...testUser, plan: 'free' });
    useAuthStore.getState().setSignedIn({ ...testUser, plan: 'premium' });

    recordLimitRefusals(1);
    recordLimitRefusals(2);

    expect(useSyncStore.getState().refusedByLimit).toBe(3);
    await new Promise((r) => setTimeout(r, 0));
    expect(getMe).toHaveBeenCalled();
    expect(useAuthStore.getState().user?.plan).toBe('free');
  });
});
