import { statusCodes } from '@react-native-google-signin/google-signin';

import { ApiError } from '@/api/client';

export type ErrorContext = 'signIn' | 'sync' | 'purchase' | 'restore' | 'photo' | 'deleteAccount';

const FALLBACK: Record<ErrorContext, string> = {
  signIn: "Couldn't sign you in. Please try again.",
  sync: "Couldn't sync. Your changes are safe on this phone and will sync later.",
  purchase: "The purchase didn't go through. You weren't charged. Please try again.",
  restore: "Couldn't restore purchases. Please try again.",
  photo: "Couldn't add the photo. Please try again.",
  deleteAccount: "Couldn't delete your account. Nothing was deleted. Please try again.",
};

/** Google Play Services' code for a sign-in client that doesn't match this build's signing key. */
const GOOGLE_DEVELOPER_ERROR = '10';

/**
 * RevenueCat's PURCHASES_ERROR_CODE values, as strings so this file doesn't load the SDK (which
 * breaks Jest). Note "10" also means something else for Google sign-in: codes are only read
 * together with the context they came from.
 */
const RC = {
  STORE_PROBLEM: '2',
  PURCHASE_NOT_ALLOWED: '3',
  ALREADY_PURCHASED: '6',
  NETWORK: '10',
  PAYMENT_PENDING: '20',
} as const;

const codeOf = (e: unknown) =>
  typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : null;

/**
 * Turns any error into a sentence a user can act on. Library messages are written for developers
 * ("DEVELOPER_ERROR: follow troubleshooting…"); those stay in the logs, never on screen. A short
 * reference code is added for errors only support could fix, so a user can report it.
 */
export function toUserMessage(error: unknown, context: ErrorContext): string {
  if (__DEV__) console.warn(`[${context}]`, error);

  if (error instanceof ApiError) {
    if (error.kind === 'network')
      return 'No internet connection. Check your connection and try again.';
    if (error.kind === 'timeout')
      return 'PlantPal is taking too long to respond. Please try again.';
    if (error.status === 401) return 'Your session expired. Please sign in again.';
    if (error.status === 429) return 'Too many attempts. Please wait a minute and try again.';
    if (error.status && error.status >= 500)
      return `PlantPal's server had a problem. Please try again in a moment. (ref: server-${error.status})`;
    return withRef(FALLBACK[context], error.code ?? `http-${error.status ?? '?'}`);
  }

  const code = codeOf(error);
  if (code && context === 'signIn') {
    if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE)
      return 'Google Play services is missing or out of date on this phone. Update it from the Play Store and try again.';
    if (code === GOOGLE_DEVELOPER_ERROR)
      return withRef(
        "Google sign-in isn't working in this version of PlantPal. Please update the app, or try again later.",
        'google-10',
      );
    return withRef(FALLBACK[context], `google-${code}`);
  }
  if (code && (context === 'purchase' || context === 'restore')) {
    if (code === RC.NETWORK) return 'No internet connection. Check your connection and try again.';
    if (code === RC.PURCHASE_NOT_ALLOWED)
      return 'Purchases are not allowed on this device or account.';
    if (code === RC.PAYMENT_PENDING)
      return 'Your payment is pending. Premium unlocks as soon as Google Play confirms it.';
    if (code === RC.ALREADY_PURCHASED)
      return 'You already own this. Tap "Restore purchases" to unlock it on this phone.';
    if (code === RC.STORE_PROBLEM)
      return "Google Play had a problem. You weren't charged. Please try again later.";
    return withRef(FALLBACK[context], `store-${code}`);
  }

  return FALLBACK[context];
}

const withRef = (message: string, ref: string) => `${message} (ref: ${ref})`;
