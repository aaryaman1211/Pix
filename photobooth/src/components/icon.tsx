import { SymbolView } from 'expo-symbols';
import type { ColorValue } from 'react-native';

import { useTextColor } from '@/components/themed-text';

// SF Symbols on iOS, Material Symbols on Android and web.
const ICONS = {
  pin: { ios: 'mappin.and.ellipse', android: 'location_on' },
  compass: { ios: 'safari', android: 'explore' },
  photo: { ios: 'photo', android: 'image' },
  calendar: { ios: 'calendar', android: 'calendar_today' },
  settings: { ios: 'gearshape', android: 'settings' },
  search: { ios: 'magnifyingglass', android: 'search' },
  plus: { ios: 'plus', android: 'add' },
  close: { ios: 'xmark', android: 'close' },
  check: { ios: 'checkmark', android: 'check' },
  heart: { ios: 'heart.fill', android: 'favorite' },
  chevronDown: { ios: 'chevron.down', android: 'expand_more' },
  chevronRight: { ios: 'chevron.right', android: 'chevron_right' },
  sparkle: { ios: 'sparkle', android: 'auto_awesome' },
  star: { ios: 'star.fill', android: 'star' },
  map: { ios: 'map', android: 'map' },
  share: { ios: 'square.and.arrow.up', android: 'share' },
  trash: { ios: 'trash', android: 'delete' },
  pencil: { ios: 'pencil', android: 'edit' },
  globe: { ios: 'globe', android: 'language' },
  sun: { ios: 'sun.max', android: 'light_mode' },
  moon: { ios: 'moon', android: 'dark_mode' },
  phone: { ios: 'iphone', android: 'smartphone' },
  grid: { ios: 'square.grid.2x2', android: 'grid_view' },
  laptop: { ios: 'laptopcomputer', android: 'laptop_mac' },
} as const;

export type IconName = keyof typeof ICONS;

// Defaults to the current text colour (dark on pastel cards, theme ink elsewhere).
export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color?: ColorValue }) {
  const fallback = useTextColor();
  const { ios, android } = ICONS[name];
  return (
    <SymbolView
      name={{ ios, android, web: android }}
      size={size}
      tintColor={color ?? fallback}
      weight="semibold"
      style={{ width: size, height: size }}
    />
  );
}
