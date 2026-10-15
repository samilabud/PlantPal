import type { HealthResponse } from '@plantpal/shared';

import packageJson from '../../package.json';

export type DbState = HealthResponse['db'];

/** Pure function, so it can be unit-tested without a database or a server. */
export async function buildHealth(
  checkDb: () => Promise<DbState>,
  now: () => Date = () => new Date(),
): Promise<HealthResponse> {
  const db = await checkDb();
  return {
    status: db === 'down' ? 'degraded' : 'ok',
    db,
    version: packageJson.version,
    time: now().toISOString(),
  };
}
