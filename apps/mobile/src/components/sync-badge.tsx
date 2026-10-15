import { Pressable } from 'react-native';

import { requestSync, useSyncStore } from '@/sync/sync-manager';
import { Text, useColors } from '@/ui';

/** Always tells the user whether their changes are safe on the server. Tap to sync now. */
export function SyncBadge() {
  const colors = useColors();
  const { status, pending } = useSyncStore();

  const label =
    status === 'syncing'
      ? 'Syncing…'
      : status === 'offline'
        ? pending
          ? `Offline · ${pending} to sync`
          : 'Offline'
        : status === 'error'
          ? 'Sync failed · retry'
          : pending
            ? `${pending} to sync`
            : 'Synced';
  const color =
    status === 'error' ? colors.danger : status === 'offline' ? colors.textMuted : colors.primary;

  return (
    <Pressable
      testID="sync-badge"
      accessibilityRole="button"
      accessibilityLabel={`Sync status: ${label}. Tap to sync now.`}
      onPress={() => requestSync({ immediate: true })}
      hitSlop={8}>
      <Text variant="caption" style={{ color }}>
        {label}
      </Text>
    </Pressable>
  );
}
