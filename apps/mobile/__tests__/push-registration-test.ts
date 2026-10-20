import { registerDevice } from '@/api';
import { migrate } from '@/db/migrations';
import { setLanguagePreference } from '@/i18n';
import { registerForPush } from '@/notifications/push-registration';

import { openTestDb } from '../test/sqlite-node';

jest.mock('@/api', () => ({ registerDevice: jest.fn(async () => ({ ok: true })) }));
jest.mock('@/notifications/notifications', () => ({
  getPermissionState: jest.fn(async () => 'granted'),
  getPushToken: jest.fn(async () => 'ExponentPushToken[abc]'),
}));
let mockDb: unknown;
jest.mock('@/db/database', () => ({ getDb: jest.fn(async () => mockDb) }));

describe('registerForPush', () => {
  beforeEach(async () => {
    const db = openTestDb();
    await migrate(db);
    mockDb = db;
    jest.clearAllMocks();
  });
  afterEach(() => setLanguagePreference('en'));

  it('registers once, then again only when the language changes', async () => {
    await registerForPush();
    await registerForPush();
    expect(registerDevice).toHaveBeenCalledTimes(1);
    expect(registerDevice).toHaveBeenLastCalledWith(
      'ExponentPushToken[abc]',
      expect.any(String),
      'en',
    );

    setLanguagePreference('es');
    await registerForPush();
    expect(registerDevice).toHaveBeenCalledTimes(2);
    expect(registerDevice).toHaveBeenLastCalledWith(
      'ExponentPushToken[abc]',
      expect.any(String),
      'es',
    );
  });
});
