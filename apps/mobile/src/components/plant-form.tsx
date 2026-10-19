import { useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';

import { toUserMessage } from '@/errors/user-message';
import { capturePhoto, type CapturedPhoto } from '@/photos/capture';
import { Button, radius, spacing, Text, useColors } from '@/ui';

import { PlantPhoto } from './plant-photo';

export type PlantFormValues = {
  name: string;
  wateringIntervalDays: number;
  photo: CapturedPhoto | null;
};

type Props = {
  initial?: { name: string; wateringIntervalDays: number };
  allowPhoto?: boolean;
  submitLabel: string;
  onSubmit: (values: PlantFormValues) => Promise<void>;
};

export function validatePlantForm(name: string, interval: string): string | null {
  if (!name.trim()) return 'Give your plant a name';
  if (name.trim().length > 80) return 'Name is too long (80 characters max)';
  const n = Number(interval);
  if (!Number.isInteger(n) || n < 1 || n > 365) return 'Water every 1 to 365 days';
  return null;
}

export function PlantForm({ initial, allowPhoto = false, submitLabel, onSubmit }: Props) {
  const colors = useColors();
  const [name, setName] = useState(initial?.name ?? '');
  const [interval, setInterval] = useState(String(initial?.wateringIntervalDays ?? 7));
  const [photo, setPhoto] = useState<CapturedPhoto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const input = [
    styles.input,
    { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface },
  ];

  async function pick(source: 'camera' | 'library') {
    try {
      const captured = await capturePhoto(source);
      if (captured) setPhoto(captured);
    } catch (e) {
      Alert.alert('Photo', toUserMessage(e, 'photo'));
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
            label="Plant photo preview"
          />
          <View style={styles.photoButtons}>
            <Button label="Take photo" variant="secondary" onPress={() => pick('camera')} />
            <Button label="Choose photo" variant="secondary" onPress={() => pick('library')} />
          </View>
        </View>
      )}

      <Text nativeID="name-label">Name</Text>
      <TextInput
        testID="plant-name-input"
        accessibilityLabelledBy="name-label"
        accessibilityLabel="Plant name"
        value={name}
        onChangeText={setName}
        placeholder="e.g. Monstera"
        placeholderTextColor={colors.textMuted}
        style={input}
        maxLength={80}
        returnKeyType="next"
      />

      <Text nativeID="interval-label">Water every (days)</Text>
      <TextInput
        testID="plant-interval-input"
        accessibilityLabelledBy="interval-label"
        accessibilityLabel="Water every how many days"
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
