import { RefreshRequest, type RefreshResponse } from '@plantpal/shared';

import { signAccessToken } from '@/auth/access-token';
import { authConfig } from '@/auth/config';
import { rotateRefreshToken } from '@/auth/refresh-tokens';
import { db } from '@/db';
import { json, parseBody, withErrors } from '@/lib/http';

/** POST /api/auth/refresh: swap a refresh token for a new pair (rotation). */
export const POST = withErrors(async (request) => {
  const body = await parseBody(request, RefreshRequest);
  const { userId, refreshToken } = await rotateRefreshToken(db(), body.refreshToken);
  const access = await signAccessToken(userId, authConfig().jwtSecret);
  const response: RefreshResponse = {
    tokens: {
      accessToken: access.token,
      refreshToken,
      accessTokenExpiresAt: access.expiresAt.toISOString(),
    },
  };
  return json(response);
});
