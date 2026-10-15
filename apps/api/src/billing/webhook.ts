import { createHmac, timingSafeEqual } from 'node:crypto';

import { z } from 'zod';

import { HttpError } from '@/lib/errors';

import type { BillingConfig } from './config';

const SIGNATURE_TOLERANCE_S = 5 * 60;

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/**
 * Two independent checks, both in constant time:
 * - Authorization header: the shared value set in the RevenueCat dashboard.
 * - HMAC signature (X-RevenueCat-Webhook-Signature: t=<unix>,v1=<hex>) over "<t>.<raw body>":
 *   proves the body wasn't changed, and the 5-minute window stops replays of captured requests.
 * Each check runs when its secret is configured; with neither configured we refuse (fail closed).
 */
export function verifyWebhook(
  rawBody: string,
  headers: Headers,
  cfg: BillingConfig,
  now = Date.now(),
) {
  if (!cfg.webhookAuth && !cfg.webhookSigningSecret) {
    throw new HttpError(503, 'webhook_not_configured', 'Webhook verification is not configured');
  }
  if (cfg.webhookAuth && !safeEqual(headers.get('authorization') ?? '', cfg.webhookAuth)) {
    throw new HttpError(401, 'unauthorized', 'Bad webhook authorization');
  }
  if (cfg.webhookSigningSecret) {
    const header = headers.get('x-revenuecat-webhook-signature') ?? '';
    const parts = Object.fromEntries(
      header.split(',').map((kv) => kv.split('=', 2) as [string, string]),
    );
    const t = Number(parts.t);
    if (!parts.v1 || !Number.isFinite(t))
      throw new HttpError(401, 'bad_signature', 'Missing signature');
    if (Math.abs(now / 1000 - t) > SIGNATURE_TOLERANCE_S) {
      throw new HttpError(401, 'stale_signature', 'Signature timestamp outside the allowed window');
    }
    const expected = createHmac('sha256', cfg.webhookSigningSecret)
      .update(`${t}.${rawBody}`)
      .digest('hex');
    if (!safeEqual(parts.v1, expected)) throw new HttpError(401, 'bad_signature', 'Bad signature');
  }
}

export const WebhookEvent = z.object({
  api_version: z.string().optional(),
  event: z
    .object({
      id: z.string().min(1),
      type: z.string().min(1),
      app_user_id: z.string().nullish(),
      original_app_user_id: z.string().nullish(),
      aliases: z.array(z.string()).nullish(),
      transferred_from: z.array(z.string()).nullish(),
      transferred_to: z.array(z.string()).nullish(),
      environment: z.string().nullish(),
      entitlement_ids: z.array(z.string()).nullish(),
      expiration_at_ms: z.number().nullish(),
    })
    .passthrough(),
});
export type WebhookEvent = z.infer<typeof WebhookEvent>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Which of OUR users this event is about. The app logs in to RevenueCat with our user id, so
 * the ids we care about are UUIDs; anonymous RevenueCat ids ($RCAnonymousID:…) are ignored.
 * TRANSFER moves a purchase between accounts, so both sides need a refresh.
 */
export function affectedUserIds(e: WebhookEvent['event']): string[] {
  const ids = [
    e.app_user_id,
    e.original_app_user_id,
    ...(e.aliases ?? []),
    ...(e.transferred_from ?? []),
    ...(e.transferred_to ?? []),
  ].filter((id): id is string => typeof id === 'string' && UUID.test(id));
  return [...new Set(ids)];
}
