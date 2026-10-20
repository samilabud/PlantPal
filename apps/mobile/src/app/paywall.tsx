import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';

import { toUserMessage } from '@/errors/user-message';
import { track, usePaywallVariant, type PaywallVariant } from '@/analytics/analytics';
import { buy, getPackages, isPurchasesAvailable, restore } from '@/purchases/purchases';
import { FREE_PLANT_LIMIT, IDENTIFY_LIMITS } from '@plantpal/shared';
import { useT, type T } from '@/i18n';
import { Button, radius, Screen, spacing, Text, useColors } from '@/ui';

const REASONS = ['plants', 'photos', 'ai'] as const;
const reasonText = (reason: string | undefined, t: T) =>
  REASONS.find((r) => r === reason) &&
  t(`paywall.reasons.${reason as (typeof REASONS)[number]}`, {
    limit: FREE_PLANT_LIMIT,
    free: IDENTIFY_LIMITS.free.perDay,
    premium: IDENTIFY_LIMITS.premium.perDay,
  });

/** The `paywall-variant` flag (PostHog A/B test): same plans and prices, different framing. */
const COPY_KEY: Record<PaywallVariant, 'control' | 'plantsFirst'> = {
  control: 'control',
  'plants-first': 'plantsFirst',
};
const copyFor = (variant: PaywallVariant, t: T) => {
  const k = COPY_KEY[variant];
  return {
    title: t(`paywall.${k}.title`),
    benefits: [
      t(`paywall.${k}.b1`),
      t(`paywall.${k}.b2`),
      t(`paywall.${k}.b3`, { count: IDENTIFY_LIMITS.premium.perDay }),
      t(`paywall.${k}.b4`),
    ],
  };
};

const CHECK = '✓ ';

const PERIODS = ['MONTHLY', 'ANNUAL', 'LIFETIME'] as const;
const periodText = (packageType: string, t: T) =>
  PERIODS.find((p) => p === packageType)
    ? t(`paywall.period.${packageType as (typeof PERIODS)[number]}`)
    : '';

export default function PaywallScreen() {
  const colors = useColors();
  const t = useT();
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  const [busy, setBusy] = useState<string | null>(null);
  const { variant, ready } = usePaywallVariant();
  const copy = copyFor(variant, t);
  const reasonLine = reasonText(reason, t);

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
        Alert.alert(t('paywall.welcomeTitle'), t('paywall.welcomeBody'));
      }
    } catch (e) {
      Alert.alert(t('paywall.purchaseFailed'), toUserMessage(e, 'purchase'));
    } finally {
      setBusy(null);
    }
  }

  async function onRestore() {
    setBusy('restore');
    try {
      const premium = await restore();
      Alert.alert(
        t('paywall.restoreTitle'),
        premium ? t('paywall.restored') : t('paywall.nothingToRestore'),
      );
      if (premium) router.back();
    } catch (e) {
      Alert.alert(t('paywall.restoreFailed'), toUserMessage(e, 'restore'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen>
      <Text variant="title" accessibilityRole="header">
        {copy.title}
      </Text>
      {reasonLine && <Text muted>{reasonLine}</Text>}

      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        {copy.benefits.map((b) => (
          <Text key={b}>
            {CHECK}
            {b}
          </Text>
        ))}
      </View>

      {!isPurchasesAvailable() ? (
        <Text muted>{t('paywall.notSetUp')}</Text>
      ) : packages.isPending ? (
        <ActivityIndicator accessibilityLabel={t('paywall.loading')} />
      ) : packages.isError || !packages.data?.length ? (
        <Text style={{ color: colors.danger }}>{t('paywall.loadFailed')}</Text>
      ) : (
        packages.data.map((pkg) => (
          <Button
            key={pkg.identifier}
            testID={`buy-${pkg.packageType.toLowerCase()}`}
            label={`${pkg.product.priceString} ${periodText(pkg.packageType, t)}`.trim()}
            accessibilityLabel={t('paywall.subscribeLabel', {
              price: pkg.product.priceString,
              period: periodText(pkg.packageType, t),
            })}
            loading={busy === pkg.identifier}
            disabled={busy !== null}
            onPress={() => purchase(pkg)}
          />
        ))
      )}

      <Button
        label={t('paywall.restore')}
        variant="secondary"
        loading={busy === 'restore'}
        disabled={busy !== null}
        onPress={onRestore}
      />
      <Text muted variant="caption">
        {__DEV__ ? t('paywall.testOnly') : ''}
        {t('paywall.renewal')}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.md, borderRadius: radius.md, gap: spacing.xs },
});
