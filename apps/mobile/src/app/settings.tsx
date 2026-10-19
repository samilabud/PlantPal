import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, StyleSheet, Switch, View } from 'react-native';

import { toUserMessage } from '@/errors/user-message';
import { useAnalyticsConsent } from '@/analytics/analytics';
import { getHealth } from '@/api';
import { deleteAccount, signOut, useAuthStore } from '@/auth';
import { PlanCard } from '@/components/plan-card';
import { RemindersCard } from '@/components/reminders-card';
import { env } from '@/config/env';
import { PRIVACY_URL, SUPPORT_URL } from '@/config/site';
import { requestSync, useSyncStore } from '@/sync/sync-manager';
import { describeUpdate } from '@/updates/describe-update';
import { Button, radius, Screen, spacing, Text, useColors } from '@/ui';

export default function SettingsScreen() {
  const colors = useColors();
  const user = useAuthStore((s) => s.user);
  const [busy, setBusy] = useState<'signOut' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sync = useSyncStore();
  const health = useQuery({ queryKey: ['health'], queryFn: getHealth });
  const analytics = useAnalyticsConsent();

  async function doSignOut() {
    setBusy('signOut');
    await signOut();
  }

  /** Sign-out wipes this phone's copy, so warn if some changes haven't reached the server. */
  function onSignOut() {
    if (!sync.pending) return void doSignOut();
    Alert.alert(
      'Unsynced changes',
      `${sync.pending} change(s) haven't reached the server yet. If you sign out now they will be lost.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out anyway', style: 'destructive', onPress: doSignOut },
      ],
    );
  }

  function onDelete() {
    Alert.alert(
      'Delete account?',
      'This permanently deletes your account and all your plants on every device. It cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusy('delete');
            setError(null);
            try {
              await deleteAccount();
            } catch (e) {
              setError(toUserMessage(e, 'deleteAccount'));
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  }

  return (
    <Screen>
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <Text variant="heading">Account</Text>
        <Text testID="account-email">{user?.email ?? 'No email shared'}</Text>
        <Text muted>Signed in with: {user?.providers.join(', ')}</Text>
        <Text muted>Plan: {user?.plan}</Text>
      </View>

      <Button
        testID="open-guide"
        label="How PlantPal works"
        variant="secondary"
        onPress={() => router.push('/guide')}
      />

      <PlanCard />

      <RemindersCard />

      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <Text variant="heading">Sync</Text>
        <Text testID="sync-status">
          Status: {sync.status} · {sync.pending} pending
        </Text>
        <Text muted>
          Last synced: {sync.lastSyncedAt ? new Date(sync.lastSyncedAt).toLocaleString() : 'never'}
        </Text>
        {sync.error && <Text style={{ color: colors.danger }}>{sync.error}</Text>}
        <Button
          label="Sync now"
          variant="secondary"
          onPress={() => requestSync({ immediate: true })}
        />
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <Text variant="heading">Usage analytics</Text>
        {analytics.available ? (
          <View style={styles.row}>
            <Text style={styles.rowText}>Share anonymous usage events</Text>
            <Switch
              testID="analytics-switch"
              accessibilityLabel="Share anonymous usage events"
              value={analytics.enabled}
              onValueChange={analytics.set}
            />
          </View>
        ) : (
          <Text testID="analytics-off">Off in this build</Text>
        )}
        <Text muted variant="caption">
          Counts such as &quot;a plant was added&quot; help improve PlantPal. Never plant names,
          photos or your email. No ads, no tracking across apps.
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <Text variant="heading">Diagnostics</Text>
        <Text muted variant="caption" selectable>
          {env.apiUrl} · {env.appVariant}
        </Text>
        <Text testID="health-status">
          {health.data
            ? `API ${health.data.status} · database ${health.data.db} · v${health.data.version}`
            : health.isError
              ? 'API unreachable'
              : 'Checking…'}
        </Text>
        <Text muted variant="caption" selectable testID="update-info">
          {describeUpdate()}
        </Text>
      </View>

      <View style={styles.links}>
        <Button
          label="Privacy policy"
          variant="secondary"
          accessibilityHint="Opens in your browser"
          onPress={() => Linking.openURL(PRIVACY_URL)}
        />
        <Button
          label="Help"
          variant="secondary"
          accessibilityHint="Opens in your browser"
          onPress={() => Linking.openURL(SUPPORT_URL)}
        />
      </View>

      <Button
        testID="sign-out"
        label="Sign out"
        variant="secondary"
        loading={busy === 'signOut'}
        disabled={busy !== null}
        onPress={onSignOut}
      />
      <Button
        testID="delete-account"
        label="Delete account"
        variant="danger"
        loading={busy === 'delete'}
        disabled={busy !== null}
        onPress={onDelete}
      />
      {error && (
        <Text accessibilityRole="alert" style={{ color: colors.danger }}>
          {error}
        </Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.md, borderRadius: radius.md, gap: spacing.xs },
  links: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowText: { flex: 1 },
});
