import { billingConfig } from '@/billing/config';
import { applyEntitlement, fetchEntitlement } from '@/billing/revenuecat';
import { requireUserId } from '@/auth/require-user';
import { getMe } from '@/auth/session';
import { db } from '@/db';
import { HttpError } from '@/lib/errors';
import { json, withErrors } from '@/lib/http';

/**
 * POST /api/subscription/sync: right after a purchase or restore, the app asks the server to
 * re-read its entitlement from RevenueCat now, instead of waiting for the webhook. The server
 * still decides; the phone never tells the server "I'm Premium".
 */
export const POST = withErrors(async (request) => {
  const userId = await requireUserId(request);
  const { secretKey } = billingConfig();
  if (!secretKey) throw new HttpError(503, 'billing_not_configured', 'Billing is not configured');
  await applyEntitlement(db(), userId, await fetchEntitlement(userId, secretKey));
  return json(await getMe(db(), userId));
});
