import { FREE_PLANT_LIMIT, FREE_PHOTOS_PER_PLANT, type Plan } from '@plantpal/shared';

/**
 * The server's view of the plan. The stored plan can lag (a missed expiration webhook), so an
 * expiry date in the past always means free. That way the server never over-grants.
 */
export function effectivePlan(
  user: { plan: Plan; planExpiresAt: Date | null },
  now = new Date(),
): Plan {
  if (user.plan !== 'premium') return 'free';
  return !user.planExpiresAt || user.planExpiresAt > now ? 'premium' : 'free';
}

export const limitsFor = (plan: Plan) =>
  plan === 'premium'
    ? { plants: Infinity, photosPerPlant: Infinity }
    : { plants: FREE_PLANT_LIMIT, photosPerPlant: FREE_PHOTOS_PER_PLANT };
