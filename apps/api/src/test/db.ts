import { getDb } from '@/db/client';

export const hasDb = Boolean(process.env.DATABASE_URL);

export function testDb() {
  const conn = getDb();
  if (!conn) throw new Error('DATABASE_URL is not set');
  return conn;
}

/** Wipes every table between tests. `users` cascades to the rest. */
export async function resetDb() {
  await testDb().sql`truncate table users cascade`;
}
