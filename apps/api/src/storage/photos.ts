import { PHOTO_MAX_BYTES } from '@plantpal/shared';
import { del, issueSignedToken, list, presignUrl } from '@vercel/blob';

/**
 * Private Blob store, authenticated with Vercel OIDC (no long-lived token).
 * The server never handles photo bytes: it signs short-lived URLs for one exact pathname,
 * and the phone uploads/downloads directly.
 */
export const photoPathname = (userId: string, photoId: string) =>
  `users/${userId}/photos/${photoId}.jpg`;

const UPLOAD_URL_TTL_MS = 10 * 60_000;
const VIEW_URL_TTL_MS = 60 * 60_000;

export async function signPhotoUpload(pathname: string) {
  const validUntil = Date.now() + UPLOAD_URL_TTL_MS;
  const token = await issueSignedToken({
    pathname,
    operations: ['put'],
    allowedContentTypes: ['image/jpeg'],
    maximumSizeInBytes: PHOTO_MAX_BYTES,
    validUntil,
  });
  const { presignedUrl } = await presignUrl(token, {
    operation: 'put',
    pathname,
    access: 'private',
    allowedContentTypes: ['image/jpeg'],
    maximumSizeInBytes: PHOTO_MAX_BYTES,
    addRandomSuffix: false,
    // Retrying an upload for the same photo id overwrites the half-finished one.
    allowOverwrite: true,
  });
  return { url: presignedUrl, expiresAt: new Date(validUntil).toISOString() };
}

export async function signPhotoView(pathname: string) {
  const validUntil = Date.now() + VIEW_URL_TTL_MS;
  const token = await issueSignedToken({ pathname, operations: ['get'], validUntil });
  const { presignedUrl } = await presignUrl(token, {
    operation: 'get',
    pathname,
    access: 'private',
  });
  return { url: presignedUrl, expiresAt: new Date(validUntil).toISOString() };
}

/** Account deletion: remove every file under the user's prefix. */
export async function deleteUserPhotos(userId: string) {
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: `users/${userId}/`, cursor });
    if (page.blobs.length) await del(page.blobs.map((b) => b.pathname));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
}
