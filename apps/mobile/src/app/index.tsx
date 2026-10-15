import { useQuery } from '@tanstack/react-query';
import { Link, Stack } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { getHealth, getMe } from '@/api';
import { useAuthStore } from '@/auth';
import { tokenStore } from '@/auth/token-store';
import { env } from '@/config/env';
import { Button, radius, Screen, spacing, Text, useColors } from '@/ui';

export default function HomeScreen() {
  const colors = useColors();
  const user = useAuthStore((s) => s.user);
  const health = useQuery({ queryKey: ['health'], queryFn: getHealth });
  // Re-read the profile on open (plan may have changed); this also exercises the auth client.
  const me = useQuery({ queryKey: ['me'], queryFn: getMe });

  useEffect(() => {
    if (me.data) {
      useAuthStore.getState().setUser(me.data);
      tokenStore.setUser(me.data);
    }
  }, [me.data]);

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Link href="/settings" accessibilityLabel="Open settings" testID="open-settings">
              <Text style={{ color: colors.primary }}>Settings</Text>
            </Link>
          ),
        }}
      />
      <Text variant="title" accessibilityRole="header">
        Hello{user?.email ? `, ${user.email}` : ''}
      </Text>
      <Text muted testID="plan-label">
        Plan: {user?.plan ?? '…'} · build: {env.appVariant}
      </Text>

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
        <Button
          label="Check again"
          accessibilityLabel="Check backend again"
          onPress={() => health.refetch()}
          style={styles.button}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.md, borderRadius: radius.md, gap: spacing.sm },
  button: { alignSelf: 'flex-start' },
});
