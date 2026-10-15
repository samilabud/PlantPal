import type { DbState } from '@/lib/health';

import { getDb } from './client';

export async function checkDatabase(): Promise<DbState> {
  const conn = getDb();
  if (!conn) return 'not_configured';
  try {
    await conn.sql`select 1`;
    return 'ok';
  } catch {
    return 'down';
  }
}
