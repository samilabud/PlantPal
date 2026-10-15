import { FREE_PLANT_LIMIT } from '@plantpal/shared';
import { router } from 'expo-router';
import { Linking, StyleSheet, View } from 'react-native';

import { useAuthStore } from '@/auth/auth-store';
import { useLiveQuery } from '@/data/live';
import { listPlants } from '@/data/plants';
import { usePremium } from '@/purchases/limits';
import { usePremiumStore } from '@/purchases/purchases';
import { Button, radius, spacing, Text, useColors } from '@/ui';

export function PlanCard() {
  const colors = useColors();
  const premium = usePremium();
  const expiresAt = useAuthStore((s) => s.user?.planExpiresAt);
  const managementUrl = usePremiumStore((s) => s.managementUrl);
  const { data: plants } = useLiveQuery(listPlants, []);

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <Text variant="heading">Plan</Text>
      {premium ? (
        <Text testID="plan-status">
          Premium{expiresAt ? ` · renews or ends ${new Date(expiresAt).toLocaleDateString()}` : ''}
        </Text>
      ) : (
        <Text testID="plan-status">
          Free · {plants?.length ?? 0} of {FREE_PLANT_LIMIT} plants
        </Text>
      )}
      {premium && managementUrl ? (
        <Button
          label="Manage subscription"
          variant="secondary"
          onPress={() => Linking.openURL(managementUrl)}
        />
      ) : !premium ? (
        <Button
          testID="upgrade"
          label="Upgrade to Premium"
          onPress={() => router.push('/paywall')}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.md, borderRadius: radius.md, gap: spacing.sm },
});
