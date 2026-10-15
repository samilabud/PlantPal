import { planReminders, MAX_SCHEDULED } from '@/notifications/plan';
import { urlFromNotification } from '@/notifications/notifications';

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT',
  IosAuthorizationStatus: { PROVISIONAL: 3 },
}));

const plant = (id: string, lastWateredAt: string | null, interval: number) => ({
  id,
  name: `Plant ${id}`,
  wateringIntervalDays: interval,
  coverPhotoId: null,
  coverLocalUri: null,
  lastWateredAt,
});

describe('planReminders', () => {
  const now = new Date('2026-10-15T12:00:00');

  it('reminds at 9:00 on the due day', () => {
    const [r] = planReminders([plant('a', '2026-10-14T18:00:00', 3)], now);
    expect(r).toMatchObject({ identifier: 'plant-a', url: '/plants/a' });
    expect(r!.date).toEqual(new Date('2026-10-17T09:00:00'));
  });

  it('an overdue plant is reminded at the next 9:00 (tomorrow, since it is past 9 today)', () => {
    const [r] = planReminders([plant('b', '2026-10-01T08:00:00', 3)], now);
    expect(r!.date).toEqual(new Date('2026-10-16T09:00:00'));
  });

  it('due later today but after 9:00 -> next morning, never in the past', () => {
    const [r] = planReminders([plant('c', '2026-10-12T15:00:00', 3)], now);
    expect(r!.date.getTime()).toBeGreaterThan(now.getTime());
  });

  it('skips never-watered plants, sorts soonest first, caps for the iOS limit', () => {
    const many = Array.from({ length: 80 }, (_, i) =>
      plant(`p${i}`, `2026-10-${String((i % 9) + 10).padStart(2, '0')}T08:00:00`, 7),
    );
    const result = planReminders([plant('never', null, 3), ...many], now);
    expect(result).toHaveLength(MAX_SCHEDULED);
    expect(result.some((r) => r.identifier === 'plant-never')).toBe(false);
    const times = result.map((r) => r.date.getTime());
    expect(times).toEqual([...times].sort((x, y) => x - y));
  });
});

describe('urlFromNotification', () => {
  const response = (
    data: unknown,
    actionIdentifier = 'expo.modules.notifications.actions.DEFAULT',
  ) => ({ actionIdentifier, notification: { request: { content: { data } } } }) as never;

  it('returns the in-app path from a tap', () => {
    expect(urlFromNotification(response({ url: '/plants/123' }))).toBe('/plants/123');
  });
  it('ignores missing, external or malformed urls, and non-tap actions', () => {
    expect(urlFromNotification(null)).toBeNull();
    expect(urlFromNotification(response({ url: 'https://evil.example' }))).toBeNull();
    expect(urlFromNotification(response({}))).toBeNull();
    expect(urlFromNotification(response({ url: '/plants/1' }, 'snooze'))).toBeNull();
  });
});
