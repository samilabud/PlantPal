import { t } from '@/i18n';

const DAY_MS = 24 * 60 * 60 * 1000;

export type WateringStatus =
  | { state: 'never'; dueAt: null }
  | { state: 'ok' | 'today' | 'overdue'; dueAt: Date; days: number };

/**
 * When is the next watering due? Pure function, so it is easy to test.
 * "today" covers everything due before the end of the current local day.
 */
export function wateringStatus(
  lastWateredAt: string | null,
  intervalDays: number,
  now: Date = new Date(),
): WateringStatus {
  if (!lastWateredAt) return { state: 'never', dueAt: null };
  const dueAt = new Date(new Date(lastWateredAt).getTime() + intervalDays * DAY_MS);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  if (dueAt.getTime() < now.getTime() - DAY_MS) {
    return {
      state: 'overdue',
      dueAt,
      days: Math.floor((now.getTime() - dueAt.getTime()) / DAY_MS),
    };
  }
  if (dueAt.getTime() <= endOfToday.getTime()) return { state: 'today', dueAt, days: 0 };
  return { state: 'ok', dueAt, days: Math.ceil((dueAt.getTime() - now.getTime()) / DAY_MS) };
}

export function describeStatus(status: WateringStatus): string {
  switch (status.state) {
    case 'never':
      return t('status.never');
    case 'today':
      return t('status.today');
    case 'overdue':
      return t('status.overdue', { count: status.days });
    case 'ok':
      return status.days === 1 ? t('status.tomorrow') : t('status.inDays', { count: status.days });
  }
}
