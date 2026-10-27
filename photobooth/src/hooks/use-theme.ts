import { useColorScheme } from 'react-native';

import { Themes, type Theme } from '@/constants/theme';

// Follows the system, or the override chosen in Settings (lib/appearance.ts sets it natively).
export function useColors(): Theme {
  return useColorScheme() === 'dark' ? Themes.dark : Themes.light;
}

// Build a StyleSheet from theme colours once per theme, not on every render:
//   const makeStyles = (c: Theme) => StyleSheet.create({ ... });
//   const styles = useStyles(makeStyles);
const cache = new WeakMap<(c: Theme) => unknown, { light?: unknown; dark?: unknown }>();

export function useStyles<T>(factory: (c: Theme) => T): T {
  const c = useColors();
  let entry = cache.get(factory);
  if (!entry) {
    entry = {};
    cache.set(factory, entry);
  }
  entry[c.scheme] ??= factory(c);
  return entry[c.scheme] as T;
}

// Kept for older call sites.
export const useTheme = useColors;
