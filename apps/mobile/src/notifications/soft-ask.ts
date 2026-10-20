import { Alert } from 'react-native';

import { getDb } from '@/db/database';
import { t } from '@/i18n';

import { getPermissionState, requestPermission, syncLocalReminders } from './notifications';
import { registerForPush } from './push-registration';

/**
 * Ask in context, once: right after the first plant is added, explain why, and only then show
 * the system prompt. A "Not now" here costs nothing; a "Don't allow" on the system prompt is
 * often permanent, so it's worth not wasting it.
 */
export async function softAskForReminders(plantName: string) {
  if ((await getPermissionState()) !== 'undetermined') return;
  const db = await getDb();
  const asked = await db.getFirstAsync(
    "SELECT value FROM sync_state WHERE key = 'askedReminders'",
    [],
  );
  if (asked) return;
  await db.runAsync(
    "INSERT OR REPLACE INTO sync_state (key, value) VALUES ('askedReminders', '1')",
    [],
  );

  Alert.alert(t('reminders.softAskTitle'), t('reminders.softAskBody', { name: plantName }), [
    { text: t('common.notNow'), style: 'cancel' },
    {
      text: t('reminders.remindMe'),
      onPress: async () => {
        if ((await requestPermission()) === 'granted') {
          await syncLocalReminders(db);
          await registerForPush();
        }
      },
    },
  ]);
}
