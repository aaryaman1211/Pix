import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
  DMSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/dm-sans';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { KeyboardDoneBar } from '@/components/keyboard-done';
import { LaunchAnimation } from '@/components/launch-animation';
import { Font, Themes } from '@/constants/theme';
import { useColors } from '@/hooks/use-theme';
import { loadAppearance } from '@/lib/appearance';
import { AuthProvider, useAuth } from '@/lib/auth';
import { GroupProvider, useGroups } from '@/lib/groups';
import { registerForPush } from '@/lib/push';
import { syncReminders } from '@/lib/reminders';
import { syncThrowbacks } from '@/lib/throwbacks';

SplashScreen.preventAutoHideAsync();

// Apply the saved Light/Dark/System choice before the first screen draws.
const appearanceReady = loadAppearance();

// Notification taps only exist on phones; web has no last-response API at all.
const useLastNotificationResponse =
  Platform.OS === 'web' ? () => null : Notifications.useLastNotificationResponse;

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
    <GestureHandlerRootView style={{ flex: 1 }}>
    <ThemeProvider value={navTheme(scheme)}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <AuthProvider>
        <GroupProvider>
          <RootStack fontsReady={(fontsLoaded || !!fontError) && appearanceLoaded} />
        </GroupProvider>
      </AuthProvider>
    </ThemeProvider>
    </GestureHandlerRootView>
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

  // Once signed in, (re)schedule this phone's date reminders and photo throwbacks.
  const inApp = booted && signedIn && !groupsPending && hasGroup;
  useEffect(() => {
    if (!inApp) return;
    syncReminders().catch(console.warn);
    syncThrowbacks().catch(console.warn);
    registerForPush().catch(console.warn);
  }, [inApp]);

  // Tapping a notification opens what it's about.
  const response = useLastNotificationResponse();
  useEffect(() => {
    if (!inApp || !response) return;
    const data = response.notification.request.content.data as { memoryId?: string; tab?: string; placeRowId?: string };
    if (data?.memoryId) router.push({ pathname: '/memory/[id]', params: { id: data.memoryId } });
    else if (data?.placeRowId) router.push({ pathname: '/place/[id]', params: { id: data.placeRowId } });
    else if (data?.tab === 'memories') router.navigate('/memories');
    else if (data?.tab === 'dates') router.navigate('/dates');
    else if (data?.tab === 'places') router.navigate('/');
    Notifications.clearLastNotificationResponse();
  }, [inApp, response]);

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
      <KeyboardDoneBar />
      {launching && <LaunchAnimation onDone={endLaunch} />}
    </>
  );
}
