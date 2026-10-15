/** RevenueCat settings. All optional at boot; the webhook refuses to run without a check. */
export function billingConfig(env: Record<string, string | undefined> = process.env) {
  return {
    /** Secret API key (server only) for GET /v1/subscribers. */
    secretKey: env.REVENUECAT_SECRET_KEY || null,
    /** The exact Authorization header value set on the webhook in the RevenueCat dashboard. */
    webhookAuth: env.REVENUECAT_WEBHOOK_AUTH || null,
    /** HMAC signing secret shown once when enabling webhook signing. */
    webhookSigningSecret: env.REVENUECAT_WEBHOOK_SECRET || null,
  };
}
export type BillingConfig = ReturnType<typeof billingConfig>;
