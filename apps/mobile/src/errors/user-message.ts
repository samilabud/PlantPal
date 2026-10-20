import { statusCodes } from '@react-native-google-signin/google-signin';

import { ApiError } from '@/api/client';
import { t } from '@/i18n';

export type ErrorContext =
  'signIn' | 'sync' | 'purchase' | 'restore' | 'photo' | 'deleteAccount' | 'identify' | 'report';

/** Read at call time, so the message is in the language the app shows right now. */
const fallback = (context: ErrorContext) => t(`errors.fallback.${context}`);

/**
 * "Identify with AI" answers with its own codes. The feature is optional, so every message ends
 * with what still works: adding the plant by hand.
 */
function identifyMessage(error: ApiError): string | null {
  switch (error.code) {
    case 'identify_limit': {
      const monthly = error.details?.period === 'month';
      const free = error.details?.plan === 'free';
      if (monthly) return t('errors.identifyMonthly');
      return free ? t('errors.identifyDailyFree') : t('errors.identifyDaily');
    }
    case 'ai_resting':
      return t('errors.aiResting');
    case 'ai_timeout':
      return t('errors.aiTimeout');
    case 'ai_not_configured':
    case 'ai_unavailable':
    case 'ai_invalid_output':
      return withRef(fallback('identify'), error.code);
    default:
      return null;
  }
}

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
    const special = context === 'identify' ? identifyMessage(error) : null;
    if (special) return special;
    if (error.kind === 'network') return t('errors.network');
    if (error.kind === 'timeout') return t('errors.timeout');
    if (error.status === 401) return t('errors.session');
    if (error.status === 429) return t('errors.rateLimited');
    if (error.status && error.status >= 500) return t('errors.server', { status: error.status });
    return withRef(fallback(context), error.code ?? `http-${error.status ?? '?'}`);
  }

  const code = codeOf(error);
  if (code && context === 'signIn') {
    if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) return t('errors.playServices');
    if (code === GOOGLE_DEVELOPER_ERROR) return withRef(t('errors.googleDeveloper'), 'google-10');
    return withRef(fallback(context), `google-${code}`);
  }
  if (code && (context === 'purchase' || context === 'restore')) {
    if (code === RC.NETWORK) return t('errors.network');
    if (code === RC.PURCHASE_NOT_ALLOWED) return t('errors.purchaseNotAllowed');
    if (code === RC.PAYMENT_PENDING) return t('errors.paymentPending');
    if (code === RC.ALREADY_PURCHASED) return t('errors.alreadyPurchased');
    if (code === RC.STORE_PROBLEM) return t('errors.storeProblem');
    return withRef(fallback(context), `store-${code}`);
  }

  return fallback(context);
}

const withRef = (message: string, ref: string) => `${message} (ref: ${ref})`;
