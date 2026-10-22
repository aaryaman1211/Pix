import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/lib/auth';
import { GroupProvider, useGroups } from '@/lib/groups';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const scheme = useColorScheme();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const theme = {
    ...base,
    colors: { ...base.colors, primary: colors.accent, background: colors.background, card: colors.background },
  };

  return (
    <ThemeProvider value={theme}>
      <AuthProvider>
        <GroupProvider>
          <RootStack />
        </GroupProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

function RootStack() {
  const { session, loading: authLoading } = useAuth();
  const { groups, loading: groupsLoading } = useGroups();
  const ready = !authLoading && !(session && groupsLoading);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  const signedIn = !!session;
  const hasGroup = groups.length > 0;

  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal', headerShadowVisible: false }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={signedIn && !hasGroup}>
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={signedIn && hasGroup}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="search" options={{ presentation: 'modal', title: 'Add a place' }} />
        <Stack.Screen name="place/[id]" options={{ title: '' }} />
        <Stack.Screen name="memory/new" options={{ presentation: 'modal', title: 'New memory' }} />
        <Stack.Screen name="memory/[id]" options={{ title: '' }} />
        <Stack.Screen name="date/new" options={{ presentation: 'modal', title: 'Important date' }} />
        <Stack.Screen name="groups" options={{ presentation: 'modal', title: 'Your groups' }} />
      </Stack.Protected>
    </Stack>
  );
}
