import { NotificationData } from '@plantpal/shared';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';

import { listPlants } from '@/data/plants';
import type { SqlDb } from '@/db/types';

import { planReminders } from './plan';

export const REMINDER_CHANNEL = 'reminders';

/** Show notifications even while the app is open (banner + list), with sound. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Android 8+ needs a channel; the user can mute it in system settings without blocking the
 * whole app. On Android 13+ the permission prompt only appears once a channel exists.
 */
export async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL, {
    name: 'Watering reminders',
    importance: Notifications.AndroidImportance.HIGH,
  });
}

export type PermissionState = 'granted' | 'undetermined' | 'denied' | 'blocked';

/** 'blocked' = denied and the OS won't show the prompt again: only Settings can fix it. */
export async function getPermissionState(): Promise<PermissionState> {
  const p = await Notifications.getPermissionsAsync();
  const granted = p.granted || p.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  if (granted) return 'granted';
  if (p.status === 'undetermined') return 'undetermined';
  return p.canAskAgain ? 'denied' : 'blocked';
}

export async function requestPermission(): Promise<PermissionState> {
  await ensureChannel();
  const state = await getPermissionState();
  if (state === 'granted' || state === 'blocked') return state;
  await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: false },
  });
  return getPermissionState();
}

export const openSystemSettings = () => Linking.openSettings();

/**
 * Rebuild all local reminders from the local database: cancel everything, schedule the plan.
 * Simple and always correct after any change (watering, edit, delete, sync from another phone).
 */
export async function syncLocalReminders(db: SqlDb, now = new Date()) {
  if ((await getPermissionState()) !== 'granted') return 0;
  await ensureChannel();
  const plan = planReminders(await listPlants(db), now);
  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const r of plan) {
    await Notifications.scheduleNotificationAsync({
      identifier: r.identifier,
      content: { title: r.title, body: r.body, data: { url: r.url }, sound: 'default' },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: r.date,
        channelId: REMINDER_CHANNEL,
      },
    });
  }
  return plan.length;
}

export const cancelAllReminders = () => Notifications.cancelAllScheduledNotificationsAsync();

/** For testing on a device: a local reminder in a few seconds, deep linking like a real one. */
export async function scheduleTestReminder(url: string, seconds = 10) {
  await ensureChannel();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🪴 Test reminder',
      body: 'Tap to open your plant.',
      data: { url },
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(Date.now() + seconds * 1000),
      channelId: REMINDER_CHANNEL,
    },
  });
}

/** The EAS project id: Expo push tokens are issued per project. */
export const easProjectId = (): string | undefined =>
  Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

/** The Expo push token for this install (Expo -> FCM on Android, APNs on iOS). */
export async function getPushToken() {
  const projectId = easProjectId();
  if (!projectId) throw new Error('EAS projectId missing in app config');
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  return data;
}

/** The in-app path a notification wants to open, if it carries a valid one. */
export function urlFromNotification(
  response: Notifications.NotificationResponse | null | undefined,
) {
  if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER)
    return null;
  const parsed = NotificationData.safeParse(response.notification.request.content.data);
  return parsed.success ? parsed.data.url : null;
}
