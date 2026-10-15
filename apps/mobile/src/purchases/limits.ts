import { FREE_PHOTOS_PER_PLANT, FREE_PLANT_LIMIT, type Me } from '@plantpal/shared';

import { useAuthStore } from '@/auth/auth-store';

import { usePremiumStore } from './purchases';

/**
 * Premium if the server says so OR the device just bought it (the server catches up within a
 * second via /api/subscription/sync). The server enforces limits anyway, so trusting the
 * device here only affects what the UI offers, never what's allowed.
 */
export function isPremium(user: Me | null, devicePremium: boolean | null) {
  return user?.plan === 'premium' || devicePremium === true;
}

export function usePremium() {
  const user = useAuthStore((s) => s.user);
  const devicePremium = usePremiumStore((s) => s.devicePremium);
  return isPremium(user, devicePremium);
}

export const canAddPlant = (premium: boolean, plantCount: number) =>
  premium || plantCount < FREE_PLANT_LIMIT;
export const canAddPhoto = (premium: boolean, photoCount: number) =>
  premium || photoCount < FREE_PHOTOS_PER_PLANT;
