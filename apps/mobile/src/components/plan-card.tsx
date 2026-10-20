import { FREE_PLANT_LIMIT } from '@plantpal/shared';
import { router } from 'expo-router';
import { Linking, StyleSheet, View } from 'react-native';

import { useAuthStore } from '@/auth/auth-store';
import { useLiveQuery } from '@/data/live';
import { listPlants } from '@/data/plants';
import { usePremium } from '@/purchases/limits';
import { usePremiumStore } from '@/purchases/purchases';
import { formatDate, useT } from '@/i18n';
import { Button, radius, spacing, Text, useColors } from '@/ui';

export function PlanCard() {
  const colors = useColors();
  const t = useT();
  const premium = usePremium();
  const expiresAt = useAuthStore((s) => s.user?.planExpiresAt);
  const managementUrl = usePremiumStore((s) => s.managementUrl);
  const { data: plants } = useLiveQuery(listPlants, []);

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <Text variant="heading">{t('plan.title')}</Text>
      {premium ? (
        <Text testID="plan-status">
          {expiresAt ? t('plan.premiumUntil', { date: formatDate(expiresAt) }) : t('plan.premium')}
        </Text>
      ) : (
        <Text testID="plan-status">
          {t('plan.free', { count: plants?.length ?? 0, limit: FREE_PLANT_LIMIT })}
        </Text>
      )}
      {premium && managementUrl ? (
        <Button
          label={t('plan.manage')}
          variant="secondary"
          onPress={() => Linking.openURL(managementUrl)}
        />
      ) : !premium ? (
        <Button
          testID="upgrade"
          label={t('plan.upgrade')}
          onPress={() => router.push('/paywall')}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.md, borderRadius: radius.md, gap: spacing.sm },
});
