import { getDb } from '@/db/client';

export const hasDb = Boolean(process.env.DATABASE_URL);

export function testDb() {
  const conn = getDb();
  if (!conn) throw new Error('DATABASE_URL is not set');
  return conn;
}

/**
 * Wipes every table between tests. `users` cascades to user data; push tickets and webhook
 * events aren't linked to a user, so they're listed too (a leftover ticket made the cron test
 * call Expo for receipts, depending on which test file ran before it).
 */
export async function resetDb() {
  await testDb().sql`truncate table users, push_tickets, webhook_events cascade`;
}
