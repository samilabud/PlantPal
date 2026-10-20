import { RegisterDeviceRequest, UnregisterDeviceRequest, type OkResponse } from '@plantpal/shared';
import { and, eq, sql } from 'drizzle-orm';

import { requireUserId } from '@/auth/require-user';
import { db } from '@/db';
import { devices } from '@/db/schema';
import { json, parseBody, withErrors } from '@/lib/http';

const ok: OkResponse = { ok: true };

/**
 * POST /api/devices: remember this phone's push token for the signed-in user.
 * If the token was registered to someone else (the phone changed accounts), it moves to the
 * current user, so the previous account stops getting notifications on this phone.
 */
export const POST = withErrors(async (request) => {
  const userId = await requireUserId(request);
  const body = await parseBody(request, RegisterDeviceRequest);
  await db()
    .insert(devices)
    .values({
      userId,
      expoPushToken: body.expoPushToken,
      platform: body.platform,
      language: body.language ?? 'en',
    })
    .onConflictDoUpdate({
      target: devices.expoPushToken,
      set: {
        userId,
        platform: body.platform,
        // An older app that doesn't send a language keeps whatever was stored.
        ...(body.language && { language: body.language }),
        lastSeenAt: sql`now()`,
      },
    });
  return json(ok);
});

/** DELETE /api/devices: stop pushing to this phone (sign-out, or reminders turned off). */
export const DELETE = withErrors(async (request) => {
  const userId = await requireUserId(request);
  const body = await parseBody(request, UnregisterDeviceRequest);
  await db()
    .delete(devices)
    .where(and(eq(devices.expoPushToken, body.expoPushToken), eq(devices.userId, userId)));
  return json(ok);
});
