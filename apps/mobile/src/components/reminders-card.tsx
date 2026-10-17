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
import { Button, radius, spacing, Text, useColors } from '@/ui';

const LABEL: Record<PermissionState, string> = {
  granted: 'On',
  undetermined: 'Off',
  denied: 'Off',
  blocked: 'Blocked in system settings',
};

export function RemindersCard() {
  const colors = useColors();
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
    Alert.alert(
      'Test reminder',
      'Lock the phone or leave the app: it arrives in about 10 seconds.',
    );
  }

  async function testPush() {
    const [first] = await listPlants(await getDb());
    try {
      const r = await sendTestPush(first?.id);
      Alert.alert(
        'Test push',
        `Sent to ${r.devices} device(s): ${r.accepted} accepted, ${r.failed} failed.`,
      );
    } catch (e) {
      Alert.alert('Test push', e instanceof Error ? e.message : 'Failed');
    }
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <Text variant="heading">Reminders</Text>
      <Text testID="reminders-status">
        Watering reminders: {permission ? LABEL[permission] : '…'}
      </Text>
      <Text muted variant="caption">
        A reminder on the morning a plant needs water, plus a daily nudge if one is overdue. No
        marketing, ever.
      </Text>
      {permission === 'granted' && (
        <Text muted variant="caption" testID="push-status">
          Server push: {push.status}
          {push.error ? ` (${push.error})` : ''}
        </Text>
      )}
      {(permission === 'undetermined' || permission === 'denied') && (
        <Button testID="enable-reminders" label="Turn on reminders" onPress={turnOn} />
      )}
      {permission === 'blocked' && (
        <Button label="Open system settings" variant="secondary" onPress={openSystemSettings} />
      )}
      {permission === 'granted' && isDevSignInEnabled && (
        <View style={styles.row}>
          <Button
            label="Test reminder"
            variant="secondary"
            style={styles.flex}
            onPress={testLocal}
          />
          <Button label="Test push" variant="secondary" style={styles.flex} onPress={testPush} />
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
