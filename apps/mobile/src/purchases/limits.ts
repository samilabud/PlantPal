import { FREE_PHOTOS_PER_PLANT, FREE_PLANT_LIMIT, type Me } from '@plantpal/shared';

import { useAuthStore } from '@/auth/auth-store';

import { usePremiumStore } from './purchases';

type DeviceEntitlement = { active: boolean | null; expiresAt: number | null };

const stillValid = (expiresAt: number | null, now: number) => expiresAt === null || expiresAt > now;

/**
 * Premium if the server says so OR the device just bought it (the server catches up within a
 * second via /api/subscription/sync). Both are often *cached* copies (the profile in secure
 * storage, RevenueCat's cached CustomerInfo), so each only counts until its own expiry date:
 * a subscription that ended an hour ago must not keep unlocking the UI. The server enforces
 * the limits anyway; this only decides what the app offers.
 */
export function isPremium(user: Me | null, device: DeviceEntitlement, now = Date.now()) {
  const server =
    user?.plan === 'premium' &&
    stillValid(user.planExpiresAt ? Date.parse(user.planExpiresAt) : null, now);
  const onDevice = device.active === true && stillValid(device.expiresAt, now);
  return server || onDevice;
}

export function usePremium() {
  const user = useAuthStore((s) => s.user);
  const active = usePremiumStore((s) => s.devicePremium);
  const expiresAt = usePremiumStore((s) => s.deviceExpiresAt);
  return isPremium(user, { active, expiresAt });
}

export const canAddPlant = (premium: boolean, plantCount: number) =>
  premium || plantCount < FREE_PLANT_LIMIT;
export const canAddPhoto = (premium: boolean, photoCount: number) =>
  premium || photoCount < FREE_PHOTOS_PER_PLANT;
