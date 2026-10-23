import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
  DMSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/dm-sans';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

import { Font, Palette } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/lib/auth';
import { GroupProvider, useGroups } from '@/lib/groups';

SplashScreen.preventAutoHideAsync();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: Palette.ink,
    background: Palette.canvas,
    card: Palette.canvas,
    text: Palette.ink,
    border: Palette.line,
  },
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    DMSans_800ExtraBold,
  });

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style="dark" />
      <AuthProvider>
        <GroupProvider>
          <RootStack fontsReady={fontsLoaded || !!fontError} />
        </GroupProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

function RootStack({ fontsReady }: { fontsReady: boolean }) {
  const { session, loading: authLoading } = useAuth();
  const { groups, loading: groupsLoading } = useGroups();
  const signedIn = !!session;
  const groupsPending = signedIn && groupsLoading;
  const hasGroup = groups.length > 0;

  // Hold the splash screen only for the very first load. After that the Stack stays mounted, and
  // while groups load after signing in, the sign-in screen stays up so the guards flip exactly once
  // (sign-in -> app or onboarding).
  const [booted, setBooted] = useState(false);
  const ready = fontsReady && !authLoading && !groupsPending;
  useEffect(() => {
    if (ready && !booted) {
      setBooted(true);
      SplashScreen.hideAsync();
    }
  }, [ready, booted]);

  if (!booted) return null;

  return (
    <Stack
      screenOptions={{
        headerBackButtonDisplayMode: 'minimal',
        headerShadowVisible: false,
        headerTintColor: Palette.ink,
        headerStyle: { backgroundColor: Palette.canvas },
        headerTitleStyle: { fontFamily: Font.bold, fontSize: 17, color: Palette.ink },
        contentStyle: { backgroundColor: Palette.canvas },
      }}>
      <Stack.Protected guard={!signedIn || groupsPending}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={signedIn && !groupsPending && !hasGroup}>
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={signedIn && !groupsPending && hasGroup}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="search" options={{ presentation: 'modal', title: 'Find a place' }} />
        <Stack.Screen name="place/[id]" options={{ title: '' }} />
        <Stack.Screen name="memory/new" options={{ presentation: 'modal', title: 'New memory' }} />
        <Stack.Screen name="memory/[id]" options={{ title: '' }} />
        <Stack.Screen name="date/new" options={{ presentation: 'modal', title: 'Important date' }} />
        <Stack.Screen name="groups" options={{ presentation: 'modal', title: 'Your groups' }} />
      </Stack.Protected>
    </Stack>
  );
}
