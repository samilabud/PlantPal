import { HealthResponse, Me } from '@plantpal/shared';

import { getAccessToken, refreshAccessToken } from '@/auth/session';
import { env } from '@/config/env';

import { createApiClient } from './client';

export { ApiError } from './client';

/** The app's main client: adds the access token and refreshes on 401. */
export const api = createApiClient({
  baseUrl: env.apiUrl,
  auth: { getAccessToken, refreshAccessToken },
});

export const getHealth = () => api.request('/api/health', { schema: HealthResponse, auth: false });
export const getMe = () => api.request('/api/me', { schema: Me });
