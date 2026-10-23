import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { TAB_BAR_HEIGHT, tabBarBottom } from '@/components/ui';
import { Palette, Spacing, TabAccent } from '@/constants/theme';

const TABS: Record<string, { icon: IconName; label: string; accent: string }> = {
  index: { icon: 'pin', label: 'Places', accent: TabAccent.places },
  discover: { icon: 'compass', label: 'Discover', accent: TabAccent.discover },
  memories: { icon: 'photo', label: 'Memories', accent: TabAccent.memories },
  dates: { icon: 'calendar', label: 'Dates', accent: TabAccent.dates },
  settings: { icon: 'settings', label: 'Settings', accent: TabAccent.settings },
};

// Floating black pill; the active tab sits in a circle of its own accent colour.
export function PixTabBar({ state, navigateToTab, insets }: BottomTabBarProps) {
  return (
    <View style={[styles.bar, { bottom: tabBarBottom(insets.bottom) }]} accessibilityRole="tablist">
      {state.routes.map((route, i) => {
        const tab = TABS[route.name];
        if (!tab) return null;
        const focused = state.index === i;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: focused }}
            onPress={() => !focused && navigateToTab(route.key)}
            style={styles.item}>
            <View style={[styles.circle, focused && { backgroundColor: tab.accent }]}>
              <Icon name={tab.icon} size={22} color={focused ? Palette.ink : '#C9C9CF'} />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    height: TAB_BAR_HEIGHT,
    borderRadius: TAB_BAR_HEIGHT / 2,
    backgroundColor: Palette.ink,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  circle: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
});
