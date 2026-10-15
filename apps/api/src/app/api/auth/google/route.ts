import { GoogleSignInRequest } from '@plantpal/shared';

import { authConfig } from '@/auth/config';
import { verifyGoogleIdToken } from '@/auth/id-tokens';
import { createSession, findOrCreateUser } from '@/auth/session';
import { db } from '@/db';
import { json, parseBody, withErrors } from '@/lib/http';

/** POST /api/auth/google: verify Google's ID token, then start our own session. */
export const POST = withErrors(async (request) => {
  const body = await parseBody(request, GoogleSignInRequest);
  const identity = await verifyGoogleIdToken(body.idToken, {
    audiences: authConfig().googleClientIds,
  });
  const userId = await findOrCreateUser(db(), { provider: 'google', ...identity });
  return json(await createSession(db(), userId));
});
