import {
  HealthResponse,
  Me,
  SignedUrlResponse,
  SyncResponse,
  type SyncRequest,
} from '@plantpal/shared';
import { File } from 'expo-file-system';
import { fetch as expoFetch } from 'expo/fetch';

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

export const postSync = (body: SyncRequest) =>
  api.request('/api/sync', { method: 'POST', body, schema: SyncResponse, timeoutMs: 30_000 });

export const getPhotoUploadUrl = async (photoId: string, size: number) =>
  (
    await api.request('/api/photos/upload-url', {
      method: 'POST',
      body: { photoId, contentType: 'image/jpeg', size },
      schema: SignedUrlResponse,
    })
  ).url;

export const getPhotoViewUrl = (photoId: string) =>
  api.request(`/api/photos/${photoId}/url`, { schema: SignedUrlResponse });

/** Upload straight to Blob storage with the signed URL: the file never passes through our API. */
export async function putPhotoFile(url: string, uri: string) {
  const response = await expoFetch(url, {
    method: 'PUT',
    headers: { 'content-type': 'image/jpeg' },
    body: new File(uri),
  });
  if (!response.ok) throw new Error(`Photo upload failed (${response.status})`);
}
