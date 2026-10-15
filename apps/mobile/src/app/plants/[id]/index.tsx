import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

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
import { capturePhoto } from '@/photos/capture';
import { canAddPhoto, usePremium } from '@/purchases/limits';
import { Button, radius, spacing, Text, useColors } from '@/ui';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export default function PlantDetailScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: plant, loading } = useLiveQuery((db) => getPlant(db, id), [id]);
  const { data: waterings } = useLiveQuery((db) => listWaterings(db, id), [id]);
  const { data: photos } = useLiveQuery((db) => listPhotos(db, id), [id]);
  const premium = usePremium();

  if (loading) return null;
  if (!plant) {
    return (
      <View style={styles.missing}>
        <Text>This plant was deleted.</Text>
      </View>
    );
  }
  const statusText = describeStatus(
    wateringStatus(plant.lastWateredAt, plant.wateringIntervalDays),
  );
  const cover = photos?.find((p) => p.id === plant.coverPhotoId);

  async function addPhotoFrom(source: 'camera' | 'library') {
    if (!canAddPhoto(premium, photos?.length ?? 0)) {
      router.push({ pathname: '/paywall', params: { reason: 'photos' } });
      return;
    }
    try {
      const captured = await capturePhoto(source);
      if (captured) await mutate((db) => addPhoto(db, id, captured.photoId, captured.uri));
    } catch (e) {
      Alert.alert('Photo', e instanceof Error ? e.message : 'Could not add the photo');
    }
  }

  function confirmDelete() {
    Alert.alert(
      'Delete plant?',
      `${plant!.name} and its history will be removed on all your devices.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await mutate((db) => deletePlant(db, id));
            router.back();
          },
        },
      ],
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.content, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: plant.name }} />
      <View style={styles.hero}>
        <PlantPhoto
          photoId={plant.coverPhotoId}
          localUri={cover?.localUri}
          size={160}
          label={`Photo of ${plant.name}`}
        />
        <Text variant="title" accessibilityRole="header">
          {plant.name}
        </Text>
        <Text muted>
          Every {plant.wateringIntervalDays} {plant.wateringIntervalDays === 1 ? 'day' : 'days'} ·{' '}
          {statusText}
        </Text>
      </View>

      <Button
        testID="water-now"
        label="Water now"
        onPress={() => mutate((db) => waterPlant(db, id))}
      />

      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <Text variant="heading">Watering history</Text>
        {waterings?.length ? (
          waterings.map((w) => (
            <View key={w.id} style={styles.historyRow}>
              <Text style={styles.flex}>{formatDate(w.wateredAt)}</Text>
              <Button
                label="Undo"
                accessibilityLabel={`Remove watering on ${formatDate(w.wateredAt)}`}
                variant="secondary"
                onPress={() => mutate((db) => deleteWatering(db, w.id))}
              />
            </View>
          ))
        ) : (
          <Text muted>Not watered yet.</Text>
        )}
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <Text variant="heading">Photos</Text>
        <View style={styles.photoGrid}>
          {photos?.map((p) => (
            <View key={p.id}>
              <PlantPhoto
                photoId={p.id}
                localUri={p.localUri}
                size={96}
                label={`Photo from ${formatDate(p.takenAt)}`}
              />
              {p.uploadState === 'pending' && (
                <Text variant="caption" muted>
                  Waiting to upload
                </Text>
              )}
            </View>
          ))}
        </View>
        <View style={styles.photoButtons}>
          <Button
            label="Take photo"
            variant="secondary"
            style={styles.flex}
            onPress={() => addPhotoFrom('camera')}
          />
          <Button
            label="Choose photo"
            variant="secondary"
            style={styles.flex}
            onPress={() => addPhotoFrom('library')}
          />
        </View>
      </View>

      <Button
        label="Edit plant"
        variant="secondary"
        onPress={() => router.push({ pathname: '/plants/[id]/edit', params: { id } })}
      />
      <Button testID="delete-plant" label="Delete plant" variant="danger" onPress={confirmDelete} />
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
