import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
  DMSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/dm-sans';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

import { LaunchAnimation } from '@/components/launch-animation';
import { Font, Themes } from '@/constants/theme';
import { useColors } from '@/hooks/use-theme';
import { loadAppearance } from '@/lib/appearance';
import { AuthProvider, useAuth } from '@/lib/auth';
import { GroupProvider, useGroups } from '@/lib/groups';

SplashScreen.preventAutoHideAsync();

// Apply the saved Light/Dark/System choice before the first screen draws.
const appearanceReady = loadAppearance();

// The launch animation plays once per JS start, i.e. only when the app was fully closed, not when
// it comes back from the background.
let launchPlayed = false;

function navTheme(scheme: 'light' | 'dark') {
  const c = Themes[scheme];
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: { ...base.colors, primary: c.text, background: c.canvas, card: c.canvas, text: c.text, border: c.line },
  };
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    DMSans_800ExtraBold,
  });
  const [appearanceLoaded, setAppearanceLoaded] = useState(false);
  useEffect(() => {
    appearanceReady.finally(() => setAppearanceLoaded(true));
  }, []);
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';

  return (
    <ThemeProvider value={navTheme(scheme)}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <AuthProvider>
        <GroupProvider>
          <RootStack fontsReady={(fontsLoaded || !!fontError) && appearanceLoaded} />
        </GroupProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

function RootStack({ fontsReady }: { fontsReady: boolean }) {
  const c = useColors();
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

  const [launching, setLaunching] = useState(!launchPlayed);
  const endLaunch = () => {
    launchPlayed = true;
    setLaunching(false);
  };

  if (!booted) return null;

  return (
    <>
      <Stack
        screenOptions={{
          headerBackButtonDisplayMode: 'minimal',
          headerShadowVisible: false,
          headerTintColor: c.text,
          headerStyle: { backgroundColor: c.canvas },
          headerTitleStyle: { fontFamily: Font.bold, fontSize: 17, color: c.text },
          contentStyle: { backgroundColor: c.canvas },
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
          <Stack.Screen name="place/preview" options={{ title: '' }} />
          <Stack.Screen name="memory/new" options={{ presentation: 'modal', title: 'New memory' }} />
          <Stack.Screen name="memory/[id]" options={{ title: '' }} />
          <Stack.Screen name="date/new" options={{ presentation: 'modal', title: 'Important date' }} />
          <Stack.Screen name="groups" options={{ presentation: 'modal', title: 'Your groups' }} />
        </Stack.Protected>
      </Stack>
      {launching && <LaunchAnimation onDone={endLaunch} />}
    </>
  );
}
