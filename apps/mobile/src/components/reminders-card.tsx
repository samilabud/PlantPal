import { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, StyleSheet, View } from 'react-native';

import { track } from '@/analytics/analytics';
import { sendTestPush } from '@/api';
import { isDevSignInEnabled } from '@/auth';
import { getDb } from '@/db/database';
import { listPlants } from '@/data/plants';
import {
  getPermissionState,
  openSystemSettings,
  requestPermission,
  scheduleTestReminder,
  syncLocalReminders,
  type PermissionState,
} from '@/notifications/notifications';
import { registerForPush, usePushStore } from '@/notifications/push-registration';
import { useT } from '@/i18n';
import { Button, radius, spacing, Text, useColors } from '@/ui';

const LABEL = {
  granted: 'reminders.on',
  undetermined: 'reminders.off',
  denied: 'reminders.off',
  blocked: 'reminders.blocked',
} as const satisfies Record<PermissionState, string>;

export function RemindersCard() {
  const colors = useColors();
  const t = useT();
  const [permission, setPermission] = useState<PermissionState | null>(null);
  const push = usePushStore();

  const refresh = useCallback(() => getPermissionState().then(setPermission), []);
  useEffect(() => {
    refresh();
    // Coming back from system settings may have changed the permission.
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => sub.remove();
  }, [refresh]);

  async function turnOn() {
    const state = await requestPermission();
    setPermission(state);
    if (state === 'granted') {
      track('reminders_enabled', {});
      await syncLocalReminders(await getDb());
      await registerForPush();
    }
  }

  async function testLocal() {
    const [first] = await listPlants(await getDb());
    await scheduleTestReminder(first ? `/plants/${first.id}` : '/');
    Alert.alert(t('reminders.test'), t('reminders.testBody'));
  }

  async function testPush() {
    const [first] = await listPlants(await getDb());
    try {
      const r = await sendTestPush(first?.id);
      Alert.alert(t('reminders.testPush'), t('reminders.testPushResult', r));
    } catch (e) {
      Alert.alert(
        t('reminders.testPush'),
        e instanceof Error ? e.message : t('reminders.testPushFailed'),
      );
    }
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <Text variant="heading">{t('reminders.title')}</Text>
      <Text testID="reminders-status">
        {t('reminders.status', { state: permission ? t(LABEL[permission]) : '…' })}
      </Text>
      <Text muted variant="caption">
        {t('reminders.about')}
      </Text>
      {permission === 'granted' && (
        <Text muted variant="caption" testID="push-status">
          {t('reminders.push', { status: push.status })}
          {push.error ? ` (${push.error})` : ''}
        </Text>
      )}
      {(permission === 'undetermined' || permission === 'denied') && (
        <Button testID="enable-reminders" label={t('reminders.turnOn')} onPress={turnOn} />
      )}
      {permission === 'blocked' && (
        <Button
          label={t('reminders.openSettings')}
          variant="secondary"
          onPress={openSystemSettings}
        />
      )}
      {permission === 'granted' && isDevSignInEnabled && (
        <View style={styles.row}>
          <Button
            label={t('reminders.test')}
            variant="secondary"
            style={styles.flex}
            onPress={testLocal}
          />
          <Button
            label={t('reminders.testPush')}
            variant="secondary"
            style={styles.flex}
            onPress={testPush}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.md, borderRadius: radius.md, gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
});
