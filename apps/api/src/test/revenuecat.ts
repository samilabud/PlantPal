import { createHmac, randomUUID } from 'node:crypto';

/** Builds a webhook request exactly like RevenueCat: JSON body, auth header, HMAC signature. */
export function signedWebhook(
  event: Record<string, unknown>,
  opts: { secret?: string; auth?: string; t?: number; tamper?: boolean } = {},
) {
  const body = JSON.stringify({
    api_version: '1.0',
    event: { id: randomUUID(), environment: 'SANDBOX', ...event },
  });
  const t = opts.t ?? Math.floor(Date.now() / 1000);
  const secret = opts.secret ?? process.env.REVENUECAT_WEBHOOK_SECRET!;
  const v1 = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
  return new Request('http://test/api/webhooks/revenuecat', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: opts.auth ?? process.env.REVENUECAT_WEBHOOK_AUTH!,
      'x-revenuecat-webhook-signature': `t=${t},v1=${v1}`,
    },
    body: opts.tamper ? body.replace('SANDBOX', 'PRODUCTION') : body,
  });
}

/** A fake GET /v1/subscribers response. */
export const subscriber = (expires: string | null | undefined) =>
  new Response(
    JSON.stringify({
      subscriber: {
        entitlements:
          expires === undefined
            ? {}
            : {
                premium: { expires_date: expires, product_identifier: 'plantpal_premium_monthly' },
              },
      },
    }),
    { status: 200 },
  );
