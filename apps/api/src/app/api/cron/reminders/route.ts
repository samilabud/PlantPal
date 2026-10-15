import { timingSafeEqual } from 'node:crypto';

import { db } from '@/db';
import { HttpError } from '@/lib/errors';
import { json, withErrors } from '@/lib/http';
import { processReceipts, sendPushes } from '@/push/expo-push';
import { buildReminderMessages } from '@/push/reminders';

/** Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. Compared in constant time. */
function assertCron(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;
  const valid =
    Boolean(secret) &&
    given.length === expected.length &&
    timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!valid) throw new HttpError(401, 'unauthorized', 'Unauthorized');
}

/**
 * GET /api/cron/reminders (daily, see vercel.json).
 * Idempotent enough for a best-effort cron: a duplicate run sends a duplicate digest, a missed
 * run is caught up the next day because "overdue" is computed fresh each time.
 */
export const GET = withErrors(async (request) => {
  assertCron(request);
  const receipts = await processReceipts(db());
  const messages = await buildReminderMessages(db());
  const sent = await sendPushes(db(), messages);
  return json({ receipts, devices: messages.length, ...sent });
});
