import { getDb } from '@/db/database';
import type { SqlDb } from '@/db/types';
import { afterLocalWrite } from '@/sync/sync-manager';

/** Run a local write, then refresh screens and schedule a sync. Works the same offline. */
export async function mutate<T>(write: (db: SqlDb) => Promise<T>): Promise<T> {
  const result = await write(await getDb());
  await afterLocalWrite();
  return result;
}
