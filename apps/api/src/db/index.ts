import { HttpError } from '@/lib/errors';

import { getDb, type Db } from './client';

export type { Db };

/** For routes that can't work without a database. */
export function db(): Db {
  const conn = getDb();
  if (!conn) throw new HttpError(503, 'db_not_configured', 'Database is not configured');
  return conn.db;
}
