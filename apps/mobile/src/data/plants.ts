import type { PlantData } from '@plantpal/shared';

import type { SqlDb } from '@/db/types';

import { newId } from './ids';
import { enqueue } from './outbox';

export type PlantListItem = {
  id: string;
  name: string;
  wateringIntervalDays: number;
  coverPhotoId: string | null;
  lastWateredAt: string | null;
};

export type Plant = PlantListItem & { clientUpdatedAt: string };
export type WateringEvent = { id: string; wateredAt: string };
export type PlantPhoto = {
  id: string;
  takenAt: string;
  localUri: string | null;
  uploadState: 'pending' | 'done';
};

const nowIso = () => new Date().toISOString();

const PLANT_COLUMNS = `
  p.id, p.name, p.watering_interval_days AS wateringIntervalDays,
  p.cover_photo_id AS coverPhotoId, p.client_updated_at AS clientUpdatedAt,
  (SELECT MAX(w.watered_at) FROM watering_events w
    WHERE w.plant_id = p.id AND w.deleted_at IS NULL) AS lastWateredAt`;

/** Reads come only from SQLite, so every screen works with no network at all. */
export function listPlants(db: SqlDb) {
  return db.getAllAsync<PlantListItem>(
    `SELECT ${PLANT_COLUMNS} FROM plants p WHERE p.deleted_at IS NULL ORDER BY p.name COLLATE NOCASE`,
    [],
  );
}

export function getPlant(db: SqlDb, id: string) {
  return db.getFirstAsync<Plant>(
    `SELECT ${PLANT_COLUMNS} FROM plants p WHERE p.id = ? AND p.deleted_at IS NULL`,
    [id],
  );
}

export function listWaterings(db: SqlDb, plantId: string) {
  return db.getAllAsync<WateringEvent>(
    `SELECT id, watered_at AS wateredAt FROM watering_events
     WHERE plant_id = ? AND deleted_at IS NULL ORDER BY watered_at DESC LIMIT 50`,
    [plantId],
  );
}

export function listPhotos(db: SqlDb, plantId: string) {
  return db.getAllAsync<PlantPhoto>(
    `SELECT id, taken_at AS takenAt, local_uri AS localUri, upload_state AS uploadState
     FROM plant_photos WHERE plant_id = ? AND deleted_at IS NULL ORDER BY taken_at DESC`,
    [plantId],
  );
}

async function writePlant(tx: SqlDb, id: string, data: PlantData, at: string) {
  await tx.runAsync(
    `INSERT INTO plants (id, name, watering_interval_days, cover_photo_id, client_updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET name = excluded.name,
       watering_interval_days = excluded.watering_interval_days,
       cover_photo_id = excluded.cover_photo_id, client_updated_at = excluded.client_updated_at`,
    [id, data.name, data.wateringIntervalDays, data.coverPhotoId, at],
  );
  await enqueue(tx, { kind: 'plant.upsert', id, clientUpdatedAt: at, data }, at);
}

export async function createPlant(
  db: SqlDb,
  input: { name: string; wateringIntervalDays: number },
  at = nowIso(),
) {
  const id = newId();
  await db.withExclusiveTransactionAsync((tx) =>
    writePlant(tx, id, { ...input, coverPhotoId: null }, at),
  );
  return id;
}

export async function updatePlant(
  db: SqlDb,
  id: string,
  input: { name: string; wateringIntervalDays: number },
  at = nowIso(),
) {
  await db.withExclusiveTransactionAsync(async (tx) => {
    const current = await tx.getFirstAsync<{ cover: string | null }>(
      'SELECT cover_photo_id AS cover FROM plants WHERE id = ?',
      [id],
    );
    await writePlant(tx, id, { ...input, coverPhotoId: current?.cover ?? null }, at);
  });
}

/** Tombstone locally (children too, like the server does) and queue one delete. */
export async function deletePlant(db: SqlDb, id: string, at = nowIso()) {
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync('UPDATE plants SET deleted_at = ?, client_updated_at = ? WHERE id = ?', [
      at,
      at,
      id,
    ]);
    await tx.runAsync(
      'UPDATE watering_events SET deleted_at = ? WHERE plant_id = ? AND deleted_at IS NULL',
      [at, id],
    );
    await tx.runAsync(
      'UPDATE plant_photos SET deleted_at = ? WHERE plant_id = ? AND deleted_at IS NULL',
      [at, id],
    );
    // Pending child changes are pointless now; the server cascades the delete.
    await tx.runAsync(
      `DELETE FROM outbox WHERE entity != 'plant' AND entity_id IN (
         SELECT id FROM watering_events WHERE plant_id = ? UNION SELECT id FROM plant_photos WHERE plant_id = ?)`,
      [id, id],
    );
    await enqueue(tx, { kind: 'plant.delete', id, clientUpdatedAt: at }, at);
  });
}

/** Watering is a new immutable event, never an edit, so it can't conflict with another phone. */
export async function waterPlant(db: SqlDb, plantId: string, at = nowIso()) {
  const id = newId();
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync(
      'INSERT INTO watering_events (id, plant_id, watered_at, client_updated_at) VALUES (?, ?, ?, ?)',
      [id, plantId, at, at],
    );
    await enqueue(
      tx,
      { kind: 'wateringEvent.upsert', id, clientUpdatedAt: at, data: { plantId, wateredAt: at } },
      at,
    );
  });
  return id;
}

/** Undo a watering (e.g. tapped by mistake). */
export async function deleteWatering(db: SqlDb, id: string, at = nowIso()) {
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync(
      'UPDATE watering_events SET deleted_at = ?, client_updated_at = ? WHERE id = ?',
      [at, at, id],
    );
    await enqueue(tx, { kind: 'wateringEvent.delete', id, clientUpdatedAt: at }, at);
  });
}

/**
 * A new photo is saved locally and marked 'pending'. It is NOT queued for sync yet: the photo
 * row only goes to the server after the file upload succeeds (see photo-uploader), so other
 * devices never see a photo whose file doesn't exist. The first photo becomes the cover.
 */
export async function addPhoto(
  db: SqlDb,
  plantId: string,
  photoId: string,
  localUri: string,
  at = nowIso(),
) {
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync(
      `INSERT INTO plant_photos (id, plant_id, taken_at, local_uri, upload_state, client_updated_at)
       VALUES (?, ?, ?, ?, 'pending', ?)`,
      [photoId, plantId, at, localUri, at],
    );
    const plant = await tx.getFirstAsync<{ name: string; interval: number; cover: string | null }>(
      'SELECT name, watering_interval_days AS interval, cover_photo_id AS cover FROM plants WHERE id = ?',
      [plantId],
    );
    if (plant && !plant.cover) {
      await writePlant(
        tx,
        plantId,
        { name: plant.name, wateringIntervalDays: plant.interval, coverPhotoId: photoId },
        at,
      );
    }
  });
}
