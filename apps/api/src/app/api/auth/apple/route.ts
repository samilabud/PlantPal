import { AppleSignInRequest } from '@plantpal/shared';

import { authConfig } from '@/auth/config';
import { verifyAppleIdToken } from '@/auth/id-tokens';
import { createSession, findOrCreateUser } from '@/auth/session';
import { db } from '@/db';
import { json, parseBody, withErrors } from '@/lib/http';

/** POST /api/auth/apple: verify Apple's identity token, then start our own session. */
export const POST = withErrors(async (request) => {
  const body = await parseBody(request, AppleSignInRequest);
  const identity = await verifyAppleIdToken(body.identityToken, {
    rawNonce: body.rawNonce,
    audiences: authConfig().appleClientIds,
  });
  const userId = await findOrCreateUser(db(), {
    provider: 'apple',
    subject: identity.subject,
    // The token's email wins; the body's email only fills the first-sign-in gap.
    email: identity.email ?? body.email ?? null,
  });
  return json(await createSession(db(), userId));
});
