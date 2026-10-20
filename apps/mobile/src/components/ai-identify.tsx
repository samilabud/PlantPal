import { useNetInfo } from '@react-native-community/netinfo';
import type { IdentifyReportReason, IdentifyResult } from '@plantpal/shared';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { reportSuggestion } from '@/api';
import { useIdentify } from '@/ai/use-identify';
import { toUserMessage } from '@/errors/user-message';
import { t, useT } from '@/i18n';
import { Button, radius, spacing, Text, useColors } from '@/ui';

type Props = {
  /** The photo to identify; the button only appears once there is one. */
  photoUri: string | null;
  /** Called with answers good enough to pre-fill. Never saves anything by itself. */
  onSuggestion?: (suggestion: IdentifyResult) => void;
  /** An extra button under the suggestion (the detail screen's "Use these details"). */
  action?: { label: string; onPress: (suggestion: IdentifyResult) => void };
};

const noop = () => {};

/**
 * "Identify with AI": optional help that never blocks adding a plant. Offline, it explains
 * instead of failing; busy, it can be cancelled; every answer is labeled as the AI's and can be
 * reported (Google Play's AI-Generated Content policy).
 */
export function AiIdentify({ photoUri, onSuggestion = noop, action }: Props) {
  const colors = useColors();
  const t = useT();
  const { isConnected } = useNetInfo();
  const offline = isConnected === false; // null = not known yet: let the request decide
  const { state, identify, cancel } = useIdentify(onSuggestion);

  // A different photo makes the old answer (or the call in flight) meaningless.
  useEffect(() => cancel, [photoUri, cancel]);

  if (!photoUri) return null;

  const box = [styles.box, { backgroundColor: colors.surface, borderColor: colors.border }];

  return (
    <View testID="ai-identify" style={styles.wrap}>
      {state.kind !== 'busy' && state.kind !== 'suggested' && (
        <Button
          testID="ai-identify-button"
          label={state.kind === 'idle' ? t('ai.button') : t('ai.retry')}
          variant="secondary"
          disabled={offline}
          onPress={() => identify(photoUri)}
        />
      )}
      {offline && state.kind !== 'busy' && (
        <Text variant="caption" muted>
          {t('ai.offline')}
        </Text>
      )}

      {state.kind === 'busy' && (
        <View style={styles.row}>
          <Button label={t('ai.busy')} loading style={styles.flex} />
          <Button
            testID="ai-cancel"
            label={t('common.cancel')}
            variant="secondary"
            onPress={cancel}
          />
        </View>
      )}

      {state.kind === 'suggested' && (
        <View testID="ai-suggestion" accessibilityLiveRegion="polite" style={box}>
          <Text variant="caption" style={{ color: colors.primary }}>
            {t('ai.label')}
          </Text>
          <Text variant="heading">{state.suggestion.commonName}</Text>
          {state.suggestion.scientificName && (
            <Text muted style={styles.italic}>
              {state.suggestion.scientificName}
            </Text>
          )}
          {state.suggestion.wateringIntervalDays !== null && (
            <Text>{t('ai.waterEvery', { count: state.suggestion.wateringIntervalDays })}</Text>
          )}
          {state.suggestion.careTip && <Text muted>{state.suggestion.careTip}</Text>}
          {action && (
            <Button
              testID="ai-use-suggestion"
              label={action.label}
              onPress={() => action.onPress(state.suggestion)}
            />
          )}
          <Pressable
            testID="ai-report"
            accessibilityRole="button"
            onPress={() => askToReport(state.id, state.suggestion)}
            hitSlop={8}>
            <Text variant="caption" muted style={styles.link}>
              {t('ai.report')}
            </Text>
          </Pressable>
        </View>
      )}

      {state.kind === 'unsure' && (
        <View testID="ai-unsure" accessibilityRole="alert" style={box}>
          <Text>{t('ai.unsure')}</Text>
        </View>
      )}

      {state.kind === 'error' && (
        <View testID="ai-error" accessibilityRole="alert" style={box}>
          <Text>{state.message}</Text>
          {state.offerUpgrade && (
            <Button
              label={t('common.seePremium')}
              variant="secondary"
              onPress={() => router.push({ pathname: '/paywall', params: { reason: 'ai' } })}
            />
          )}
        </View>
      )}
    </View>
  );
}

/** Two reasons fit Android's three-button dialog; "other" stays available to the API. */
function askToReport(identificationId: string, suggestion: IdentifyResult) {
  const send = async (reason: IdentifyReportReason) => {
    try {
      await reportSuggestion({ identificationId, reason, suggestion });
      Alert.alert(t('ai.reportThanksTitle'), t('ai.reportThanks'));
    } catch (error) {
      Alert.alert(t('ai.reportTitle'), toUserMessage(error, 'report'));
    }
  };
  Alert.alert(t('ai.report'), t('ai.reportQuestion'), [
    { text: t('ai.reportWrong'), onPress: () => send('wrong') },
    { text: t('ai.reportOffensive'), onPress: () => send('offensive') },
    { text: t('common.cancel'), style: 'cancel' },
  ]);
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  box: { padding: spacing.md, borderRadius: radius.md, borderWidth: 1, gap: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  italic: { fontStyle: 'italic' },
  link: { textDecorationLine: 'underline', paddingTop: spacing.xs },
});
