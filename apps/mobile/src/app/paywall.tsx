import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';

import { track, usePaywallVariant, type PaywallVariant } from '@/analytics/analytics';
import { buy, getPackages, isPurchasesAvailable, restore } from '@/purchases/purchases';
import { FREE_PLANT_LIMIT } from '@plantpal/shared';
import { Button, radius, Screen, spacing, Text, useColors } from '@/ui';

const REASON: Record<string, string> = {
  plants: `The free plan includes ${FREE_PLANT_LIMIT} plants.`,
  photos: 'The free plan includes one photo per plant.',
};

/** The `paywall-variant` flag (PostHog A/B test): same plans and prices, different framing. */
const COPY: Record<PaywallVariant, { title: string; benefits: string[] }> = {
  control: {
    title: 'PlantPal Premium',
    benefits: ['Unlimited plants', 'Photo history for every plant', 'Supports an independent app'],
  },
  'plants-first': {
    title: 'Room for every plant',
    benefits: [
      'Add as many plants as you own',
      'Keep a photo diary of each one',
      'Supports an independent app',
    ],
  },
};

const PERIOD: Record<string, string> = {
  MONTHLY: 'per month',
  ANNUAL: 'per year',
  LIFETIME: 'once',
};

export default function PaywallScreen() {
  const colors = useColors();
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  const [busy, setBusy] = useState<string | null>(null);
  const { variant, ready } = usePaywallVariant();
  const copy = COPY[variant];

  // Recorded once the flag is known, so the event carries the copy the user actually saw.
  useEffect(() => {
    if (ready) track('paywall_viewed', { reason: reason ?? 'direct', variant });
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps -- once per visit
  const packages = useQuery({
    queryKey: ['packages'],
    queryFn: getPackages,
    enabled: isPurchasesAvailable(),
  });

  async function purchase(pkg: PurchasesPackage) {
    setBusy(pkg.identifier);
    try {
      if (await buy(pkg)) {
        track('purchase_completed', { package_type: pkg.packageType, variant });
        router.back();
        Alert.alert('Welcome to Premium 🌿', 'Unlimited plants and photo history are unlocked.');
      }
    } catch (e) {
      Alert.alert('Purchase failed', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(null);
    }
  }

  async function onRestore() {
    setBusy('restore');
    try {
      const premium = await restore();
      Alert.alert('Restore', premium ? 'Premium restored.' : 'No active subscription found.');
      if (premium) router.back();
    } catch (e) {
      Alert.alert('Restore failed', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen>
      <Text variant="title" accessibilityRole="header">
        {copy.title}
      </Text>
      {reason && REASON[reason] && <Text muted>{REASON[reason]}</Text>}

      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        {copy.benefits.map((b) => (
          <Text key={b}>✓ {b}</Text>
        ))}
      </View>

      {!isPurchasesAvailable() ? (
        <Text muted>{"Purchases aren't set up in this build yet."}</Text>
      ) : packages.isPending ? (
        <ActivityIndicator accessibilityLabel="Loading plans" />
      ) : packages.isError || !packages.data?.length ? (
        <Text style={{ color: colors.danger }}>
          {"Plans couldn't be loaded. Check your connection."}
        </Text>
      ) : (
        packages.data.map((pkg) => (
          <Button
            key={pkg.identifier}
            testID={`buy-${pkg.packageType.toLowerCase()}`}
            label={`${pkg.product.priceString} ${PERIOD[pkg.packageType] ?? ''}`.trim()}
            accessibilityLabel={`Subscribe for ${pkg.product.priceString} ${PERIOD[pkg.packageType] ?? ''}`}
            loading={busy === pkg.identifier}
            disabled={busy !== null}
            onPress={() => purchase(pkg)}
          />
        ))
      )}

      <Button
        label="Restore purchases"
        variant="secondary"
        loading={busy === 'restore'}
        disabled={busy !== null}
        onPress={onRestore}
      />
      <Text muted variant="caption">
        {__DEV__ ? 'Test purchases only: no real money is charged. ' : ''}
        Subscriptions renew automatically until cancelled in your store account settings.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.md, borderRadius: radius.md, gap: spacing.xs },
});
