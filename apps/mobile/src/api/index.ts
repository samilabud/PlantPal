import { HealthResponse } from '@plantpal/shared';

import { env } from '@/config/env';

import { createApiClient } from './client';

export { ApiError } from './client';

export const api = createApiClient({ baseUrl: env.apiUrl });

export const getHealth = () => api.request('/api/health', { schema: HealthResponse });
