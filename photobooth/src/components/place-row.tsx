import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { PastelScope } from '@/components/pastel';
import { ThemedText } from '@/components/themed-text';
import { OnPastel, Radius, Spacing, type Theme } from '@/constants/theme';
import { useStyles } from '@/hooks/use-theme';
import { prettyType, priceLabel } from '@/lib/format';

type Props = {
  name: string;
  type?: string | null;
  priceLevel?: number | null;
  rating?: number | null;
  distance?: string | null;
  subtitle?: string | null;
  // A pastel for the Places list; omit for a plain card (search results).
  color?: string;
  right?: ReactNode;
  onPress?: () => void;
};

export function PlaceRow({ name, type, priceLevel, rating, distance, subtitle, color, right, onPress }: Props) {
  const s = useStyles(makeStyles);
  const meta = [prettyType(type), priceLabel(priceLevel), rating ? `${rating.toFixed(1)} ★` : '', distance ?? '']
    .filter(Boolean)
    .join(' · ');
  const card = (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.card,
        color ? { backgroundColor: color } : s.plain,
        pressed && { transform: [{ scale: 0.985 }] },
      ]}>
      <View style={{ flex: 1, gap: 4 }}>
        <ThemedText style={styles.name} numberOfLines={1}>
          {name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSoft" numberOfLines={1}>
          {meta}
        </ThemedText>
        {subtitle ? (
          <ThemedText type="small" themeColor="textMuted" numberOfLines={1}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {right}
    </Pressable>
  );
  return color ? <PastelScope>{card}</PastelScope> : card;
}

// White circle with a member's initial: who added the place.
export function InitialBadge({ initial }: { initial: string }) {
  return (
    <View style={styles.badge}>
      <ThemedText type="smallBold">{initial}</ThemedText>
    </View>
  );
}

const makeStyles = (c: Theme) =>
  StyleSheet.create({
    plain: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.line },
  });

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Radius.tile,
    paddingVertical: Spacing.four - 2,
    paddingHorizontal: Spacing.four - 4,
  },
  name: { fontSize: 20, lineHeight: 25, fontWeight: '700', letterSpacing: -0.3 },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: OnPastel.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
