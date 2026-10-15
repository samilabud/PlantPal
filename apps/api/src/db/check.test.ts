import { describe, expect, it } from 'vitest';

import { checkDatabase } from './check';

// Integration test: runs against a real Postgres when DATABASE_URL is set
// (docker compose locally, a service container in CI). Skipped otherwise.
describe.skipIf(!process.env.DATABASE_URL)('checkDatabase (integration)', () => {
  it('reaches the database', async () => {
    await expect(checkDatabase()).resolves.toBe('ok');
  });
});
