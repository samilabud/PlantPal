// The language preference lives in expo-sqlite's key-value store; tests get an in-memory one.
jest.mock('expo-sqlite/kv-store', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItemSync: (key: string) => store.get(key) ?? null,
      setItemSync: (key: string, value: string) => void store.set(key, value),
    },
  };
});

// Tests read English unless they switch on purpose (and switch back).
require('@/i18n').default.changeLanguage('en');
