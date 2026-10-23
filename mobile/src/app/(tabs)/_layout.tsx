import { Tabs } from 'expo-router/js-tabs';

import { PixTabBar } from '@/components/tab-bar';
import { Palette } from '@/constants/theme';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <PixTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: Palette.canvas } }}>
      <Tabs.Screen name="index" options={{ title: 'Places' }} />
      <Tabs.Screen name="discover" options={{ title: 'Discover' }} />
      <Tabs.Screen name="memories" options={{ title: 'Memories' }} />
      <Tabs.Screen name="dates" options={{ title: 'Dates' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
