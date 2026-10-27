import { Tabs } from 'expo-router/js-tabs';
import { View } from 'react-native';

import { FloatingBlobs } from '@/components/floating';
import { PixTabBar } from '@/components/tab-bar';
import { useColors } from '@/hooks/use-theme';

export default function TabsLayout() {
  const c = useColors();
  return (
    // One shared, continuously drifting background behind every tab; scenes are transparent.
    <View style={{ flex: 1, backgroundColor: c.canvas }}>
      <FloatingBlobs />
      <Tabs
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
