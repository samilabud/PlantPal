import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';

import { useDataVersion } from '@/data/live';
import { getDb } from '@/db/database';
import { onLanguageChange } from '@/i18n';

import { syncLocalReminders, urlFromNotification } from './notifications';
import { registerForPush } from './push-registration';

/**
 * Notification taps -> navigation. Two cases:
 * - app running (foreground or background): the response listener fires;
 * - app was closed and the tap launched it: read the last response once at start.
 * Only active while signed in, so a tap never opens a protected screen for nobody.
 */
export function useNotificationNavigation(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let handled = false;
    const open = (url: string | null) => {
      if (!url) return;
      router.push(url as never);
    };

    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (handled) return;
      open(urlFromNotification(response));
      Notifications.clearLastNotificationResponseAsync();
    });
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      handled = true;
      open(urlFromNotification(response));
    });
    return () => sub.remove();
  }, [enabled]);
}

/** Keep local reminders and push registration in step with the data, while signed in. */
export function useReminderScheduler(enabled: boolean) {
  const version = useDataVersion((s) => s.version);

  useEffect(() => {
    if (!enabled) return;
    registerForPush();
    // New language: server pushes and local reminders are rewritten in it.
    return onLanguageChange(async () => {
      registerForPush();
      syncLocalReminders(await getDb()).catch(() => undefined);
    });
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    // Debounced: a sync that applies 50 rows bumps the version once, but typing edits may not.
    const t = setTimeout(
      async () => syncLocalReminders(await getDb()).catch(() => undefined),
      1000,
    );
    return () => clearTimeout(t);
  }, [enabled, version]);
}
