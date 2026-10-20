import type { IdentifyResult } from '@plantpal/shared';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';

import { toUserMessage } from '@/errors/user-message';
import { t, useT } from '@/i18n';
import { capturePhoto, type CapturedPhoto } from '@/photos/capture';
import { Button, radius, spacing, Text, useColors } from '@/ui';

import { AiIdentify } from './ai-identify';
import { PlantPhoto } from './plant-photo';

export type PlantFormValues = {
  name: string;
  wateringIntervalDays: number;
  photo: CapturedPhoto | null;
};

type Props = {
  initial?: { name: string; wateringIntervalDays: number };
  /** The initial values came from an AI suggestion (the detail screen's "Use these details"). */
  initialFromAi?: boolean;
  allowPhoto?: boolean;
  submitLabel: string;
  onSubmit: (values: PlantFormValues) => Promise<void>;
};

/** Returns the problem, translated at call time, or null. */
export function validatePlantForm(name: string, interval: string): string | null {
  if (!name.trim()) return t('form.errors.nameRequired');
  if (name.trim().length > 80) return t('form.errors.nameTooLong');
  const n = Number(interval);
  if (!Number.isInteger(n) || n < 1 || n > 365) return t('form.errors.interval');
  return null;
}

export function PlantForm({
  initial,
  initialFromAi = false,
  allowPhoto = false,
  submitLabel,
  onSubmit,
}: Props) {
  const colors = useColors();
  const t = useT();
  const [name, setName] = useState(initial?.name ?? '');
  const [interval, setInterval] = useState(String(initial?.wateringIntervalDays ?? 7));
  const [photo, setPhoto] = useState<CapturedPhoto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [fromAi, setFromAi] = useState(initialFromAi);

  // Pre-fill only: the user can change anything, and nothing is saved until they tap Save.
  const applySuggestion = useCallback((s: IdentifyResult) => {
    if (s.commonName) setName(s.commonName.slice(0, 80));
    if (s.wateringIntervalDays) setInterval(String(s.wateringIntervalDays));
    setFromAi(true);
  }, []);

  const input = [
    styles.input,
    { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface },
  ];

  async function pick(source: 'camera' | 'library') {
    try {
      const captured = await capturePhoto(source);
      if (captured) setPhoto(captured);
    } catch (e) {
      Alert.alert(t('form.photoTitle'), toUserMessage(e, 'photo'));
    }
  }

  async function submit() {
    const problem = validatePlantForm(name, interval);
    setError(problem);
    if (problem) return;
    setSaving(true);
    try {
      await onSubmit({ name: name.trim(), wateringIntervalDays: Number(interval), photo });
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.form}>
      {allowPhoto && (
        <View style={styles.photoRow}>
          <PlantPhoto
            photoId={photo?.photoId ?? null}
            localUri={photo?.uri}
            size={96}
            label={t('form.photoPreview')}
          />
          <View style={styles.photoButtons}>
            <Button
              label={t('form.takePhoto')}
              variant="secondary"
              onPress={() => pick('camera')}
            />
            <Button
              label={t('form.choosePhoto')}
              variant="secondary"
              onPress={() => pick('library')}
            />
          </View>
        </View>
      )}
      {allowPhoto && <AiIdentify photoUri={photo?.uri ?? null} onSuggestion={applySuggestion} />}

      {fromAi && (
        <Text testID="ai-prefilled" variant="caption" style={{ color: colors.primary }}>
          {t('form.aiPrefilled')}
        </Text>
      )}
      <Text nativeID="name-label">{t('form.name')}</Text>
      <TextInput
        testID="plant-name-input"
        accessibilityLabelledBy="name-label"
        accessibilityLabel={t('form.nameLabel')}
        value={name}
        onChangeText={setName}
        placeholder={t('form.namePlaceholder')}
        placeholderTextColor={colors.textMuted}
        style={input}
        maxLength={80}
        returnKeyType="next"
      />

      <Text nativeID="interval-label">{t('form.interval')}</Text>
      <TextInput
        testID="plant-interval-input"
        accessibilityLabelledBy="interval-label"
        accessibilityLabel={t('form.intervalLabel')}
        value={interval}
        onChangeText={setInterval}
        keyboardType="number-pad"
        style={input}
        maxLength={3}
      />

      {error && (
        <Text accessibilityRole="alert" style={{ color: colors.danger }}>
          {error}
        </Text>
      )}
      <Button testID="plant-submit" label={submitLabel} loading={saving} onPress={submit} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.sm },
  input: {
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.md,
    fontSize: 16,
    minHeight: 48,
  },
  photoRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  photoButtons: { flex: 1, gap: spacing.sm },
});
