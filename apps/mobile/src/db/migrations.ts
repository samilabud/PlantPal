import type { SqlDb } from './types';

/**
 * Schema versions, tracked with SQLite's built-in `PRAGMA user_version` (the pattern from the
 * expo-sqlite docs). Each step runs once, in order. Never edit a shipped step: add a new one.
 */
const MIGRATIONS: string[] = [
  // 1: plants, waterings, photos, outbox, sync state
  `
  CREATE TABLE plants (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    watering_interval_days INTEGER NOT NULL,
    cover_photo_id TEXT,
    client_updated_at TEXT NOT NULL,
    server_version INTEGER,
    deleted_at TEXT
  );
  CREATE TABLE watering_events (
    id TEXT PRIMARY KEY NOT NULL,
    plant_id TEXT NOT NULL,
    watered_at TEXT NOT NULL,
    client_updated_at TEXT NOT NULL,
    server_version INTEGER,
    deleted_at TEXT
  );
  CREATE INDEX watering_events_plant ON watering_events (plant_id, watered_at);
  CREATE TABLE plant_photos (
    id TEXT PRIMARY KEY NOT NULL,
    plant_id TEXT NOT NULL,
    taken_at TEXT NOT NULL,
    -- file on this device, if any (photos from other devices are fetched with a signed URL)
    local_uri TEXT,
    -- 'pending' = waiting for upload; 'done' = the file is in Blob storage
    upload_state TEXT NOT NULL DEFAULT 'done',
    client_updated_at TEXT NOT NULL,
    server_version INTEGER,
    deleted_at TEXT
  );
  CREATE INDEX plant_photos_plant ON plant_photos (plant_id, taken_at);
  -- One pending change per row. A newer edit replaces the older one and gets a new seq,
  -- which is how the sync engine knows if a row changed while a request was in flight.
  CREATE TABLE outbox (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    entity TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (entity, entity_id)
  );
  CREATE TABLE sync_state (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
  `,
];

export const SCHEMA_VERSION = MIGRATIONS.length;

export async function migrate(db: SqlDb) {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
  let version = row?.user_version ?? 0;
  while (version < MIGRATIONS.length) {
    const step = MIGRATIONS[version]!;
    const next = version + 1;
    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.execAsync(step);
      await tx.execAsync(`PRAGMA user_version = ${next}`);
    });
    version = next;
  }
}

/** Sign-out / account deletion: forget everything that belonged to the previous user. */
export async function wipeAllRows(db: SqlDb) {
  await db.withExclusiveTransactionAsync(async (tx) => {
    for (const table of ['plants', 'watering_events', 'plant_photos', 'outbox', 'sync_state']) {
      await tx.execAsync(`DELETE FROM ${table}`);
    }
  });
}
