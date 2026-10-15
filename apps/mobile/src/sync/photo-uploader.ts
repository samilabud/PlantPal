import { enqueue } from '@/data/outbox';
import type { SqlDb } from '@/db/types';

export type PhotoUploadDeps = {
  /** Size in bytes of a local file, or 0 if it is gone. */
  fileSize: (uri: string) => number;
  getUploadUrl: (photoId: string, size: number) => Promise<string>;
  /** PUT the file to the signed URL. Throws on failure. */
  putFile: (url: string, uri: string) => Promise<void>;
};

/**
 * Uploads photos that are waiting, one by one. Only after a file is safely in Blob storage is
 * the photo row queued for sync, so other devices never get a photo without a file.
 * A failed upload just stays 'pending' and is retried on the next sync.
 */
export async function uploadPendingPhotos(db: SqlDb, deps: PhotoUploadDeps) {
  const pending = await db.getAllAsync<{
    id: string;
    plantId: string;
    takenAt: string;
    localUri: string | null;
  }>(
    `SELECT id, plant_id AS plantId, taken_at AS takenAt, local_uri AS localUri FROM plant_photos
     WHERE upload_state = 'pending' AND deleted_at IS NULL ORDER BY taken_at`,
    [],
  );

  let uploaded = 0;
  for (const photo of pending) {
    const size = photo.localUri ? deps.fileSize(photo.localUri) : 0;
    if (!photo.localUri || size === 0) continue; // file missing: nothing we can upload

    const url = await deps.getUploadUrl(photo.id, size);
    await deps.putFile(url, photo.localUri);

    const now = new Date().toISOString();
    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.runAsync("UPDATE plant_photos SET upload_state = 'done' WHERE id = ?", [photo.id]);
      await enqueue(
        tx,
        {
          kind: 'plantPhoto.upsert',
          id: photo.id,
          clientUpdatedAt: now,
          data: { plantId: photo.plantId, takenAt: photo.takenAt },
        },
        now,
      );
    });
    uploaded++;
  }
  return uploaded;
}
