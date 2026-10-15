import { DevSignInRequest } from '@plantpal/shared';

import { authConfig } from '@/auth/config';
import { createSession, findOrCreateUser } from '@/auth/session';
import { db } from '@/db';
import { HttpError } from '@/lib/errors';
import { json, parseBody, withErrors } from '@/lib/http';

/**
 * POST /api/auth/dev: test-only sign-in for Maestro and local development, because E2E tools
 * can't drive the real Apple/Google sheets. Off unless ALLOW_DEV_AUTH=true, and always off on
 * Vercel production. Answers 404 when off, so it doesn't advertise itself.
 */
export const POST = withErrors(async (request) => {
  if (!authConfig().devAuthEnabled) throw new HttpError(404, 'not_found', 'Not found');
  const body = await parseBody(request, DevSignInRequest);
  const userId = await findOrCreateUser(db(), {
    provider: 'dev',
    subject: body.name,
    email: `${body.name}@dev.plantpal.test`,
  });
  return json(await createSession(db(), userId));
});
