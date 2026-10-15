import type { PlantListItem } from '@/data/plants';

const DAY_MS = 24 * 60 * 60 * 1000;
/** iOS keeps at most 64 pending local notifications per app; stay under it. */
export const MAX_SCHEDULED = 60;

export type PlannedReminder = {
  identifier: string;
  date: Date;
  title: string;
  body: string;
  url: string;
};

/** Next time-of-day `hour`:00 at or after `from` (local time). */
function atHour(from: Date, hour: number) {
  const d = new Date(from);
  d.setHours(hour, 0, 0, 0);
  if (d.getTime() < from.getTime()) d.setDate(d.getDate() + 1);
  return d;
}

/**
 * Pure planning: one reminder per plant, at `hour` o'clock on the day it's due. If that moment
 * already passed (overdue), the next `hour` o'clock. Plants never watered get none (they were
 * probably watered when added). Soonest first, capped for the iOS limit.
 */
export function planReminders(plants: PlantListItem[], now: Date, hour = 9): PlannedReminder[] {
  const planned: PlannedReminder[] = [];
  for (const plant of plants) {
    if (!plant.lastWateredAt) continue;
    const due = new Date(
      new Date(plant.lastWateredAt).getTime() + plant.wateringIntervalDays * DAY_MS,
    );
    const dueDayAtHour = new Date(due);
    dueDayAtHour.setHours(hour, 0, 0, 0);
    const date =
      dueDayAtHour.getTime() > now.getTime()
        ? dueDayAtHour
        : atHour(new Date(now.getTime() + 60_000), hour);
    planned.push({
      identifier: `plant-${plant.id}`,
      date,
      title: `🪴 Time to water ${plant.name}`,
      body: `${plant.name} is due today. Tap to mark it as watered.`,
      url: `/plants/${plant.id}`,
    });
  }
  return planned.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, MAX_SCHEDULED);
}
