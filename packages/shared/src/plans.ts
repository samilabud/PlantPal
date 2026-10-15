import { z } from 'zod';

/** The RevenueCat entitlement that unlocks Premium. */
export const PREMIUM_ENTITLEMENT = 'premium';

/** Free plan: a few plants, one photo each. Premium: unlimited plants + photo history. */
export const FREE_PLANT_LIMIT = 3;
export const FREE_PHOTOS_PER_PLANT = 1;

export const Plan = z.enum(['free', 'premium']);
export type Plan = z.infer<typeof Plan>;
