import { Pressable, StyleSheet, View } from 'react-native';

import {
  setLanguagePreference,
  systemLanguage,
  useLanguagePreference,
  useT,
  type LanguagePreference,
} from '@/i18n';
import { radius, spacing, Text, useColors } from '@/ui';

const LANGUAGE_OPTIONS: LanguagePreference[] = ['system', 'en', 'es'];
const RADIO = { on: '● ', off: '○ ' };

/** System default follows the phone; a fixed choice stays until changed. Takes effect at once. */
export function LanguageCard() {
  const colors = useColors();
  const t = useT();
  const preference = useLanguagePreference();
  const label = (option: LanguagePreference) =>
    option === 'system'
      ? t('language.systemWith', { language: t(`language.${systemLanguage()}`) })
      : t(`language.${option}`);
  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]} accessibilityRole="radiogroup">
      <Text variant="heading">{t('language.title')}</Text>
      {LANGUAGE_OPTIONS.map((option) => {
        const selected = preference === option;
        return (
          <Pressable
            key={option}
            testID={`settings-language-${option}`}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={label(option)}
            onPress={() => setLanguagePreference(option)}
            style={styles.option}>
            <Text style={{ color: selected ? colors.primary : colors.text }}>
              {selected ? RADIO.on : RADIO.off}
              {label(option)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.md, borderRadius: radius.md, gap: spacing.xs },
  option: { minHeight: 44, justifyContent: 'center' },
});
