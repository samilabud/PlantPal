import {
  SYNC_MAX_CHANGES,
  type PlantPhotoRecord,
  type PlantRecord,
  type SyncChange,
  type SyncRequest,
  type SyncResponse,
  type WateringEventRecord,
} from '@plantpal/shared';

import { readOutbox } from '@/data/outbox';
import type { SqlDb } from '@/db/types';

export type SyncTransport = (request: SyncRequest) => Promise<SyncResponse>;

export type SyncResult = { pushed: number; pulled: number; rejected: number; rounds: number };

const MAX_ROUNDS = 20;

async function getCursor(db: SqlDb) {
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM sync_state WHERE key = 'cursor'",
    [],
  );
  return row ? Number(row.value) : 0;
}

/**
 * One full sync: repeat push+pull rounds until the outbox is empty and the server has nothing
 * more for us. Each round is applied in ONE local transaction, so a crash mid-sync can't leave
 * the outbox and the data out of step: the next sync just repeats the round (the server
 * treats repeats as no-ops).
 */
export async function syncOnce(db: SqlDb, send: SyncTransport): Promise<SyncResult> {
  const result: SyncResult = { pushed: 0, pulled: 0, rejected: 0, rounds: 0 };

  while (result.rounds < MAX_ROUNDS) {
    result.rounds++;
    const outbox = await readOutbox(db, SYNC_MAX_CHANGES);
    const cursor = await getCursor(db);
    const changes = outbox.map((row) => JSON.parse(row.payload) as SyncChange);

    const response = await send({ cursor, changes });

    await db.withExclusiveTransactionAsync(async (tx) => {
      // Remove exactly the outbox rows we sent. If the user edited a row while the request
      // was in flight, that edit has a NEW seq, survives here and goes in the next round.
      for (const row of outbox) await tx.runAsync('DELETE FROM outbox WHERE seq = ?', [row.seq]);

      for (const p of response.plants) await applyPlant(tx, p);
      for (const e of response.wateringEvents) await applyEvent(tx, e);
      for (const ph of response.plantPhotos) await applyPhoto(tx, ph);

      await tx.runAsync(
        "INSERT INTO sync_state (key, value) VALUES ('cursor', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
        [String(response.cursor)],
      );
    });

    result.pushed += outbox.length - response.rejected.length;
    result.rejected += response.rejected.length;
    result.pulled +=
      response.plants.length + response.wateringEvents.length + response.plantPhotos.length;

    const outboxFull = outbox.length === SYNC_MAX_CHANGES;
    if (!response.hasMore && !outboxFull) {
      // Edits made during this round are still waiting; one more round sends them.
      const left = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM outbox', []);
      if (!left?.n) break;
    }
  }
  return result;
}

/** A row with a pending local change keeps the local version: it is newer and will be pushed. */
async function hasPending(tx: SqlDb, entity: string, id: string) {
  const row = await tx.getFirstAsync<{ seq: number }>(
    'SELECT seq FROM outbox WHERE entity = ? AND entity_id = ?',
    [entity, id],
  );
  return row !== null;
}

async function applyPlant(tx: SqlDb, p: PlantRecord) {
  if (await hasPending(tx, 'plant', p.id)) return;
  await tx.runAsync(
    `INSERT INTO plants (id, name, watering_interval_days, cover_photo_id, client_updated_at, server_version, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET name = excluded.name, watering_interval_days = excluded.watering_interval_days,
       cover_photo_id = excluded.cover_photo_id, client_updated_at = excluded.client_updated_at,
       server_version = excluded.server_version, deleted_at = excluded.deleted_at`,
    [
      p.id,
      p.name,
      p.wateringIntervalDays,
      p.coverPhotoId,
      p.clientUpdatedAt,
      p.serverVersion,
      p.deletedAt,
    ],
  );
}

async function applyEvent(tx: SqlDb, e: WateringEventRecord) {
  if (await hasPending(tx, 'wateringEvent', e.id)) return;
  await tx.runAsync(
    `INSERT INTO watering_events (id, plant_id, watered_at, client_updated_at, server_version, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET watered_at = excluded.watered_at, client_updated_at = excluded.client_updated_at,
       server_version = excluded.server_version, deleted_at = excluded.deleted_at`,
    [e.id, e.plantId, e.wateredAt, e.clientUpdatedAt, e.serverVersion, e.deletedAt],
  );
}

async function applyPhoto(tx: SqlDb, ph: PlantPhotoRecord) {
  if (await hasPending(tx, 'plantPhoto', ph.id)) return;
  // Keep this device's local file (local_uri) if it has one; the server doesn't know about it.
  await tx.runAsync(
    `INSERT INTO plant_photos (id, plant_id, taken_at, upload_state, client_updated_at, server_version, deleted_at)
     VALUES (?, ?, ?, 'done', ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET taken_at = excluded.taken_at, upload_state = 'done',
       client_updated_at = excluded.client_updated_at, server_version = excluded.server_version,
       deleted_at = excluded.deleted_at`,
    [ph.id, ph.plantId, ph.takenAt, ph.clientUpdatedAt, ph.serverVersion, ph.deletedAt],
  );
}
