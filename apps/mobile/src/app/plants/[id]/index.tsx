import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { toUserMessage } from '@/errors/user-message';
import { AiIdentify } from '@/components/ai-identify';
import { PlantPhoto } from '@/components/plant-photo';
import { useLiveQuery } from '@/data/live';
import { mutate } from '@/data/mutations';
import {
  addPhoto,
  deletePlant,
  deleteWatering,
  getPlant,
  listPhotos,
  listWaterings,
  waterPlant,
} from '@/data/plants';
import { describeStatus, wateringStatus } from '@/data/watering';
import { track } from '@/analytics/analytics';
import { capturePhoto, localFileExists, type CapturedPhoto } from '@/photos/capture';
import { usePendingPhoto } from '@/photos/use-pending-photo';
import { canAddPhoto, usePremium } from '@/purchases/limits';
import { formatDateTime, useLanguage, useT } from '@/i18n';
import { Button, radius, spacing, Text, useColors } from '@/ui';

export default function PlantDetailScreen() {
  const colors = useColors();
  const t = useT();
  const language = useLanguage();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: plant, loading } = useLiveQuery((db) => getPlant(db, id), [id]);
  const { data: waterings } = useLiveQuery((db) => listWaterings(db, id), [id]);
  const { data: photos } = useLiveQuery((db) => listPhotos(db, id), [id]);
  const premium = usePremium();
  // A photo taken while Android had closed the app (common on Xiaomi phones) still arrives.
  usePendingPhoto((captured: CapturedPhoto) => {
    if (!canAddPhoto(premium, photos?.length ?? 0)) return; // checked before the camera opened
    mutate((db) => addPhoto(db, id, captured.photoId, captured.uri)).catch(() => undefined);
  }, Boolean(id));

  if (loading) return null;
  if (!plant) {
    return (
      <View style={styles.missing}>
        <Text>{t('detail.deleted')}</Text>
      </View>
    );
  }
  const statusText = describeStatus(
    wateringStatus(plant.lastWateredAt, plant.wateringIntervalDays),
    t,
  );
  const cover = photos?.find((p) => p.id === plant.coverPhotoId);
  // The AI needs the file itself; a photo only synced from another phone isn't on this one.
  const aiPhoto = cover?.localUri && localFileExists(cover.localUri) ? cover.localUri : null;

  async function addPhotoFrom(source: 'camera' | 'library') {
    if (!canAddPhoto(premium, photos?.length ?? 0)) {
      router.push({ pathname: '/paywall', params: { reason: 'photos' } });
      return;
    }
    try {
      const captured = await capturePhoto(source);
      if (!captured) return;
      await mutate((db) => addPhoto(db, id, captured.photoId, captured.uri));
      track('photo_added', { source });
    } catch (e) {
      Alert.alert(t('form.photoTitle'), toUserMessage(e, 'photo'));
    }
  }

  function confirmDelete() {
    Alert.alert(t('detail.deleteTitle'), t('detail.deleteBody', { name: plant!.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await mutate((db) => deletePlant(db, id));
          router.back();
        },
      },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={[styles.content, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: plant.name }} />
      <View style={styles.hero}>
        <PlantPhoto
          photoId={plant.coverPhotoId}
          localUri={cover?.localUri}
          size={160}
          label={t('common.photoOf', { name: plant.name })}
        />
        <Text variant="title" accessibilityRole="header">
          {plant.name}
        </Text>
        <Text muted>
          {t('detail.every', { count: plant.wateringIntervalDays })} · {statusText}
        </Text>
      </View>

      <AiIdentify
        photoUri={aiPhoto}
        action={{
          label: t('detail.useAi'),
          // Opens the edit form pre-filled; the user still decides and taps Save.
          onPress: (s) =>
            router.push({
              pathname: '/plants/[id]/edit',
              params: {
                id,
                suggestedName: s.commonName ?? '',
                suggestedInterval: String(s.wateringIntervalDays ?? ''),
              },
            }),
        }}
      />

      <Button
        testID="water-now"
        label={t('detail.waterNow')}
        onPress={() => {
          track('plant_watered', { from: 'detail' });
          return mutate((db) => waterPlant(db, id));
        }}
      />

      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <Text variant="heading">{t('detail.history')}</Text>
        {waterings?.length ? (
          waterings.map((w) => (
            <View key={w.id} style={styles.historyRow}>
              <Text style={styles.flex}>{formatDateTime(w.wateredAt, language)}</Text>
              <Button
                label={t('detail.undo')}
                accessibilityLabel={t('detail.undoLabel', {
                  date: formatDateTime(w.wateredAt, language),
                })}
                variant="secondary"
                onPress={() => mutate((db) => deleteWatering(db, w.id))}
              />
            </View>
          ))
        ) : (
          <Text muted>{t('detail.notWatered')}</Text>
        )}
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <Text variant="heading">{t('detail.photos')}</Text>
        <View style={styles.photoGrid}>
          {photos?.map((p) => (
            <View key={p.id}>
              <PlantPhoto
                photoId={p.id}
                localUri={p.localUri}
                size={96}
                label={t('detail.photoFrom', { date: formatDateTime(p.takenAt, language) })}
              />
              {p.uploadState === 'pending' && (
                <Text variant="caption" muted>
                  {t('detail.waitingUpload')}
                </Text>
              )}
            </View>
          ))}
        </View>
        <View style={styles.photoButtons}>
          <Button
            label={t('form.takePhoto')}
            variant="secondary"
            style={styles.flex}
            onPress={() => addPhotoFrom('camera')}
          />
          <Button
            label={t('form.choosePhoto')}
            variant="secondary"
            style={styles.flex}
            onPress={() => addPhotoFrom('library')}
          />
        </View>
      </View>

      <Button
        label={t('detail.edit')}
        variant="secondary"
        onPress={() => router.push({ pathname: '/plants/[id]/edit', params: { id } })}
      />
      <Button
        testID="delete-plant"
        label={t('detail.delete')}
        variant="danger"
        onPress={confirmDelete}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.md, flexGrow: 1 },
  hero: { alignItems: 'center', gap: spacing.sm },
  card: { padding: spacing.md, borderRadius: radius.md, gap: spacing.sm },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  photoButtons: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
