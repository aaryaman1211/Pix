import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { prettyType, priceLabel } from '@/lib/format';

type Props = {
  name: string;
  type?: string | null;
  priceLevel?: number | null;
  rating?: number | null;
  distance?: string | null;
  subtitle?: string | null;
  color?: string;
  right?: ReactNode;
  onPress?: () => void;
};

// A place as a rounded card: pastel on the Places list, white in search results.
export function PlaceRow({ name, type, priceLevel, rating, distance, subtitle, color = Palette.white, right, onPress }: Props) {
  const meta = [prettyType(type), priceLabel(priceLevel), rating ? `${rating.toFixed(1)} ★` : '', distance ?? '']
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: color },
        color === Palette.white && styles.outline,
        pressed && { transform: [{ scale: 0.985 }] },
      ]}>
      <View style={{ flex: 1, gap: 4 }}>
        <ThemedText style={styles.name} numberOfLines={1}>
          {name}
        </ThemedText>
        <ThemedText type="small" style={{ color: Palette.inkSoft }} numberOfLines={1}>
          {meta}
        </ThemedText>
        {subtitle ? (
          <ThemedText type="small" style={{ color: Palette.muted }} numberOfLines={1}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {right}
    </Pressable>
  );
}

// White circle with a member's initial: who added the place.
export function InitialBadge({ initial }: { initial: string }) {
  return (
    <View style={styles.badge}>
      <ThemedText type="smallBold">{initial}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Radius.tile,
    paddingVertical: Spacing.four - 2,
    paddingHorizontal: Spacing.four - 4,
  },
  outline: { borderWidth: 1, borderColor: Palette.line },
  name: { fontSize: 20, lineHeight: 25, fontWeight: '700', letterSpacing: -0.3 },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Palette.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
