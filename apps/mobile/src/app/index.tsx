import { Link, router, Stack } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { PlantPhoto } from '@/components/plant-photo';
import { SyncBadge } from '@/components/sync-badge';
import { useLiveQuery } from '@/data/live';
import { mutate } from '@/data/mutations';
import { listPlants, waterPlant, type PlantListItem } from '@/data/plants';
import { describeStatus, wateringStatus } from '@/data/watering';
import { canAddPlant, usePremium } from '@/purchases/limits';
import { syncNow, useSyncStore } from '@/sync/sync-manager';
import { Button, radius, spacing, Text, useColors } from '@/ui';

export default function PlantsScreen() {
  const colors = useColors();
  const { data: plants, loading, error } = useLiveQuery(listPlants, []);
  const [refreshing, setRefreshing] = useState(false);
  const premium = usePremium();
  const limitNotice = useSyncStore((s) => s.limitNotice);

  function addPlant() {
    if (canAddPlant(premium, plants?.length ?? 0)) router.push('/plants/new');
    else router.push({ pathname: '/paywall', params: { reason: 'plants' } });
  }

  async function refresh() {
    setRefreshing(true);
    await syncNow().finally(() => setRefreshing(false));
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: 'My plants',
          headerRight: () => (
            <Link href="/settings" accessibilityLabel="Open settings" testID="open-settings">
              <Text style={{ color: colors.primary }}>Settings</Text>
            </Link>
          ),
        }}
      />
      {/* Its own row, not the header: long states like "Offline · 3 to sync" never collide with the title. */}
      <View style={[styles.statusRow, { borderColor: colors.border }]}>
        <SyncBadge />
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={[styles.center, { color: colors.danger }]}>
          Could not read your plants: {error.message}
        </Text>
      ) : loading ? null : (
        <FlatList
          testID="plant-list"
          data={plants}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => <PlantRow plant={item} />}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text variant="heading">No plants yet</Text>
              <Text muted>
                Add your first plant and PlantPal will remind you when it needs water.
              </Text>
            </View>
          }
        />
      )}
      <View style={styles.footer}>
        {limitNotice && (
          <Text accessibilityRole="alert" style={{ color: colors.danger }}>
            {"Some new items weren't saved: the free plan limit was reached on another device."}
          </Text>
        )}
        <Button testID="add-plant" label="Add plant" onPress={addPlant} />
      </View>
    </View>
  );
}

function PlantRow({ plant }: { plant: PlantListItem }) {
  const colors = useColors();
  const status = wateringStatus(plant.lastWateredAt, plant.wateringIntervalDays);
  const statusText = describeStatus(status);
  const urgent = status.state === 'overdue' || status.state === 'today' || status.state === 'never';

  return (
    <View style={[styles.row, { backgroundColor: colors.surface }]}>
      <Pressable
        style={styles.rowMain}
        accessibilityRole="button"
        accessibilityLabel={`${plant.name}. ${statusText}. Open details.`}
        onPress={() => router.push({ pathname: '/plants/[id]', params: { id: plant.id } })}>
        <PlantPhoto
          photoId={plant.coverPhotoId}
          localUri={plant.coverLocalUri}
          size={56}
          label={`Photo of ${plant.name}`}
        />
        <View style={styles.rowText}>
          <Text variant="heading" numberOfLines={1}>
            {plant.name}
          </Text>
          <Text style={{ color: urgent ? colors.danger : colors.textMuted }}>{statusText}</Text>
        </View>
      </Pressable>
      <Button
        label="Water"
        accessibilityLabel={`Mark ${plant.name} as watered`}
        variant={urgent ? 'primary' : 'secondary'}
        onPress={() => mutate((db) => waterPlant(db, plant.id))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  statusRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    alignItems: 'flex-end',
  },
  list: { padding: spacing.md, gap: spacing.sm, flexGrow: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowText: { flex: 1, gap: 2 },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
  },
  center: { padding: spacing.lg },
  footer: { padding: spacing.md },
});
