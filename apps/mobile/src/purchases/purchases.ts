import { PREMIUM_ENTITLEMENT } from '@plantpal/shared';
import Purchases, {
  LOG_LEVEL,
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
  type PurchasesPackage,
} from 'react-native-purchases';
import { create } from 'zustand';

import { syncSubscription } from '@/api';
import { useAuthStore } from '@/auth/auth-store';
import { env } from '@/config/env';

/**
 * Which RevenueCat key this build uses. RevenueCat SDK keys are public (they ship inside the app).
 * - Development builds: the Test Store key, which allows real purchase flows with no App Store
 *   or Google Play setup. RevenueCat deliberately crashes release builds that use it, so it's
 *   only ever read when __DEV__ is true.
 * - Preview/production builds (M7): the per-store keys, purchases run in the stores' sandbox.
 */
function apiKey(): string | null {
  if (__DEV__ && process.env.EXPO_PUBLIC_REVENUECAT_TEST_KEY)
    return process.env.EXPO_PUBLIC_REVENUECAT_TEST_KEY;
  if (env.appVariant === 'development') return null;
  return null; // store keys are added with the store setup in M7
}

export const isPurchasesAvailable = () => apiKey() !== null;

/** What the device's RevenueCat SDK says, updated live (instant after a purchase). */
// The expiry is kept too: CustomerInfo can be a cached copy, and "active" in a cached copy says
// nothing about whether the subscription has ended since (see isPremium).
export const usePremiumStore = create<{
  devicePremium: boolean | null;
  deviceExpiresAt: number | null;
  managementUrl: string | null;
}>()(() => ({ devicePremium: null, deviceExpiresAt: null, managementUrl: null }));

const onCustomerInfo = (info: CustomerInfo) => {
  const ent = info.entitlements.active[PREMIUM_ENTITLEMENT];
  usePremiumStore.setState({
    devicePremium: Boolean(ent),
    deviceExpiresAt: ent?.expirationDate ? Date.parse(ent.expirationDate) : null,
    managementUrl: info.managementURL,
  });
};

let configuredFor: string | null = null;

/**
 * Identify the RevenueCat customer with OUR user id, so webhooks carry an id the server knows
 * (no anonymous ids, no account-matching guesswork).
 */
export async function startPurchases(userId: string) {
  const key = apiKey();
  if (!key || configuredFor === userId) return;
  if (configuredFor === null) {
    if (__DEV__) await Purchases.setLogLevel(LOG_LEVEL.WARN);
    Purchases.configure({ apiKey: key, appUserID: userId });
    Purchases.addCustomerInfoUpdateListener(onCustomerInfo);
  } else {
    await Purchases.logIn(userId);
  }
  configuredFor = userId;
  onCustomerInfo(await Purchases.getCustomerInfo());
}

export async function stopPurchases() {
  if (!configuredFor) return;
  await Purchases.logOut().catch(() => undefined); // throws if already anonymous: nothing to undo
  configuredFor = null;
  usePremiumStore.setState({ devicePremium: null, deviceExpiresAt: null, managementUrl: null });
}

export async function getPackages(): Promise<PurchasesPackage[]> {
  const offerings = await Purchases.getOfferings();
  return offerings.current?.availablePackages ?? [];
}

/**
 * After any purchase/restore, the server re-checks RevenueCat itself and returns the profile.
 * If that call fails (offline for a moment, server hiccup) the purchase still happened: the
 * device already shows Premium, and the server catches up via the webhook or the next /me.
 * So a failure here is never reported as "purchase failed".
 */
async function confirmWithServer() {
  try {
    const me = await syncSubscription();
    useAuthStore.getState().setUser(me);
    return me;
  } catch {
    return null;
  }
}

/** Returns false when the user cancels; throws on real errors. */
export async function buy(pkg: PurchasesPackage): Promise<boolean> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    onCustomerInfo(customerInfo);
  } catch (e) {
    if ((e as { code?: string }).code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR)
      return false;
    throw e;
  }
  await confirmWithServer();
  return true;
}

/** Returns whether Premium is active after restoring (server answer, else the device's). */
export async function restore(): Promise<boolean> {
  const info = await Purchases.restorePurchases();
  onCustomerInfo(info);
  const me = await confirmWithServer();
  return me ? me.plan === 'premium' : Boolean(info.entitlements.active[PREMIUM_ENTITLEMENT]);
}
