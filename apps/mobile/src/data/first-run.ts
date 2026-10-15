import type { SqlDb } from '@/db/types';

/**
 * "Show once" flags, stored per signed-in user in sync_state (wiped on sign-out, so a new
 * account on the same phone sees the guide too). Checking and marking are separate on purpose:
 * a screen is marked as seen only once it has actually been shown, so a navigation that fails
 * silently can't use up the flag.
 */
export async function hasSeen(db: SqlDb, key: string): Promise<boolean> {
  return (await db.getFirstAsync('SELECT value FROM sync_state WHERE key = ?', [key])) !== null;
}

export async function markSeen(db: SqlDb, key: string) {
  await db.runAsync('INSERT OR REPLACE INTO sync_state (key, value) VALUES (?, ?)', [key, '1']);
}
