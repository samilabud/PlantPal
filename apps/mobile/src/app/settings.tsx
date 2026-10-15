import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { deleteAccount, signOut, useAuthStore } from '@/auth';
import { Button, radius, Screen, spacing, Text, useColors } from '@/ui';

export default function SettingsScreen() {
  const colors = useColors();
  const user = useAuthStore((s) => s.user);
  const [busy, setBusy] = useState<'signOut' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSignOut() {
    setBusy('signOut');
    await signOut();
  }

  function onDelete() {
    Alert.alert(
      'Delete account?',
      'This permanently deletes your account and all your plants on every device. It cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusy('delete');
            setError(null);
            try {
              await deleteAccount();
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Could not delete the account');
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  }

  return (
    <Screen>
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <Text variant="heading">Account</Text>
        <Text testID="account-email">{user?.email ?? 'No email shared'}</Text>
        <Text muted>Signed in with: {user?.providers.join(', ')}</Text>
        <Text muted>Plan: {user?.plan}</Text>
      </View>

      <Button
        testID="sign-out"
        label="Sign out"
        variant="secondary"
        loading={busy === 'signOut'}
        disabled={busy !== null}
        onPress={onSignOut}
      />
      <Button
        testID="delete-account"
        label="Delete account"
        variant="danger"
        loading={busy === 'delete'}
        disabled={busy !== null}
        onPress={onDelete}
      />
      {error && (
        <Text accessibilityRole="alert" style={{ color: colors.danger }}>
          {error}
        </Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.md, borderRadius: radius.md, gap: spacing.xs },
});
