/**
 * Pix design tokens, from the "claude" mockup in /pia-ui: warm canvas, near-black ink and soft pastels.
 *
 * Colours that change between light and dark live in `Themes` and are read with `useColors()` /
 * `useStyles()` (hooks/use-theme.ts). Pastels are the same in both themes; anything drawn on a pastel
 * uses `OnPastel`, so cards look the same in light and dark (dark text on a bright card).
 */

import '@/global.css';

export const Pastel = {
  salmon: '#F0907B',
  yellow: '#F9DA67',
  lavender: '#B6A8F9',
  mint: '#9CE1C0',
  sky: '#9CCAFA',
} as const;

// Order matters: lists cycle through these, matching the mockup's rhythm.
export const Pastels = [Pastel.salmon, Pastel.yellow, Pastel.lavender, Pastel.mint, Pastel.sky] as const;

export function pastelAt(index: number): string {
  return Pastels[((index % Pastels.length) + Pastels.length) % Pastels.length];
}

// Stable colour for something that should look the same everywhere (a member, a place).
export function pastelFor(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return pastelAt(Math.abs(hash));
}

// Ink, chips and buttons on top of a pastel card, in either theme.
export const OnPastel = {
  text: '#16161A',
  soft: '#3A3A42',
  muted: '#55555C',
  chip: '#FFFFFF',
  button: '#16161A',
  onButton: '#FFFFFF',
} as const;

// Each tab has its own accent (active tab circle, floating button).
export const TabAccent = {
  places: Pastel.salmon,
  discover: Pastel.lavender,
  memories: Pastel.yellow,
  dates: Pastel.mint,
  settings: Pastel.sky,
} as const;

const light = {
  scheme: 'light' as const,
  canvas: '#FAFAF7',
  surface: '#FFFFFF',
  track: '#EDECE7',
  line: '#E6E4DE',
  text: '#16161A',
  textSoft: '#3A3A42',
  textMuted: '#6E6E76',
  primary: '#16161A',
  onPrimary: '#FFFFFF',
  danger: '#C8382F',
  tabBar: '#16161A',
  tabIcon: '#C9C9CF',
  shadow: '#000000',
};

export type Theme = Omit<typeof light, 'scheme'> & { scheme: 'light' | 'dark' };

const dark: Theme = {
  scheme: 'dark',
  canvas: '#111113',
  surface: '#1C1C20',
  track: '#26262B',
  line: '#2E2E34',
  text: '#F4F3EF',
  textSoft: '#CFCEC9',
  textMuted: '#9A9AA2',
  primary: '#F4F3EF',
  onPrimary: '#16161A',
  danger: '#FF7A70',
  tabBar: '#232328',
  tabIcon: '#8E8E96',
  shadow: '#000000',
};

export const Themes = { light, dark } as const;

export const Font = {
  regular: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  semibold: 'DMSans_600SemiBold',
  bold: 'DMSans_700Bold',
  heavy: 'DMSans_800ExtraBold',
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  card: 28,
  tile: 24,
  field: 18,
  pill: 999,
} as const;

export const MaxContentWidth = 800;
