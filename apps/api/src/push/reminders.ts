import { eq, inArray, sql } from 'drizzle-orm';

import type { Db } from '@/db';
import { devices } from '@/db/schema';

import type { PushMessage } from './expo-push';

/**
 * The server-side safety net. Precise "water today" reminders are local notifications that the
 * phone schedules itself (they work offline). Once a day (Vercel Hobby crons run daily), the
 * server sends a digest for plants that are clearly overdue: due at least 12 hours ago. That
 * catches cases the phone can't: reminders turned off by the OS, a reinstall, or a plant edited
 * on another device.
 */
export async function findOverduePlants(db: Db, now = new Date()) {
  const rows = await db.execute<{ user_id: string; id: string; name: string }>(sql`
    SELECT p.user_id, p.id, p.name
    FROM plants p
    LEFT JOIN LATERAL (
      SELECT MAX(w.watered_at) AS last FROM watering_events w
      WHERE w.plant_id = p.id AND w.deleted_at IS NULL
    ) w ON true
    WHERE p.deleted_at IS NULL
      AND COALESCE(w.last, p.created_at)
          + make_interval(days => p.watering_interval_days)
          + interval '12 hours' <= ${now.toISOString()}::timestamptz
    ORDER BY p.user_id, p.name
  `);
  return [...rows];
}

export function digestFor(plants: { id: string; name: string }[]): Omit<PushMessage, 'to'> {
  const base = { sound: 'default' as const, channelId: 'reminders' as const };
  if (plants.length === 1) {
    const [plant] = plants;
    return {
      ...base,
      title: `🪴 ${plant!.name} needs water`,
      body: "It's past its watering day. Tap to open it.",
      data: { url: `/plants/${plant!.id}` },
    };
  }
  const names = plants
    .slice(0, 3)
    .map((p) => p.name)
    .join(', ');
  const more = plants.length > 3 ? ` and ${plants.length - 3} more` : '';
  return {
    ...base,
    title: `🪴 ${plants.length} plants need water`,
    body: `${names}${more}`,
    data: { url: '/' },
  };
}

/** One digest per device of every user who has overdue plants. */
export async function buildReminderMessages(db: Db, now = new Date()): Promise<PushMessage[]> {
  const overdue = await findOverduePlants(db, now);
  const byUser = new Map<string, { id: string; name: string }[]>();
  for (const row of overdue) {
    byUser.set(row.user_id, [...(byUser.get(row.user_id) ?? []), { id: row.id, name: row.name }]);
  }
  if (!byUser.size) return [];

  const userDevices = await db
    .select({ userId: devices.userId, token: devices.expoPushToken })
    .from(devices)
    .where(inArray(devices.userId, [...byUser.keys()]));

  return userDevices.map((d) => ({ to: d.token, ...digestFor(byUser.get(d.userId)!) }));
}

export async function devicesOf(db: Db, userId: string) {
  return db
    .select({ token: devices.expoPushToken })
    .from(devices)
    .where(eq(devices.userId, userId));
}
