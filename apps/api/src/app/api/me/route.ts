import { DeleteAccountRequest, type DeleteAccountResponse } from '@plantpal/shared';
import { eq } from 'drizzle-orm';

import { revokeAppleGrant } from '@/auth/apple-revoke';
import { authConfig } from '@/auth/config';
import { requireUserId } from '@/auth/require-user';
import { getMe } from '@/auth/session';
import { db } from '@/db';
import { users } from '@/db/schema';
import { json, parseBody, withErrors } from '@/lib/http';

/** GET /api/me: the signed-in user's profile and plan. */
export const GET = withErrors(async (request) => {
  const userId = await requireUserId(request);
  return json(await getMe(db(), userId));
});

/**
 * DELETE /api/me: permanent account deletion (App Store guideline 5.1.1(v)).
 * Deleting the user row cascades to identities and refresh tokens; later milestones add their
 * tables with ON DELETE CASCADE too, plus photo cleanup in storage.
 */
export const DELETE = withErrors(async (request) => {
  const userId = await requireUserId(request);
  const body = await parseBody(request, DeleteAccountRequest);
  const me = await getMe(db(), userId);

  let appleRevoked = false;
  const { appleRevoke, appleClientIds } = authConfig();
  // Only allow-listed bundle ids, so the body can't make us sign secrets for arbitrary ids.
  const clientId = appleClientIds.find((id) => id === body.appleClientId);
  if (me.providers.includes('apple') && body.appleAuthorizationCode && appleRevoke && clientId) {
    appleRevoked = await revokeAppleGrant(body.appleAuthorizationCode, {
      cfg: appleRevoke,
      clientId,
    });
  }

  await db().delete(users).where(eq(users.id, userId));
  const response: DeleteAccountResponse = { deleted: true, appleRevoked };
  return json(response);
});
