import { SyncRequest } from '@plantpal/shared';

import { requireUserId } from '@/auth/require-user';
import { db } from '@/db';
import { json, parseBody, withErrors } from '@/lib/http';
import { runSync } from '@/sync/sync-service';

/** POST /api/sync: push this device's outbox, pull everything changed since its cursor. */
export const POST = withErrors(async (request) => {
  const userId = await requireUserId(request);
  const body = await parseBody(request, SyncRequest);
  return json(await runSync(db(), userId, body));
});
