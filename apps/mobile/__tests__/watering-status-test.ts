import { describeStatus, wateringStatus } from '@/data/watering';

const now = new Date('2026-10-15T12:00:00');
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();

describe('wateringStatus', () => {
  it.each([
    [null, 7, 'Not watered yet'],
    [daysAgo(1), 7, 'Water in 6 days'],
    [daysAgo(6), 7, 'Water tomorrow'],
    [daysAgo(7), 7, 'Water today'],
    [daysAgo(9), 7, 'Overdue by 2 days'],
    [daysAgo(8.5), 7, 'Overdue by 1 day'],
  ])('last watered %s, every %i days -> %s', (last, interval, text) => {
    expect(describeStatus(wateringStatus(last, interval, now))).toBe(text);
  });
});
