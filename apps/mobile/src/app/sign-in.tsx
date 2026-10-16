import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { Linking, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  isAppleSignInAvailable,
  isDevSignInEnabled,
  isGoogleSignInConfigured,
  signInDev,
  signInWithApple,
  signInWithGoogle,
} from '@/auth';
import { PRIVACY_URL } from '@/config/site';
import { Button, Logo, spacing, Text, useColors } from '@/ui';
import { describeUpdate } from '@/updates/describe-update';

type Provider = 'apple' | 'google' | 'dev';

export default function SignInScreen() {
  const colors = useColors();
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [busy, setBusy] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Dev builds only: lets E2E tests (and you) sign in as separate test users.
  const [devName, setDevName] = useState(''); // empty = the default "dev" user

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
        <Logo variant="stacked" height={200} />
        <Text muted accessibilityRole="header">
          Never forget to water a plant again.
        </Text>
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
          <TextInput
            testID="dev-user-name"
            accessibilityLabel="Test user name"
            value={devName}
            onChangeText={(t) =>
              setDevName(
                t
                  .toLowerCase()
                  .replace(/[^a-z0-9-]/g, '')
                  .slice(0, 32),
              )
            }
            placeholder="dev"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.devInput, { borderColor: colors.border, color: colors.text }]}
          />
        )}
        {isDevSignInEnabled && (
          <Button
            testID="dev-sign-in"
            label="Dev sign-in (test only)"
            variant="secondary"
            loading={busy === 'dev'}
            disabled={busy !== null}
            onPress={() => run('dev', () => signInDev(devName || 'dev'))}
          />
        )}
        {error && (
          <Text testID="sign-in-error" accessibilityRole="alert" style={{ color: colors.danger }}>
            {error}
          </Text>
        )}
      </View>

      <View style={styles.footer}>
        <Text muted variant="caption" style={styles.center}>
          By signing in you agree to the{' '}
          <Text
            variant="caption"
            accessibilityRole="link"
            style={{ color: colors.primary, textDecorationLine: 'underline' }}
            onPress={() => Linking.openURL(PRIVACY_URL)}>
            privacy policy
          </Text>
          . You can delete your account at any time in Settings.
        </Text>
        <Text muted variant="caption" style={styles.center} testID="app-version">
          {describeUpdate()}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, padding: spacing.lg, justifyContent: 'space-between' },
  header: { marginTop: spacing.xl, gap: spacing.md, alignItems: 'center' },
  actions: { gap: spacing.md },
  appleButton: { height: 48, width: '100%' },
  devInput: { borderWidth: 1, borderRadius: 8, padding: spacing.sm, minHeight: 44, fontSize: 16 },
  footer: { gap: spacing.xs },
  center: { textAlign: 'center' },
});
