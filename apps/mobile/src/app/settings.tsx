import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, StyleSheet, Switch, View } from 'react-native';

import { toUserMessage } from '@/errors/user-message';
import { useAnalyticsConsent } from '@/analytics/analytics';
import { getHealth } from '@/api';
import { deleteAccount, signOut, useAuthStore } from '@/auth';
import { LanguageCard } from '@/components/language-card';
import { PlanCard } from '@/components/plan-card';
import { RemindersCard } from '@/components/reminders-card';
import { env } from '@/config/env';
import { privacyUrl, supportUrl } from '@/config/site';
import { formatDateTime, useT } from '@/i18n';
import { requestSync, useSyncStore } from '@/sync/sync-manager';
import { describeUpdate } from '@/updates/describe-update';
import { Button, radius, Screen, spacing, Text, useColors } from '@/ui';

export default function SettingsScreen() {
  const colors = useColors();
  const t = useT();
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
    Alert.alert(t('settings.unsyncedTitle'), t('settings.unsyncedBody', { count: sync.pending }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('settings.signOutAnyway'), style: 'destructive', onPress: doSignOut },
    ]);
  }

  function onDelete() {
    Alert.alert(t('settings.deleteTitle'), t('settings.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
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
    ]);
  }

  return (
    <Screen>
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <Text variant="heading">{t('settings.account')}</Text>
        <Text testID="account-email">{user?.email ?? t('settings.noEmail')}</Text>
        <Text muted>{t('settings.signedInWith', { providers: user?.providers.join(', ') })}</Text>
        <Text muted>
          {t('settings.plan', {
            plan: user?.plan === 'premium' ? t('settings.planPremium') : t('settings.planFree'),
          })}
        </Text>
      </View>

      <LanguageCard />

      <Button
        testID="open-guide"
        label={t('nav.guide')}
        variant="secondary"
        onPress={() => router.push('/guide')}
      />

      <PlanCard />

      <RemindersCard />

      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <Text variant="heading">{t('settings.sync')}</Text>
        <Text testID="sync-status">
          {t('settings.syncStatus', {
            status: t(`settings.syncStates.${sync.status}`),
            pending: sync.pending,
          })}
        </Text>
        <Text muted>
          {t('settings.lastSynced', {
            when: sync.lastSyncedAt ? formatDateTime(sync.lastSyncedAt) : t('settings.never'),
          })}
        </Text>
        {sync.error && <Text style={{ color: colors.danger }}>{sync.error}</Text>}
        <Button
          label={t('settings.syncNow')}
          variant="secondary"
          onPress={() => requestSync({ immediate: true })}
        />
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <Text variant="heading">{t('settings.analytics')}</Text>
        {analytics.available ? (
          <View style={styles.row}>
            <Text style={styles.rowText}>{t('settings.analyticsSwitch')}</Text>
            <Switch
              testID="analytics-switch"
              accessibilityLabel={t('settings.analyticsSwitch')}
              value={analytics.enabled}
              onValueChange={analytics.set}
            />
          </View>
        ) : (
          <Text testID="analytics-off">{t('settings.analyticsOff')}</Text>
        )}
        <Text muted variant="caption">
          {t('settings.analyticsNote')}
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <Text variant="heading">{t('settings.diagnostics')}</Text>
        <Text muted variant="caption" selectable>
          {env.apiUrl} · {env.appVariant}
        </Text>
        <Text testID="health-status">
          {health.data
            ? t('settings.health', health.data)
            : health.isError
              ? t('settings.unreachable')
              : t('settings.checking')}
        </Text>
        <Text muted variant="caption" selectable testID="update-info">
          {describeUpdate()}
        </Text>
      </View>

      <View style={styles.links}>
        <Button
          label={t('settings.privacy')}
          variant="secondary"
          accessibilityHint={t('common.opensInBrowser')}
          onPress={() => Linking.openURL(privacyUrl())}
        />
        <Button
          label={t('settings.help')}
          variant="secondary"
          accessibilityHint={t('common.opensInBrowser')}
          onPress={() => Linking.openURL(supportUrl())}
        />
      </View>

      <Button
        testID="sign-out"
        label={t('settings.signOut')}
        variant="secondary"
        loading={busy === 'signOut'}
        disabled={busy !== null}
        onPress={onSignOut}
      />
      <Button
        testID="delete-account"
        label={t('settings.deleteAccount')}
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
