import { SignedUrlResponse } from '@plantpal/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { hasDb, resetDb, testDb } from '@/test/db';
import { createUser, uuid } from '@/test/users';
import { runSync } from '@/sync/sync-service';

import { GET as viewUrl } from './[id]/url/route';
import { POST as uploadUrl } from './upload-url/route';

vi.mock('@/storage/photos', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/storage/photos')>()),
  signPhotoUpload: vi.fn(async (pathname: string) => ({
    url: `https://blob.test/put/${pathname}`,
    expiresAt: new Date(Date.now() + 600_000).toISOString(),
  })),
  signPhotoView: vi.fn(async (pathname: string) => ({
    url: `https://blob.test/get/${pathname}`,
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  })),
}));

const post = (body: unknown, headers: Record<string, string>) =>
  new Request('http://test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe.skipIf(!hasDb)('photo URL routes (integration)', () => {
  beforeEach(resetDb);

  it('signs an upload URL for my own folder only', async () => {
    const me = await createUser();
    const photoId = uuid();
    const res = await uploadUrl(post({ photoId, contentType: 'image/jpeg', size: 1000 }, me.auth));
    expect(res.status).toBe(200);
    const body = SignedUrlResponse.parse(await res.json());
    expect(body.url).toContain(`users/${me.id}/photos/${photoId}.jpg`);
  });

  it('rejects files that are too big or not JPEG', async () => {
    const me = await createUser();
    const tooBig = await uploadUrl(
      post({ photoId: uuid(), contentType: 'image/jpeg', size: 6 * 1024 * 1024 }, me.auth),
    );
    const png = await uploadUrl(
      post({ photoId: uuid(), contentType: 'image/png', size: 1000 }, me.auth),
    );
    expect([tooBig.status, png.status]).toEqual([400, 400]);
  });

  it('refuses an upload URL for a photo id owned by someone else', async () => {
    const owner = await createUser();
    const plantId = uuid();
    const photoId = uuid();
    const t = new Date().toISOString();
    await runSync(testDb().db, owner.id, {
      cursor: 0,
      changes: [
        {
          kind: 'plant.upsert',
          id: plantId,
          clientUpdatedAt: t,
          data: { name: 'x', wateringIntervalDays: 3, coverPhotoId: null },
        },
        {
          kind: 'plantPhoto.upsert',
          id: photoId,
          clientUpdatedAt: t,
          data: { plantId, takenAt: t },
        },
      ],
    });
    const intruder = await createUser();
    const res = await uploadUrl(
      post({ photoId, contentType: 'image/jpeg', size: 1000 }, intruder.auth),
    );
    expect(res.status).toBe(403);

    // Viewing: the owner gets a URL, the intruder gets 404 (not 403, so the id isn't confirmed).
    const mine = await viewUrl(
      new Request('http://test', { headers: owner.auth }),
      params(photoId),
    );
    expect(mine.status).toBe(200);
    const theirs = await viewUrl(
      new Request('http://test', { headers: intruder.auth }),
      params(photoId),
    );
    expect(theirs.status).toBe(404);
  });

  it('requires sign-in', async () => {
    const res = await uploadUrl(post({ photoId: uuid(), contentType: 'image/jpeg', size: 1 }, {}));
    expect(res.status).toBe(401);
  });
});
