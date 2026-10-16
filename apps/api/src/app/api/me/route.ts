import { DeleteAccountRequest, type DeleteAccountResponse } from '@plantpal/shared';
import { eq } from 'drizzle-orm';

import { revokeAppleGrant } from '@/auth/apple-revoke';
import { authConfig } from '@/auth/config';
import { requireUserId } from '@/auth/require-user';
import { getMe } from '@/auth/session';
import { billingConfig } from '@/billing/config';
import { deleteCustomer } from '@/billing/revenuecat';
import { db } from '@/db';
import { users, webhookEvents } from '@/db/schema';
import { json, parseBody, withErrors } from '@/lib/http';
import { deleteUserPhotos } from '@/storage/photos';

/** GET /api/me: the signed-in user's profile and plan. */
export const GET = withErrors(async (request) => {
  const userId = await requireUserId(request);
  return json(await getMe(db(), userId));
});

/**
 * DELETE /api/me: permanent account deletion (App Store guideline 5.1.1(v)).
 * Deleting the user row cascades to identities, tokens, plants, waterings and photo rows.
 * Photo files are removed from Blob storage first, so nothing is left behind if that fails.
 * RevenueCat's customer record and our webhook log rows for this user are deleted too.
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

  await deleteUserPhotos(userId);
  await db().delete(webhookEvents).where(eq(webhookEvents.appUserId, userId));
  await db().delete(users).where(eq(users.id, userId));

  // Best effort, after our own data is gone: a RevenueCat outage must never block someone
  // from deleting their account. A failure is logged so it can be retried by hand.
  const { secretKey } = billingConfig();
  if (secretKey) {
    const ok = await deleteCustomer(userId, secretKey).catch(() => false);
    if (!ok) console.error(`RevenueCat customer deletion failed for ${userId}`);
  }

  const response: DeleteAccountResponse = { deleted: true, appleRevoked };
  return json(response);
});
