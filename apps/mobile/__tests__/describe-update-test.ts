import { describeUpdate } from '@/updates/describe-update';

const mockUpdates = {
  channel: 'staging' as string | null,
  isEmbeddedLaunch: true,
  updateId: null as string | null,
  createdAt: null as Date | null,
};
// Getters: jest.mock is hoisted above mockUpdates, so read it lazily at call time.
jest.mock('expo-updates', () => ({
  get channel() {
    return mockUpdates.channel;
  },
  get isEmbeddedLaunch() {
    return mockUpdates.isEmbeddedLaunch;
  },
  get updateId() {
    return mockUpdates.updateId;
  },
  get createdAt() {
    return mockUpdates.createdAt;
  },
}));
jest.mock('expo-constants', () => ({ expoConfig: { version: '0.1.0' } }));

const g = globalThis as unknown as { __DEV__: boolean };

describe('describeUpdate (version line on sign-in and in Settings)', () => {
  afterEach(() => {
    g.__DEV__ = true;
  });

  it('development: says the code comes from Metro', () => {
    expect(describeUpdate()).toBe('v0.1.0 · development (code from Metro)');
  });

  it('release build running its own bundle', () => {
    g.__DEV__ = false;
    expect(describeUpdate()).toBe('v0.1.0 · staging · built-in bundle');
  });

  it('release build running an EAS Update: shows the short update id', () => {
    g.__DEV__ = false;
    Object.assign(mockUpdates, {
      isEmbeddedLaunch: false,
      updateId: '1a2b3c4d-0000-4000-8000-000000000000',
      createdAt: null,
    });
    expect(describeUpdate()).toBe('v0.1.0 · staging · update 1a2b3c4d');
  });
});
