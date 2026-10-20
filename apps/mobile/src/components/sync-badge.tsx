import { Pressable } from 'react-native';

import { requestSync, useSyncStore } from '@/sync/sync-manager';
import { useT } from '@/i18n';
import { Text, useColors } from '@/ui';

/** Always tells the user whether their changes are safe on the server. Tap to sync now. */
export function SyncBadge() {
  const colors = useColors();
  const t = useT();
  const { status, pending } = useSyncStore();

  const label =
    status === 'syncing'
      ? t('sync.syncing')
      : status === 'offline'
        ? pending
          ? t('sync.offlinePending', { count: pending })
          : t('sync.offline')
        : status === 'error'
          ? t('sync.failed')
          : pending
            ? t('sync.pending', { count: pending })
            : t('sync.synced');
  const color =
    status === 'error' ? colors.danger : status === 'offline' ? colors.textMuted : colors.primary;

  return (
    <Pressable
      testID="sync-badge"
      accessibilityRole="button"
      accessibilityLabel={t('sync.label', { status: label })}
      onPress={() => requestSync({ immediate: true })}
      hitSlop={8}>
      <Text variant="caption" style={{ color }}>
        {label}
      </Text>
    </Pressable>
  );
}
