import { PhotoUploadUrlRequest, type SignedUrlResponse } from '@plantpal/shared';
import { eq } from 'drizzle-orm';

import { requireUserId } from '@/auth/require-user';
import { db } from '@/db';
import { plantPhotos } from '@/db/schema';
import { HttpError } from '@/lib/errors';
import { json, parseBody, withErrors } from '@/lib/http';
import { photoPathname, signPhotoUpload } from '@/storage/photos';

/**
 * POST /api/photos/upload-url: a 10-minute URL that can PUT one JPEG (max 5 MB) to exactly
 * users/<me>/photos/<photoId>.jpg. The path is built here from the token's user id, so a client
 * can never write into someone else's folder.
 */
export const POST = withErrors(async (request) => {
  const userId = await requireUserId(request);
  const body = await parseBody(request, PhotoUploadUrlRequest);

  // A photo id that already belongs to another user can't be reused.
  const [existing] = await db()
    .select({ userId: plantPhotos.userId })
    .from(plantPhotos)
    .where(eq(plantPhotos.id, body.photoId));
  if (existing && existing.userId !== userId)
    throw new HttpError(403, 'forbidden', 'Not your photo');

  const response: SignedUrlResponse = await signPhotoUpload(photoPathname(userId, body.photoId));
  return json(response);
});
