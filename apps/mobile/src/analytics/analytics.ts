import PostHog, { useFeatureFlag } from 'posthog-react-native';
import { useState } from 'react';

/**
 * Product analytics (PostHog), privacy first:
 * - Only the events below, with the properties below. Never plant names, photos or emails.
 * - No autocapture (no screen or tap tracking), no session replay, no app lifecycle events.
 * - The signed-in user is identified by our random account id only, so events can be counted per
 *   person without knowing who they are; reset on sign-out.
 * - Users can switch it off in Settings (PostHog remembers the choice on the device).
 * Without a key (local dev, tests, forks) the client is disabled and every call is a no-op.
 */
const key = process.env.EXPO_PUBLIC_POSTHOG_KEY;

export const isAnalyticsConfigured = Boolean(key) && process.env.NODE_ENV !== 'test';

export const posthog = new PostHog(key || 'phc_not_configured', {
  host: process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
  disabled: !isAnalyticsConfigured,
  captureAppLifecycleEvents: false,
  enableSessionReplay: false,
  personProfiles: 'identified_only',
});

export type PaywallVariant = 'control' | 'plants-first';

type Events = {
  plant_added: { with_photo: boolean };
  plant_watered: { from: 'list' | 'detail' };
  photo_added: { source: 'camera' | 'library' };
  reminders_enabled: Record<string, never>;
  paywall_viewed: { reason: string; variant: PaywallVariant };
  purchase_completed: { package_type: string; variant: PaywallVariant };
};

export function track<E extends keyof Events>(name: E, props: Events[E]) {
  posthog.capture(name, props);
}

/** After sign-in: our random account id only, no traits. */
export function identifyUser(userId: string) {
  posthog.identify(userId);
}

/** On sign-out and account deletion: the next person on this phone starts anonymous. */
export function resetAnalytics() {
  posthog.reset();
}

/**
 * The one feature flag: which paywall copy to show (an A/B test in PostHog). `ready` is false
 * while flags load, so the paywall view is recorded with the variant the user actually saw.
 */
export function usePaywallVariant(): { variant: PaywallVariant; ready: boolean } {
  const flag = useFeatureFlag('paywall-variant', posthog);
  return {
    variant: flag === 'plants-first' ? 'plants-first' : 'control',
    ready: flag !== undefined || !isAnalyticsConfigured,
  };
}

type ConsentClient = Pick<PostHog, 'optedOut' | 'optIn' | 'optOut'>;

/** For the Settings switch. The client is a parameter so tests can pass a fake one. */
export function useAnalyticsConsent(
  client: ConsentClient = posthog,
  available: boolean = isAnalyticsConfigured,
) {
  const [enabled, setEnabled] = useState(() => available && !client.optedOut);
  async function set(next: boolean) {
    await (next ? client.optIn() : client.optOut());
    setEnabled(next);
  }
  return { available, enabled, set };
}
