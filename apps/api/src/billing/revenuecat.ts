import { PREMIUM_ENTITLEMENT } from '@plantpal/shared';
import { eq } from 'drizzle-orm';

import type { Db } from '@/db';
import { users } from '@/db/schema';
import { HttpError } from '@/lib/errors';

export type Entitlement = { active: boolean; expiresAt: Date | null };

type SubscriberResponse = {
  subscriber: {
    entitlements: Record<
      string,
      { expires_date: string | null; grace_period_expires_date?: string | null }
    >;
  };
};

/**
 * The source of truth for "is this user Premium right now": RevenueCat's customer record.
 * Reading it after every webhook (RevenueCat's own advice) makes the result independent of
 * event order and duplicates. Note: this endpoint creates the customer if missing, so we only
 * call it for our own user ids.
 */
export async function fetchEntitlement(
  appUserId: string,
  secretKey: string,
  fetchFn: typeof fetch = fetch,
  now = new Date(),
): Promise<Entitlement> {
  const res = await fetchFn(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
    { headers: { Authorization: `Bearer ${secretKey}`, Accept: 'application/json' } },
  );
  if (!res.ok)
    throw new HttpError(502, 'revenuecat_unavailable', `RevenueCat answered ${res.status}`);
  const body = (await res.json()) as SubscriberResponse;
  const ent = body.subscriber.entitlements[PREMIUM_ENTITLEMENT];
  if (!ent) return { active: false, expiresAt: null };

  // A billing-retry grace period still counts as Premium (the store is retrying the charge).
  const end = ent.grace_period_expires_date ?? ent.expires_date;
  const expiresAt = end ? new Date(end) : null; // null = lifetime
  return { active: !expiresAt || expiresAt > now, expiresAt };
}

/**
 * Account deletion: ask RevenueCat to delete its customer record (permanent, queued on their
 * side). 404 means there was nothing to delete, which is also success.
 * Docs: revenuecat.com/docs/api-v1/customers (DELETE /subscribers/{app_user_id}).
 */
export async function deleteCustomer(
  appUserId: string,
  secretKey: string,
  fetchFn: typeof fetch = fetch,
): Promise<boolean> {
  const res = await fetchFn(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${secretKey}` } },
  );
  return res.ok || res.status === 404;
}

export async function applyEntitlement(db: Db, userId: string, ent: Entitlement) {
  await db
    .update(users)
    .set({
      plan: ent.active ? 'premium' : 'free',
      planExpiresAt: ent.active ? ent.expiresAt : null,
    })
    .where(eq(users.id, userId));
}
