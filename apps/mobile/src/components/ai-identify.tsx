import { useNetInfo } from '@react-native-community/netinfo';
import type { IdentifyReportReason, IdentifyResult } from '@plantpal/shared';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { reportSuggestion } from '@/api';
import { useIdentify } from '@/ai/use-identify';
import { toUserMessage } from '@/errors/user-message';
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
          label={state.kind === 'idle' ? 'Identify with AI' : 'Try again with AI'}
          variant="secondary"
          disabled={offline}
          onPress={() => identify(photoUri)}
        />
      )}
      {offline && state.kind !== 'busy' && (
        <Text variant="caption" muted>
          Identify with AI needs an internet connection. You can still add the plant yourself.
        </Text>
      )}

      {state.kind === 'busy' && (
        <View style={styles.row}>
          <Button label="Identifying…" loading style={styles.flex} />
          <Button testID="ai-cancel" label="Cancel" variant="secondary" onPress={cancel} />
        </View>
      )}

      {state.kind === 'suggested' && (
        <View testID="ai-suggestion" accessibilityLiveRegion="polite" style={box}>
          <Text variant="caption" style={{ color: colors.primary }}>
            Suggested by AI. Please check it.
          </Text>
          <Text variant="heading">{state.suggestion.commonName}</Text>
          {state.suggestion.scientificName && (
            <Text muted style={styles.italic}>
              {state.suggestion.scientificName}
            </Text>
          )}
          {state.suggestion.wateringIntervalDays !== null && (
            <Text>
              Water about every {state.suggestion.wateringIntervalDays}{' '}
              {state.suggestion.wateringIntervalDays === 1 ? 'day' : 'days'}
            </Text>
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
              Report this suggestion
            </Text>
          </Pressable>
        </View>
      )}

      {state.kind === 'unsure' && (
        <View testID="ai-unsure" accessibilityRole="alert" style={box}>
          <Text>{"I'm not sure what this is. Try a closer photo of the leaves."}</Text>
        </View>
      )}

      {state.kind === 'error' && (
        <View testID="ai-error" accessibilityRole="alert" style={box}>
          <Text>{state.message}</Text>
          {state.offerUpgrade && (
            <Button
              label="See Premium"
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
      Alert.alert('Thanks', "Thanks for telling us. We'll review this suggestion.");
    } catch (error) {
      Alert.alert('Report', toUserMessage(error, 'report'));
    }
  };
  Alert.alert('Report this suggestion', "What's wrong with it?", [
    { text: 'Wrong plant', onPress: () => send('wrong') },
    { text: 'Offensive', onPress: () => send('offensive') },
    { text: 'Cancel', style: 'cancel' },
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
