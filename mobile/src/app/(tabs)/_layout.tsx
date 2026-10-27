import { Tabs } from 'expo-router/js-tabs';
import { useIsFocused } from 'expo-router';
import { Platform, View, type ViewProps } from 'react-native';

import { FloatingBlobs } from '@/components/floating';
import { PixTabBar } from '@/components/tab-bar';
import { useColors } from '@/hooks/use-theme';

// On web the inactive tab scenes stay mounted and, being transparent, would draw on top of each
// other. Hide (not unmount, so state is kept) every scene that isn't the focused tab.
function WebSceneVisibility({ children }: ViewProps) {
  const focused = useIsFocused();
  return <View style={{ flex: 1, display: focused ? 'flex' : 'none' }}>{children}</View>;
}

export default function TabsLayout() {
  const c = useColors();
  return (
    // One shared, continuously drifting background behind every tab; scenes are transparent.
    <View style={{ flex: 1, backgroundColor: c.canvas }}>
      <FloatingBlobs />
      <Tabs
        screenLayout={Platform.OS === 'web' ? ({ children }) => <WebSceneVisibility>{children}</WebSceneVisibility> : undefined}
        tabBar={(props) => <PixTabBar {...props} />}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: 'transparent' } }}>
        <Tabs.Screen name="index" options={{ title: 'Places' }} />
        <Tabs.Screen name="discover" options={{ title: 'Discover' }} />
        <Tabs.Screen name="memories" options={{ title: 'Memories' }} />
        <Tabs.Screen name="dates" options={{ title: 'Dates' }} />
        <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
      </Tabs>
    </View>
  );
}
