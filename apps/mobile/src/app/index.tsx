import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';

import { LimitNotice } from '@/components/limit-notice';
import { PlantPhoto } from '@/components/plant-photo';
import { SyncBadge } from '@/components/sync-badge';
import { hasSeen } from '@/data/first-run';
import { useLiveQuery } from '@/data/live';
import { getDb } from '@/db/database';
import { mutate } from '@/data/mutations';
import { listPlants, waterPlant, type PlantListItem } from '@/data/plants';
import { describeStatus, wateringStatus } from '@/data/watering';
import { canAddPlant, usePremium } from '@/purchases/limits';
import { syncNow } from '@/sync/sync-manager';
import { Button, Logo, radius, spacing, Text, useColors } from '@/ui';

export default function PlantsScreen() {
  const colors = useColors();
  const { data: plants, loading, error } = useLiveQuery(listPlants, []);
  const [refreshing, setRefreshing] = useState(false);
  const premium = usePremium();

  // First time on this phone for this account: show what the app can do, once.
  useEffect(() => {
    getDb()
      .then((db) => hasSeen(db, 'seenGuide'))
      .then((seen) => !seen && router.push('/guide'))
      .catch(() => undefined);
  }, []);

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
          title: 'My plants', // still used as the back-button label on child screens
          headerTitle: () => <Logo variant="horizontal" height={30} />,
          headerRight: () => (
            <Pressable
              onPress={() => router.push('/settings')}
              accessibilityRole="button"
              accessibilityLabel="Open settings"
              testID="open-settings"
              hitSlop={12}
              style={{ padding: spacing.xs }}>
              <Text style={{ color: colors.primary }}>Settings</Text>
            </Pressable>
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
      ) : loading ? (
        <ActivityIndicator style={styles.center} accessibilityLabel="Loading your plants" />
      ) : (
        <FlatList
          testID="plant-list"
          data={plants}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => <PlantRow plant={item} />}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            plants?.length ? (
              <Text variant="heading" accessibilityRole="header">
                My plants ({plants.length})
              </Text>
            ) : null
          }
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Logo variant="stacked" height={150} />
              <Text variant="heading">No plants yet</Text>
              <Text muted>
                Add your first plant and PlantPal will remind you when it needs water.
              </Text>
              <Button
                testID="empty-open-guide"
                label="See what PlantPal can do"
                variant="secondary"
                onPress={() => router.push('/guide')}
              />
            </View>
          }
        />
      )}
      <View style={styles.footer}>
        <LimitNotice />
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
