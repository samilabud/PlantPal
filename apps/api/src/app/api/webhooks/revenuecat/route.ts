import { PREMIUM_ENTITLEMENT } from '@plantpal/shared';
import { eq, inArray } from 'drizzle-orm';

import { billingConfig } from '@/billing/config';
import { applyEntitlement, fetchEntitlement, type Entitlement } from '@/billing/revenuecat';
import { affectedUserIds, verifyWebhook, WebhookEvent } from '@/billing/webhook';
import { db } from '@/db';
import { users, webhookEvents } from '@/db/schema';
import { HttpError } from '@/lib/errors';
import { json, withErrors } from '@/lib/http';

/**
 * POST /api/webhooks/revenuecat
 * 1. Verify (auth header and/or HMAC over the RAW body, before parsing).
 * 2. Record the event id; a duplicate that was already processed is acknowledged and skipped.
 * 3. For each affected user, read the current entitlement from RevenueCat and store it.
 * 4. Mark processed. Any failure returns non-200, so RevenueCat retries (5x, up to 80 min apart),
 *    and the retry is safe because steps 2-3 are idempotent.
 * Processing is inline (well under RevenueCat's 60 s timeout) so a failure can still be retried.
 */
export const POST = withErrors(async (request) => {
  const cfg = billingConfig();
  const raw = await request.text();
  verifyWebhook(raw, request.headers, cfg);

  let parsed;
  try {
    parsed = WebhookEvent.safeParse(JSON.parse(raw));
  } catch {
    throw new HttpError(400, 'invalid_json', 'Body must be JSON');
  }
  if (!parsed.success) throw new HttpError(400, 'invalid_event', 'Not a RevenueCat event');
  const event = parsed.data.event;

  const [inserted] = await db()
    .insert(webhookEvents)
    .values({
      id: event.id,
      type: event.type,
      appUserId: event.app_user_id ?? null,
      environment: event.environment ?? null,
    })
    .onConflictDoNothing()
    .returning({ id: webhookEvents.id });
  if (!inserted) {
    const [seen] = await db().select().from(webhookEvents).where(eq(webhookEvents.id, event.id));
    if (seen?.processedAt) return json({ ok: true, duplicate: true });
  }

  const candidates = affectedUserIds(event);
  const known = candidates.length
    ? await db().select({ id: users.id }).from(users).where(inArray(users.id, candidates))
    : [];

  for (const { id } of known) {
    const ent: Entitlement = cfg.secretKey
      ? await fetchEntitlement(id, cfg.secretKey)
      : entitlementFromEvent(event); // local/dev fallback without a secret key
    await applyEntitlement(db(), id, ent);
  }

  await db()
    .update(webhookEvents)
    .set({ processedAt: new Date() })
    .where(eq(webhookEvents.id, event.id));
  return json({ ok: true, users: known.length });
});

/** Fallback only: trusts the event itself (order-dependent, so production uses the API). */
function entitlementFromEvent(e: WebhookEvent['event']): Entitlement {
  const expiresAt = e.expiration_at_ms ? new Date(e.expiration_at_ms) : null;
  const grants = (e.entitlement_ids ?? []).includes(PREMIUM_ENTITLEMENT) && e.type !== 'EXPIRATION';
  const active = grants && (!expiresAt || expiresAt > new Date());
  return { active, expiresAt };
}
