import { FREE_PLANT_LIMIT } from '@plantpal/shared';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { dismissLimitNotice, useSyncStore } from '@/sync/sync-manager';
import { Button, radius, spacing, Text, useColors } from '@/ui';

/**
 * Explains a server-side "limit" refusal: what happened, why, and what to do. Usually the
 * cause is a Premium subscription that ended while the app still had it cached.
 */
export function LimitNotice() {
  const colors = useColors();
  const refused = useSyncStore((s) => s.refusedByLimit);
  if (!refused) return null;

  const items = refused === 1 ? '1 new item' : `${refused} new items`;
  return (
    <View
      testID="limit-notice"
      accessibilityRole="alert"
      style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.danger }]}>
      <Text variant="heading">Premium is no longer active</Text>
      <Text muted>
        {`${items} couldn't be saved: the free plan includes ${FREE_PLANT_LIMIT} plants and one photo per plant. Upgrade to keep adding, or restore a subscription you already have.`}
      </Text>
      <View style={styles.row}>
        <Button
          label="Upgrade"
          style={styles.flex}
          onPress={() => {
            dismissLimitNotice();
            router.push('/paywall');
          }}
        />
        <Button
          label="Dismiss"
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
