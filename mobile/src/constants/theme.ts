/**
 * Pix design tokens, from the "claude" mockup in /pia-ui: warm off-white canvas, near-black ink,
 * and a set of soft pastels used for cards, tab highlights and buttons.
 */

import '@/global.css';

export const Palette = {
  canvas: '#FAFAF7',
  ink: '#16161A',
  inkSoft: '#3A3A42',
  muted: '#6E6E76',
  track: '#EDECE7',
  line: '#E6E4DE',
  white: '#FFFFFF',
  salmon: '#F0907B',
  yellow: '#F9DA67',
  lavender: '#B6A8F9',
  mint: '#9CE1C0',
  sky: '#9CCAFA',
  danger: '#C8382F',
} as const;

// Order matters: lists cycle through these, matching the mockup's rhythm.
export const Pastels = [Palette.salmon, Palette.yellow, Palette.lavender, Palette.mint, Palette.sky] as const;

export function pastelAt(index: number): string {
  return Pastels[((index % Pastels.length) + Pastels.length) % Pastels.length];
}

// Stable colour for something that should look the same everywhere (a member, a place).
export function pastelFor(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return pastelAt(Math.abs(hash));
}

// Each tab has its own accent (active tab circle, floating button).
export const TabAccent = {
  places: Palette.salmon,
  discover: Palette.lavender,
  memories: Palette.yellow,
  dates: Palette.mint,
  settings: Palette.sky,
} as const;

// The app is light-only for now (the design is built around the light canvas); `dark` mirrors
// `light` so callers that index by colour scheme keep working.
const light = {
  text: Palette.ink,
  textSecondary: Palette.muted,
  background: Palette.canvas,
  backgroundElement: Palette.track,
  backgroundSelected: Palette.line,
  card: Palette.white,
  border: Palette.line,
  accent: Palette.ink,
  onAccent: Palette.white,
  danger: Palette.danger,
  star: Palette.ink,
};

export const Colors = { light, dark: light } as const;

export type ThemeColor = keyof typeof light;

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
