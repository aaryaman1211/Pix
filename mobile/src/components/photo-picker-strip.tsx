import { Image } from 'expo-image';
import type { ImagePickerAsset } from 'expo-image-picker';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { pickPhotos } from '@/lib/photos';

// Horizontal strip of picked (not yet uploaded) photos, with an add tile.
export function PhotoPickerStrip({
  assets,
  onChange,
}: {
  assets: ImagePickerAsset[];
  onChange: (assets: ImagePickerAsset[]) => void;
}) {
  const theme = useTheme();

  async function add() {
    const picked = await pickPhotos();
    if (picked.length) onChange([...assets, ...picked]);
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add photos"
        onPress={add}
        style={[styles.tile, styles.addTile, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
        <ThemedText style={{ fontSize: 28 }}>+</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Photos
        </ThemedText>
      </Pressable>
      {assets.map((a, i) => (
        <Pressable
          key={`${a.uri}-${i}`}
          accessibilityLabel="Remove photo"
          onLongPress={() => onChange(assets.filter((_, j) => j !== i))}>
          <Image source={{ uri: a.uri }} style={styles.tile} contentFit="cover" />
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  strip: { gap: Spacing.two },
  tile: { width: 96, height: 96, borderRadius: 12 },
  addTile: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed' },
});
