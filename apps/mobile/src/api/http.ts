import { env } from '@/config/env';

import { createApiClient } from './client';

/** Client without auth hooks: used by the auth code itself (sign-in, refresh, logout). */
export const publicApi = createApiClient({ baseUrl: env.apiUrl });
