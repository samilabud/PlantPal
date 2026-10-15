import type { NotificationData } from '@plantpal/shared';
import { and, inArray, lt } from 'drizzle-orm';

import type { Db } from '@/db';
import { devices, pushTickets } from '@/db/schema';

const SEND_URL = 'https://exp.host/--/api/v2/push/send';
const RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';
const SEND_BATCH = 100; // Expo's limit per request
const RECEIPT_BATCH = 1000;

export type PushMessage = {
  to: string;
  title: string;
  body: string;
  data: NotificationData;
  sound: 'default';
  channelId: 'reminders';
};

type Ticket =
  { status: 'ok'; id: string } | { status: 'error'; message: string; details?: { error?: string } };

type Fetch = typeof fetch;

function headers() {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    // Optional "enhanced security": with it on in the Expo dashboard, a leaked push token
    // alone can't be used to send notifications to our users.
    ...(process.env.EXPO_ACCESS_TOKEN && {
      Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}`,
    }),
  };
}

const chunk = <T>(items: T[], size: number) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
    items.slice(i * size, (i + 1) * size),
  );

/**
 * Sends through Expo, which forwards to FCM (Android) or APNs (iOS).
 * "ok" tickets only mean Expo accepted the message; we keep their ids to check receipts later.
 * A token that is already known to be dead (DeviceNotRegistered) is deleted right away.
 */
export async function sendPushes(db: Db, messages: PushMessage[], fetchFn: Fetch = fetch) {
  const result = { accepted: 0, failed: 0, removedTokens: 0 };
  for (const batch of chunk(messages, SEND_BATCH)) {
    const res = await fetchFn(SEND_URL, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(batch),
    });
    if (!res.ok) {
      result.failed += batch.length;
      console.error('Expo push send failed', res.status, await res.text().catch(() => ''));
      continue;
    }
    const { data: tickets } = (await res.json()) as { data: Ticket[] };

    const okTickets: { id: string; expoPushToken: string }[] = [];
    const deadTokens: string[] = [];
    tickets.forEach((ticket, i) => {
      const to = batch[i]!.to;
      if (ticket.status === 'ok') okTickets.push({ id: ticket.id, expoPushToken: to });
      else if (ticket.details?.error === 'DeviceNotRegistered') deadTokens.push(to);
    });

    result.accepted += okTickets.length;
    result.failed += tickets.length - okTickets.length;
    if (okTickets.length) await db.insert(pushTickets).values(okTickets).onConflictDoNothing();
    if (deadTokens.length) {
      const removed = await db
        .delete(devices)
        .where(inArray(devices.expoPushToken, deadTokens))
        .returning({ id: devices.id });
      result.removedTokens += removed.length;
    }
  }
  return result;
}

/**
 * Reads receipts for tickets older than 15 minutes (Expo's advice) and forgets tokens whose
 * device is no longer registered (app uninstalled, notifications reset). Tickets are deleted
 * once checked, and after 24 h anyway (Expo drops receipts then).
 */
export async function processReceipts(db: Db, fetchFn: Fetch = fetch, now = new Date()) {
  const cutoff = new Date(now.getTime() - 15 * 60_000);
  const tickets = await db
    .select()
    .from(pushTickets)
    .where(lt(pushTickets.createdAt, cutoff))
    .limit(5000);
  let removedTokens = 0;

  for (const batch of chunk(tickets, RECEIPT_BATCH)) {
    const res = await fetchFn(RECEIPTS_URL, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ ids: batch.map((t) => t.id) }),
    });
    if (!res.ok) continue; // keep the tickets; next run retries
    const { data } = (await res.json()) as {
      data: Record<string, { status: 'ok' } | { status: 'error'; details?: { error?: string } }>;
    };

    const dead = batch
      .filter((t) => {
        const receipt = data[t.id];
        return receipt?.status === 'error' && receipt.details?.error === 'DeviceNotRegistered';
      })
      .map((t) => t.expoPushToken);
    if (dead.length) {
      const removed = await db
        .delete(devices)
        .where(inArray(devices.expoPushToken, dead))
        .returning({ id: devices.id });
      removedTokens += removed.length;
    }
    await db.delete(pushTickets).where(
      inArray(
        pushTickets.id,
        batch.map((t) => t.id),
      ),
    );
  }

  const dayAgo = new Date(now.getTime() - 24 * 60 * 60_000);
  await db.delete(pushTickets).where(and(lt(pushTickets.createdAt, dayAgo)));
  return { checked: tickets.length, removedTokens };
}
