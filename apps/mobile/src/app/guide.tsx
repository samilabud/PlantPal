import { FREE_PLANT_LIMIT, IDENTIFY_LIMITS } from '@plantpal/shared';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { markSeen } from '@/data/first-run';
import { getDb } from '@/db/database';

import { useT, type T } from '@/i18n';
import { usePremium } from '@/purchases/limits';
import { Button, Logo, radius, Screen, spacing, Text, useColors } from '@/ui';

type FeatureKey =
  'add' | 'ai' | 'water' | 'reminders' | 'offline' | 'devices' | 'photos' | 'premium' | 'control';

/**
 * Everything the app really does, in plain words (texts in src/i18n). Limits come from the same
 * shared constants the server enforces, so the text can't drift from the actual rules.
 */
export const FEATURES: { icon: string; key: FeatureKey }[] = [
  { icon: '🌱', key: 'add' },
  { icon: '✨', key: 'ai' },
  { icon: '💧', key: 'water' },
  { icon: '🔔', key: 'reminders' },
  { icon: '✈️', key: 'offline' },
  { icon: '📱', key: 'devices' },
  { icon: '📸', key: 'photos' },
  { icon: '⭐', key: 'premium' },
  { icon: '🔒', key: 'control' },
];

export const featureText = (key: FeatureKey, t: T) => ({
  title: t(`guide.features.${key}.title`),
  body: t(`guide.features.${key}.body`, {
    plants: FREE_PLANT_LIMIT,
    aiFree: IDENTIFY_LIMITS.free.perDay,
    aiPremium: IDENTIFY_LIMITS.premium.perDay,
  }),
});

export default function GuideScreen() {
  const colors = useColors();
  const t = useT();
  const premium = usePremium();

  // Marked as seen only once it is really on screen.
  useEffect(() => {
    getDb()
      .then((db) => markSeen(db, 'seenGuide'))
      .catch(() => undefined);
  }, []);

  return (
    <Screen>
      <View style={styles.header}>
        <Logo variant="horizontal" height={36} />
        <Text muted>{t('guide.intro')}</Text>
      </View>

      {FEATURES.map((f) => {
        const { title, body } = featureText(f.key, t);
        return (
          <View
            key={f.key}
            style={[styles.card, { backgroundColor: colors.surface }]}
            accessible
            accessibilityLabel={`${title}. ${body}`}>
            <Text style={styles.icon} importantForAccessibility="no" accessibilityElementsHidden>
              {f.icon}
            </Text>
            <View style={styles.cardText}>
              <Text variant="heading">{title}</Text>
              <Text muted>{body}</Text>
            </View>
          </View>
        );
      })}

      <Button testID="guide-done" label={t('guide.start')} onPress={() => router.back()} />
      {!premium && (
        <Button
          label={t('common.seePremium')}
          variant="secondary"
          onPress={() => router.replace('/paywall')}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm, alignItems: 'flex-start' },
  card: { flexDirection: 'row', gap: spacing.md, padding: spacing.md, borderRadius: radius.md },
  icon: { fontSize: 28, lineHeight: 34 },
  cardText: { flex: 1, gap: spacing.xs },
});
