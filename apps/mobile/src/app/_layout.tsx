import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

import { restoreSession, useAuthStore } from '@/auth';
import '@/notifications/notifications'; // sets the foreground notification handler
import { useNotificationNavigation, useReminderScheduler } from '@/notifications/use-notifications';
import { startSyncTriggers } from '@/sync/sync-manager';
import { createQueryClient } from '@/query-client';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const scheme = useColorScheme();
  const [queryClient] = useState(createQueryClient);
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    restoreSession();
  }, []);

  useNotificationNavigation(status === 'signedIn');
  useReminderScheduler(status === 'signedIn');

  // Sync runs only while signed in: at start, on reconnect and when the app comes to the front.
  useEffect(() => {
    if (status === 'signedIn') return startSyncTriggers();
  }, [status]);

  useEffect(() => {
    if (status !== 'loading') SplashScreen.hideAsync();
    // Never show one user's cached data to the next user.
    if (status === 'signedOut') queryClient.clear();
  }, [status, queryClient]);

  // Keep the splash screen up until we know whether the user is signed in.
  if (status === 'loading') return null;
  const signedIn = status === 'signedIn';

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
        {/* Protected screens: when a guard turns false, Expo Router removes those screens
            from history and redirects to the first allowed screen. */}
        <Stack>
          <Stack.Protected guard={!signedIn}>
            <Stack.Screen name="sign-in" options={{ headerShown: false }} />
          </Stack.Protected>
          <Stack.Protected guard={signedIn}>
            <Stack.Screen name="index" options={{ title: 'My plants' }} />
            <Stack.Screen name="plants/new" options={{ title: 'New plant' }} />
            <Stack.Screen name="plants/[id]/index" options={{ title: 'Plant' }} />
            <Stack.Screen name="plants/[id]/edit" options={{ title: 'Edit plant' }} />
            <Stack.Screen name="settings" options={{ title: 'Settings' }} />
          </Stack.Protected>
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
