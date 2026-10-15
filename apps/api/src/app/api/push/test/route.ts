import { TestPushRequest, type PushSendResult } from '@plantpal/shared';

import { authConfig } from '@/auth/config';
import { requireUserId } from '@/auth/require-user';
import { db } from '@/db';
import { HttpError } from '@/lib/errors';
import { json, parseBody, withErrors } from '@/lib/http';
import { sendPushes } from '@/push/expo-push';
import { devicesOf } from '@/push/reminders';

/**
 * POST /api/push/test: the "manual trigger". Sends a push to the caller's own devices, deep
 * linking to a plant. Same switch as the dev sign-in: never available on Vercel production.
 */
export const POST = withErrors(async (request) => {
  if (!authConfig().devAuthEnabled) throw new HttpError(404, 'not_found', 'Not found');
  const userId = await requireUserId(request);
  const body = await parseBody(request, TestPushRequest);
  const targets = await devicesOf(db(), userId);
  const result = await sendPushes(
    db(),
    targets.map((d) => ({
      to: d.token,
      title: '🪴 Test reminder',
      body: body.plantId ? 'Tap to open your plant.' : 'Push notifications work.',
      data: { url: body.plantId ? `/plants/${body.plantId}` : '/' },
      sound: 'default' as const,
      channelId: 'reminders' as const,
    })),
  );
  const response: PushSendResult = { devices: targets.length, ...result };
  return json(response);
});
