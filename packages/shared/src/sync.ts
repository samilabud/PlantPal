import { z } from 'zod';

/**
 * Wire format for offline sync. Ids are UUIDs generated on the phone, so a row can be created
 * offline and keep its id forever. `clientUpdatedAt` is the phone's clock at the edit (used for
 * last-write-wins); `serverVersion` is a server-assigned, ever-increasing number (used as the
 * pull cursor). Deletes are tombstones (`deletedAt`) so they sync like any other change.
 */
const isoDate = z.iso.datetime();

export const PlantData = z.object({
  name: z.string().trim().min(1).max(80),
  wateringIntervalDays: z.number().int().min(1).max(365),
  coverPhotoId: z.uuid().nullable(),
});
export type PlantData = z.infer<typeof PlantData>;

export const WateringEventData = z.object({
  plantId: z.uuid(),
  wateredAt: isoDate,
});
export type WateringEventData = z.infer<typeof WateringEventData>;

export const PlantPhotoData = z.object({
  plantId: z.uuid(),
  takenAt: isoDate,
});
export type PlantPhotoData = z.infer<typeof PlantPhotoData>;

const meta = {
  id: z.uuid(),
  clientUpdatedAt: isoDate,
  serverVersion: z.number().int(),
  deletedAt: isoDate.nullable(),
};

export const PlantRecord = PlantData.extend(meta);
export type PlantRecord = z.infer<typeof PlantRecord>;
export const WateringEventRecord = WateringEventData.extend(meta);
export type WateringEventRecord = z.infer<typeof WateringEventRecord>;
export const PlantPhotoRecord = PlantPhotoData.extend(meta);
export type PlantPhotoRecord = z.infer<typeof PlantPhotoRecord>;

const base = { id: z.uuid(), clientUpdatedAt: isoDate };

export const SyncChange = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('plant.upsert'), ...base, data: PlantData }),
  z.object({ kind: z.literal('plant.delete'), ...base }),
  z.object({ kind: z.literal('wateringEvent.upsert'), ...base, data: WateringEventData }),
  z.object({ kind: z.literal('wateringEvent.delete'), ...base }),
  z.object({ kind: z.literal('plantPhoto.upsert'), ...base, data: PlantPhotoData }),
  z.object({ kind: z.literal('plantPhoto.delete'), ...base }),
]);
export type SyncChange = z.infer<typeof SyncChange>;

export const SYNC_MAX_CHANGES = 200;
export const SYNC_PAGE_SIZE = 500;

export const SyncRequest = z.object({
  /** Highest serverVersion this device has already pulled. 0 on first sync. */
  cursor: z.number().int().min(0),
  changes: z.array(SyncChange).max(SYNC_MAX_CHANGES),
});
export type SyncRequest = z.infer<typeof SyncRequest>;

export const SyncRejection = z.object({
  id: z.uuid(),
  kind: z.string(),
  /** stale: the server has a newer edit; forbidden: not your row; invalid: e.g. unknown plant;
   *  limit: the free plan's limit (plants or photos) was reached. */
  reason: z.enum(['stale', 'forbidden', 'invalid', 'limit']),
});
export type SyncRejection = z.infer<typeof SyncRejection>;

export const SyncResponse = z.object({
  cursor: z.number().int().min(0),
  /** More changes are waiting: call again with the new cursor. */
  hasMore: z.boolean(),
  plants: z.array(PlantRecord),
  wateringEvents: z.array(WateringEventRecord),
  plantPhotos: z.array(PlantPhotoRecord),
  rejected: z.array(SyncRejection),
});
export type SyncResponse = z.infer<typeof SyncResponse>;

export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

export const PhotoUploadUrlRequest = z.object({
  photoId: z.uuid(),
  contentType: z.literal('image/jpeg'),
  size: z.number().int().positive().max(PHOTO_MAX_BYTES),
});
export type PhotoUploadUrlRequest = z.infer<typeof PhotoUploadUrlRequest>;

export const SignedUrlResponse = z.object({ url: z.url(), expiresAt: isoDate });
export type SignedUrlResponse = z.infer<typeof SignedUrlResponse>;
