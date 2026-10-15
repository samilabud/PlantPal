import { LogoutRequest, type OkResponse } from '@plantpal/shared';

import { revokeRefreshTokenFamily } from '@/auth/refresh-tokens';
import { db } from '@/db';
import { json, parseBody, withErrors } from '@/lib/http';

/**
 * POST /api/auth/logout: revoke this device's refresh token family.
 * Always answers ok, so logout works even with an already-dead token.
 * The access token simply expires within 15 minutes.
 */
export const POST = withErrors(async (request) => {
  const body = await parseBody(request, LogoutRequest);
  await revokeRefreshTokenFamily(db(), body.refreshToken);
  const response: OkResponse = { ok: true };
  return json(response);
});
