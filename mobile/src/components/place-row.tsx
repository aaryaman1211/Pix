import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { prettyType, priceLabel } from '@/lib/format';

type Props = {
  name: string;
  type?: string | null;
  priceLevel?: number | null;
  rating?: number | null;
  subtitle?: string | null;
  note?: string;
  right?: ReactNode;
  onPress?: () => void;
};

export function PlaceRow({ name, type, priceLevel, rating, subtitle, note, right, onPress }: Props) {
  const meta = [prettyType(type), priceLabel(priceLevel), rating ? `${rating.toFixed(1)}★` : '']
    .filter(Boolean)
    .join(' · ');
  return (
    <Card onPress={onPress} style={styles.row}>
      <View style={{ flex: 1, gap: 2 }}>
        <ThemedText style={{ fontWeight: '600' }} numberOfLines={1}>
          {name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {meta}
        </ThemedText>
        {subtitle ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {subtitle}
          </ThemedText>
        ) : null}
        {note ? (
          <ThemedText type="small" themeColor="accent" numberOfLines={1}>
            {note}
          </ThemedText>
        ) : null}
      </View>
      {right}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
});
