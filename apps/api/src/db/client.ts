import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema';

export type Db = PostgresJsDatabase<typeof schema>;

let cached: { sql: postgres.Sql; db: Db } | null = null;

/**
 * One postgres.js driver for both local Postgres and Neon.
 * - `prepare: false` because Neon's pooled endpoint (PgBouncer, transaction mode) can't keep
 *   prepared statements between requests.
 * - A small `max` because every serverless instance opens its own pool.
 * Returns null when DATABASE_URL is missing, so the health check can say "not_configured".
 */
export function getDb(): { sql: postgres.Sql; db: Db } | null {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  const sql = postgres(url, { prepare: false, max: 5, idle_timeout: 20, connect_timeout: 5 });
  cached = { sql, db: drizzle({ client: sql, schema }) };
  return cached;
}
