import { FREE_PLANT_LIMIT } from '@plantpal/shared';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { markSeen } from '@/data/first-run';
import { getDb } from '@/db/database';

import { usePremium } from '@/purchases/limits';
import { Button, Logo, radius, Screen, spacing, Text, useColors } from '@/ui';

type Feature = { icon: string; title: string; body: string };

/**
 * Everything the app really does, in plain words. Limits come from the same shared constants
 * the server enforces, so this text can't drift from the actual rules.
 */
export const FEATURES: Feature[] = [
  {
    icon: '🌱',
    title: 'Add your plants',
    body: 'Give each plant a name, say how often it needs water, and add a photo from your camera or gallery.',
  },
  {
    icon: '💧',
    title: 'Water with one tap',
    body: 'Tap "Water" when you water a plant. The list shows when each one needs water next, and you can undo a tap from its history.',
  },
  {
    icon: '🔔',
    title: 'Get reminders',
    body: 'Turn on reminders in Settings and PlantPal tells you the morning a plant is due, plus a daily nudge if one is overdue. Tap a reminder to open that plant.',
  },
  {
    icon: '✈️',
    title: 'Works without internet',
    body: 'Everything works offline. Your changes are saved on the phone and sync on their own when you are back online; the badge at the top shows the status.',
  },
  {
    icon: '📱',
    title: 'Same plants on every device',
    body: 'Sign in on another phone and your plants, waterings and photos are there. Changes on one phone appear on the others.',
  },
  {
    icon: '📸',
    title: 'Photo history',
    body: 'See how a plant grows with a photo timeline. Free accounts keep one photo per plant.',
  },
  {
    icon: '⭐',
    title: 'Premium',
    body: `The free plan includes ${FREE_PLANT_LIMIT} plants. Premium unlocks unlimited plants and photo history. Already subscribed on another phone? Use "Restore purchases".`,
  },
  {
    icon: '🔒',
    title: 'You stay in control',
    body: 'Sign out at any time, or delete your account and all its data from Settings. Signing out also clears your plants from this phone.',
  },
];

export default function GuideScreen() {
  const colors = useColors();
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
        <Text muted>Here is everything you can do with PlantPal.</Text>
      </View>

      {FEATURES.map((f) => (
        <View
          key={f.title}
          style={[styles.card, { backgroundColor: colors.surface }]}
          accessible
          accessibilityLabel={`${f.title}. ${f.body}`}>
          <Text style={styles.icon} importantForAccessibility="no" accessibilityElementsHidden>
            {f.icon}
          </Text>
          <View style={styles.cardText}>
            <Text variant="heading">{f.title}</Text>
            <Text muted>{f.body}</Text>
          </View>
        </View>
      ))}

      <Button testID="guide-done" label="Start using PlantPal" onPress={() => router.back()} />
      {!premium && (
        <Button
          label="See Premium"
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
