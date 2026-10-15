import type { SignedUrlResponse } from '@plantpal/shared';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';

import { requireUserId } from '@/auth/require-user';
import { db } from '@/db';
import { plantPhotos } from '@/db/schema';
import { HttpError } from '@/lib/errors';
import { json, withErrors } from '@/lib/http';
import { photoPathname, signPhotoView } from '@/storage/photos';

/** GET /api/photos/:id/url: a 1-hour signed URL to view one of my photos. */
export const GET = withErrors(async (request, ctx: RouteContext<'/api/photos/[id]/url'>) => {
  const userId = await requireUserId(request);
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) throw new HttpError(400, 'invalid_id', 'Invalid photo id');

  const [photo] = await db()
    .select({ id: plantPhotos.id })
    .from(plantPhotos)
    .where(
      and(eq(plantPhotos.id, id), eq(plantPhotos.userId, userId), isNull(plantPhotos.deletedAt)),
    );
  // 404 (not 403) for someone else's photo: don't confirm that the id exists.
  if (!photo) throw new HttpError(404, 'not_found', 'Photo not found');

  const response: SignedUrlResponse = await signPhotoView(photoPathname(userId, id));
  return json(response);
});
