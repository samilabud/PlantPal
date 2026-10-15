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
export const usePremiumStore = create<{
  devicePremium: boolean | null;
  managementUrl: string | null;
}>()(() => ({
  devicePremium: null,
  managementUrl: null,
}));

const onCustomerInfo = (info: CustomerInfo) =>
  usePremiumStore.setState({
    devicePremium: Boolean(info.entitlements.active[PREMIUM_ENTITLEMENT]),
    managementUrl: info.managementURL,
  });

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
  usePremiumStore.setState({ devicePremium: null, managementUrl: null });
}

export async function getPackages(): Promise<PurchasesPackage[]> {
  const offerings = await Purchases.getOfferings();
  return offerings.current?.availablePackages ?? [];
}

/** After any purchase/restore, the server re-checks RevenueCat itself and returns the profile. */
async function confirmWithServer() {
  const me = await syncSubscription();
  useAuthStore.getState().setUser(me);
  return me;
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

export async function restore() {
  onCustomerInfo(await Purchases.restorePurchases());
  return confirmWithServer();
}
