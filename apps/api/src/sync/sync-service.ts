import {
  SYNC_PAGE_SIZE,
  type PlantPhotoRecord,
  type PlantRecord,
  type SyncChange,
  type SyncRejection,
  type SyncRequest,
  type SyncResponse,
  type WateringEventRecord,
} from '@plantpal/shared';
import { and, asc, eq, gt, inArray, isNull, lt, sql } from 'drizzle-orm';

import type { Db } from '@/db';
import { plantPhotos, plants, wateringEvents } from '@/db/schema';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/** A phone clock may be wrong. A timestamp from the future would win every conflict forever,
 *  so anything more than a minute ahead of the server is treated as "now". */
const MAX_CLOCK_SKEW_MS = 60_000;
export function clampClientTime(iso: string, now: Date): Date {
  const t = new Date(iso);
  const max = now.getTime() + MAX_CLOCK_SKEW_MS;
  return t.getTime() > max ? new Date(max) : t;
}

const nextVersion = sql<number>`nextval('sync_version_seq')`;

/**
 * POST /api/sync in one transaction:
 * 1. Lock this user (advisory lock), so their writes commit in version order (see below).
 * 2. Apply the device's changes with last-write-wins on clientUpdatedAt.
 * 3. Return every row changed after the device's cursor, oldest first, one page at a time.
 *
 * Why the lock: versions come from a sequence. Without it, transaction A could take version 100,
 * transaction B take 101 and commit first; a device pulling then would jump its cursor to 101
 * and never see 100. Serialising each user's sync makes "commit order = version order" per user,
 * and every pull is filtered by user, so that's all we need.
 */
export async function runSync(
  db: Db,
  userId: string,
  request: SyncRequest,
  now = new Date(),
): Promise<SyncResponse> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${userId}, 0))`);

    const rejected: SyncRejection[] = [];
    for (const change of request.changes) {
      const reason = await applyChange(tx, userId, change, now);
      if (reason) rejected.push({ id: change.id, kind: change.kind, reason });
    }

    const page = await pullChanges(tx, userId, request.cursor);

    // A device whose edit lost (stale) gets the winning row back even if its cursor is already
    // past that row's version, so it can replace its local copy.
    await addStale(page, tx, userId, rejected);

    return { ...page, rejected };
  });
}

async function applyChange(
  tx: Tx,
  userId: string,
  change: SyncChange,
  now: Date,
): Promise<SyncRejection['reason'] | null> {
  const at = clampClientTime(change.clientUpdatedAt, now);

  switch (change.kind) {
    case 'plant.upsert': {
      const rows = await tx
        .insert(plants)
        .values({
          id: change.id,
          userId,
          ...change.data,
          clientUpdatedAt: at,
          serverVersion: nextVersion,
          deletedAt: null,
        })
        .onConflictDoUpdate({
          target: plants.id,
          set: {
            name: change.data.name,
            wateringIntervalDays: change.data.wateringIntervalDays,
            coverPhotoId: change.data.coverPhotoId,
            clientUpdatedAt: at,
            serverVersion: nextVersion,
            deletedAt: null,
          },
          // Only my row, and only if my edit is newer: last write wins.
          setWhere: and(eq(plants.userId, userId), lt(plants.clientUpdatedAt, at)),
        })
        .returning({ id: plants.id });
      return rows.length ? null : classify(tx, plants, change.id, userId);
    }

    case 'plant.delete': {
      const rows = await tx
        .update(plants)
        .set({ deletedAt: at, clientUpdatedAt: at, serverVersion: nextVersion })
        .where(
          and(eq(plants.id, change.id), eq(plants.userId, userId), lt(plants.clientUpdatedAt, at)),
        )
        .returning({ id: plants.id });
      if (!rows.length) return classifyDelete(tx, plants, change.id, userId);
      // Children go with the plant, as tombstones, so other devices drop them too.
      for (const table of [wateringEvents, plantPhotos]) {
        await tx
          .update(table)
          .set({ deletedAt: at, serverVersion: nextVersion })
          .where(and(eq(table.plantId, change.id), isNull(table.deletedAt)));
      }
      return null;
    }

    case 'wateringEvent.upsert': {
      if (!(await ownsPlant(tx, change.data.plantId, userId))) return 'invalid';
      const wateredAt = new Date(change.data.wateredAt);
      const rows = await tx
        .insert(wateringEvents)
        .values({
          id: change.id,
          userId,
          plantId: change.data.plantId,
          wateredAt,
          clientUpdatedAt: at,
          serverVersion: nextVersion,
          deletedAt: null,
        })
        .onConflictDoUpdate({
          target: wateringEvents.id,
          set: { wateredAt, clientUpdatedAt: at, serverVersion: nextVersion, deletedAt: null },
          setWhere: and(eq(wateringEvents.userId, userId), lt(wateringEvents.clientUpdatedAt, at)),
        })
        .returning({ id: wateringEvents.id });
      return rows.length ? null : classify(tx, wateringEvents, change.id, userId);
    }

    case 'plantPhoto.upsert': {
      if (!(await ownsPlant(tx, change.data.plantId, userId))) return 'invalid';
      const takenAt = new Date(change.data.takenAt);
      const rows = await tx
        .insert(plantPhotos)
        .values({
          id: change.id,
          userId,
          plantId: change.data.plantId,
          takenAt,
          clientUpdatedAt: at,
          serverVersion: nextVersion,
          deletedAt: null,
        })
        .onConflictDoUpdate({
          target: plantPhotos.id,
          set: { takenAt, clientUpdatedAt: at, serverVersion: nextVersion, deletedAt: null },
          setWhere: and(eq(plantPhotos.userId, userId), lt(plantPhotos.clientUpdatedAt, at)),
        })
        .returning({ id: plantPhotos.id });
      return rows.length ? null : classify(tx, plantPhotos, change.id, userId);
    }

    case 'wateringEvent.delete':
    case 'plantPhoto.delete': {
      const table = change.kind === 'wateringEvent.delete' ? wateringEvents : plantPhotos;
      const rows = await tx
        .update(table)
        .set({ deletedAt: at, clientUpdatedAt: at, serverVersion: nextVersion })
        .where(
          and(eq(table.id, change.id), eq(table.userId, userId), lt(table.clientUpdatedAt, at)),
        )
        .returning({ id: table.id });
      return rows.length ? null : classifyDelete(tx, table, change.id, userId);
    }
  }
}

type SyncTable = typeof plants | typeof wateringEvents | typeof plantPhotos;

/** Upsert did nothing: either someone else's id, or the server already has a newer edit. */
async function classify(tx: Tx, table: SyncTable, id: string, userId: string) {
  const [row] = await tx.select({ userId: table.userId }).from(table).where(eq(table.id, id));
  return row && row.userId !== userId ? 'forbidden' : 'stale';
}

/** Deleting something the server never saw (created and deleted offline) is fine: nothing to do. */
async function classifyDelete(tx: Tx, table: SyncTable, id: string, userId: string) {
  const [row] = await tx.select({ userId: table.userId }).from(table).where(eq(table.id, id));
  if (!row) return null;
  return row.userId !== userId ? 'forbidden' : 'stale';
}

async function ownsPlant(tx: Tx, plantId: string, userId: string) {
  const [row] = await tx
    .select({ userId: plants.userId })
    .from(plants)
    .where(eq(plants.id, plantId));
  return row?.userId === userId;
}

async function pullChanges(tx: Tx, userId: string, cursor: number) {
  const limit = SYNC_PAGE_SIZE + 1;
  const plantRows = await tx
    .select()
    .from(plants)
    .where(and(eq(plants.userId, userId), gt(plants.serverVersion, cursor)))
    .orderBy(asc(plants.serverVersion))
    .limit(limit);
  const eventRows = await tx
    .select()
    .from(wateringEvents)
    .where(and(eq(wateringEvents.userId, userId), gt(wateringEvents.serverVersion, cursor)))
    .orderBy(asc(wateringEvents.serverVersion))
    .limit(limit);
  const photoRows = await tx
    .select()
    .from(plantPhotos)
    .where(and(eq(plantPhotos.userId, userId), gt(plantPhotos.serverVersion, cursor)))
    .orderBy(asc(plantPhotos.serverVersion))
    .limit(limit);

  // Each table returned its oldest PAGE+1 rows, so the oldest PAGE of the merge are the
  // globally oldest. The cursor moves to the last row we actually return.
  const versions = [...plantRows, ...eventRows, ...photoRows]
    .map((r) => r.serverVersion)
    .sort((a, b) => a - b);
  const hasMore = versions.length > SYNC_PAGE_SIZE;
  const last = versions.slice(0, SYNC_PAGE_SIZE).at(-1);
  const inPage = (r: { serverVersion: number }) => last !== undefined && r.serverVersion <= last;

  return {
    cursor: last ?? cursor,
    hasMore,
    plants: plantRows.filter(inPage).map(toPlant),
    wateringEvents: eventRows.filter(inPage).map(toEvent),
    plantPhotos: photoRows.filter(inPage).map(toPhoto),
  };
}

/** Fetch rows by id (for stale rejections) and add the ones not already in the page. */
async function addStale(
  page: Awaited<ReturnType<typeof pullChanges>>,
  tx: Tx,
  userId: string,
  rejected: SyncRejection[],
) {
  const ids = (prefix: string) =>
    rejected.filter((r) => r.reason === 'stale' && r.kind.startsWith(prefix)).map((r) => r.id);
  const missing = <R extends { id: string }>(list: R[], wanted: string[]) =>
    wanted.filter((id) => !list.some((r) => r.id === id));

  const p = missing(page.plants, ids('plant.'));
  if (p.length) {
    const rows = await tx
      .select()
      .from(plants)
      .where(and(eq(plants.userId, userId), inArray(plants.id, p)));
    page.plants.push(...rows.map(toPlant));
  }
  const e = missing(page.wateringEvents, ids('wateringEvent.'));
  if (e.length) {
    const rows = await tx
      .select()
      .from(wateringEvents)
      .where(and(eq(wateringEvents.userId, userId), inArray(wateringEvents.id, e)));
    page.wateringEvents.push(...rows.map(toEvent));
  }
  const ph = missing(page.plantPhotos, ids('plantPhoto.'));
  if (ph.length) {
    const rows = await tx
      .select()
      .from(plantPhotos)
      .where(and(eq(plantPhotos.userId, userId), inArray(plantPhotos.id, ph)));
    page.plantPhotos.push(...rows.map(toPhoto));
  }
}

const iso = (d: Date | null) => (d ? d.toISOString() : null);
const meta = (r: {
  id: string;
  clientUpdatedAt: Date;
  serverVersion: number;
  deletedAt: Date | null;
}) => ({
  id: r.id,
  clientUpdatedAt: r.clientUpdatedAt.toISOString(),
  serverVersion: r.serverVersion,
  deletedAt: iso(r.deletedAt),
});

function toPlant(r: typeof plants.$inferSelect): PlantRecord {
  return {
    ...meta(r),
    name: r.name,
    wateringIntervalDays: r.wateringIntervalDays,
    coverPhotoId: r.coverPhotoId,
  };
}
function toEvent(r: typeof wateringEvents.$inferSelect): WateringEventRecord {
  return { ...meta(r), plantId: r.plantId, wateredAt: r.wateredAt.toISOString() };
}
function toPhoto(r: typeof plantPhotos.$inferSelect): PlantPhotoRecord {
  return { ...meta(r), plantId: r.plantId, takenAt: r.takenAt.toISOString() };
}
