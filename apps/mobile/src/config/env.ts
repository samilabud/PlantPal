import Constants from 'expo-constants';
import { z } from 'zod';

import { resolveApiUrl } from './resolve-api-url';

const EnvSchema = z.object({
  apiUrl: z.url(),
  appVariant: z.enum(['development', 'preview', 'production']),
});
export type Env = z.infer<typeof EnvSchema>;

/** Validated once at startup: a wrong value fails loudly here, not deep inside a request. */
export const env: Env = EnvSchema.parse({
  // Must be a static `process.env.EXPO_PUBLIC_*` reference so Expo can inline it.
  apiUrl: resolveApiUrl({
    explicitUrl: process.env.EXPO_PUBLIC_API_URL,
    hostUri: Constants.expoConfig?.hostUri,
    isDev: __DEV__,
  }),
  appVariant: Constants.expoConfig?.extra?.appVariant ?? 'production',
});
