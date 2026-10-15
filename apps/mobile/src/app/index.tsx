import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { getHealth } from '@/api';
import { env } from '@/config/env';
import { radius, Screen, spacing, Text, useColors } from '@/ui';

/** M1 home screen: proves the app, the typed API client and the backend talk to each other. */
export default function HomeScreen() {
  const colors = useColors();
  const health = useQuery({ queryKey: ['health'], queryFn: getHealth });

  return (
    <Screen>
      <Text variant="title" accessibilityRole="header">
        PlantPal
      </Text>
      <Text muted>Foundation build ({env.appVariant})</Text>

      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <Text variant="heading">Backend</Text>
        <Text muted variant="caption" selectable>
          {env.apiUrl}
        </Text>
        {health.isPending && <ActivityIndicator accessibilityLabel="Checking backend" />}
        {health.isSuccess && (
          <Text testID="health-status">
            API {health.data.status} · database {health.data.db} · v{health.data.version}
          </Text>
        )}
        {health.isError && (
          <Text testID="health-error" style={{ color: colors.danger }}>
            Could not reach the API: {health.error.message}
          </Text>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Check backend again"
          onPress={() => health.refetch()}
          style={[styles.button, { backgroundColor: colors.primary }]}>
          <Text style={{ color: colors.onPrimary }}>Check again</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.md, borderRadius: radius.md, gap: spacing.sm },
  button: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
});
