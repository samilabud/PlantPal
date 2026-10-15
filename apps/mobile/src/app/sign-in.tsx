import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  isAppleSignInAvailable,
  isDevSignInEnabled,
  isGoogleSignInConfigured,
  signInDev,
  signInWithApple,
  signInWithGoogle,
} from '@/auth';
import { Button, spacing, Text, useColors } from '@/ui';

type Provider = 'apple' | 'google' | 'dev';

export default function SignInScreen() {
  const colors = useColors();
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [busy, setBusy] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    isAppleSignInAvailable().then(setAppleAvailable);
  }, []);

  async function run(provider: Provider, action: () => Promise<boolean>) {
    setBusy(provider);
    setError(null);
    try {
      await action(); // On success the auth store flips and the router leaves this screen.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text variant="title" accessibilityRole="header">
          PlantPal
        </Text>
        <Text muted>Never forget to water a plant again.</Text>
      </View>

      <View style={styles.actions}>
        {appleAvailable && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={8}
            style={styles.appleButton}
            onPress={() => run('apple', signInWithApple)}
          />
        )}
        {isGoogleSignInConfigured() && (
          <Button
            testID="google-sign-in"
            label="Sign in with Google"
            variant="secondary"
            loading={busy === 'google'}
            disabled={busy !== null}
            onPress={() => run('google', signInWithGoogle)}
          />
        )}
        {isDevSignInEnabled && (
          <Button
            testID="dev-sign-in"
            label="Dev sign-in (test only)"
            variant="secondary"
            loading={busy === 'dev'}
            disabled={busy !== null}
            onPress={() => run('dev', () => signInDev('dev'))}
          />
        )}
        {error && (
          <Text testID="sign-in-error" accessibilityRole="alert" style={{ color: colors.danger }}>
            {error}
          </Text>
        )}
      </View>

      <Text muted variant="caption" style={styles.legal}>
        By signing in you agree to the privacy policy. You can delete your account at any time in
        Settings.
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, padding: spacing.lg, justifyContent: 'space-between' },
  header: { marginTop: spacing.xl, gap: spacing.sm },
  actions: { gap: spacing.md },
  appleButton: { height: 48, width: '100%' },
  legal: { textAlign: 'center' },
});
