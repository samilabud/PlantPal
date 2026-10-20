import { FREE_PLANT_LIMIT } from '@plantpal/shared';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { dismissLimitNotice, useSyncStore } from '@/sync/sync-manager';
import { useT } from '@/i18n';
import { Button, radius, spacing, Text, useColors } from '@/ui';

/**
 * Explains a server-side "limit" refusal: what happened, why, and what to do. Usually the
 * cause is a Premium subscription that ended while the app still had it cached.
 */
export function LimitNotice() {
  const colors = useColors();
  const t = useT();
  const refused = useSyncStore((s) => s.refusedByLimit);
  if (!refused) return null;

  const items = t('limit.items', { count: refused });
  return (
    <View
      testID="limit-notice"
      accessibilityRole="alert"
      style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.danger }]}>
      <Text variant="heading">{t('limit.title')}</Text>
      <Text muted>{t('limit.body', { items, limit: FREE_PLANT_LIMIT })}</Text>
      <View style={styles.row}>
        <Button
          label={t('common.upgrade')}
          style={styles.flex}
          onPress={() => {
            dismissLimitNotice();
            router.push('/paywall');
          }}
        />
        <Button
          label={t('common.dismiss')}
          variant="secondary"
          style={styles.flex}
          onPress={dismissLimitNotice}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { padding: spacing.md, borderRadius: radius.md, borderWidth: 1, gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
});
