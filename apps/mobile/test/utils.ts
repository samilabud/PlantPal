/** In-memory stand-in for the Keychain/Keystore. */
export function mockSecureStore() {
  const store = new Map<string, string>();
  return {
    AFTER_FIRST_UNLOCK: 'AFTER_FIRST_UNLOCK',
    getItemAsync: jest.fn(async (k: string) => store.get(k) ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => void store.set(k, v)),
    deleteItemAsync: jest.fn(async (k: string) => void store.delete(k)),
    __store: store,
  };
}

export const testUser = {
  id: '6f1c1d36-58a1-4a7e-9c2a-1f9f0b1f6b7e',
  email: 'dev@dev.plantpal.test',
  plan: 'free' as const,
  providers: ['dev' as const],
};
