import { Pressable, StyleSheet, View } from 'react-native';

import { setLanguagePreference, useLanguage, useT } from '@/i18n';
import { Text, useColors } from '@/ui';

const LANGUAGES = ['en', 'es'] as const;

/**
 * "English | Español" before signing in. Choosing here sets the same device preference as the
 * Settings row (it stops following the phone's language until "System default" is picked).
 */
export function LanguageToggle() {
  const colors = useColors();
  const t = useT();
  const active = useLanguage();
  return (
    <View style={styles.toggle} testID="language-toggle">
      {LANGUAGES.map((language, i) => (
        <View key={language} style={styles.toggleItem}>
          {i > 0 && (
            <Text muted variant="caption">
              {' | '}
            </Text>
          )}
          <Pressable
            testID={`language-${language}`}
            accessibilityRole="button"
            accessibilityState={{ selected: active === language }}
            accessibilityLabel={t('language.toggleLabel', { language: t(`language.${language}`) })}
            hitSlop={8}
            onPress={() => setLanguagePreference(language)}>
            <Text
              variant="caption"
              style={{
                color: active === language ? colors.primary : colors.textMuted,
                fontWeight: active === language ? '700' : '400',
              }}>
              {t(`language.${language}`)}
            </Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // Centered: the top-right corner is where development builds draw their tools button.
  toggle: { flexDirection: 'row', justifyContent: 'center' },
  toggleItem: { flexDirection: 'row', alignItems: 'center' },
});
