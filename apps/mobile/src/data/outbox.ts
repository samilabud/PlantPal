import type { SyncChange } from '@plantpal/shared';

import type { SqlDb } from '@/db/types';

type Entity = 'plant' | 'wateringEvent' | 'plantPhoto';

/**
 * Queue a change for the server, replacing any older pending change for the same row
 * (only the latest state matters). DELETE + INSERT gives the row a new seq on purpose.
 * Must be called with the same `tx` as the local write, so both happen or neither does.
 */
export async function enqueue(tx: SqlDb, change: SyncChange, now: string) {
  const entity = change.kind.split('.')[0] as Entity;
  await tx.runAsync('DELETE FROM outbox WHERE entity = ? AND entity_id = ?', [entity, change.id]);
  await tx.runAsync(
    'INSERT INTO outbox (entity, entity_id, kind, payload, created_at) VALUES (?, ?, ?, ?, ?)',
    [entity, change.id, change.kind, JSON.stringify(change), now],
  );
}

export type OutboxRow = { seq: number; entity: Entity; entity_id: string; payload: string };

/**
 * Oldest first, but plants before their children: a brand-new plant must reach the server
 * before a watering or photo that points to it, even if the plant was edited again later.
 */
export function readOutbox(db: SqlDb, limit: number) {
  return db.getAllAsync<OutboxRow>(
    `SELECT seq, entity, entity_id, payload FROM outbox
     ORDER BY CASE entity WHEN 'plant' THEN 0 ELSE 1 END, seq LIMIT ?`,
    [limit],
  );
}

export async function pendingCount(db: SqlDb) {
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM outbox', []);
  return row?.n ?? 0;
}
