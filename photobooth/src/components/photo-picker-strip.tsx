import { Image } from 'expo-image';
import type { ImagePickerAsset } from 'expo-image-picker';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { Icon } from '@/components/icon';
import { PastelScope } from '@/components/pastel';
import { ThemedText } from '@/components/themed-text';
import { Pastel, Radius, Spacing } from '@/constants/theme';
import { pickPhotos } from '@/lib/photos';

// Horizontal strip of picked (not yet uploaded) photos, with an add tile.
export function PhotoPickerStrip({
  assets,
  onChange,
}: {
  assets: ImagePickerAsset[];
  onChange: (assets: ImagePickerAsset[]) => void;
}) {
  async function add() {
    const picked = await pickPhotos();
    if (picked.length) onChange([...assets, ...picked]);
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.strip}
      style={{ marginHorizontal: -Spacing.four }}>
      <PastelScope>
        <Pressable accessibilityRole="button" accessibilityLabel="Add photos" onPress={add} style={[styles.tile, styles.addTile]}>
          <Icon name="photo" size={26} />
          <ThemedText type="smallBold">{assets.length ? 'More' : 'Add photos'}</ThemedText>
        </Pressable>
      </PastelScope>
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
  strip: { gap: Spacing.two, paddingHorizontal: Spacing.four },
  tile: { width: 120, height: 150, borderRadius: Radius.tile },
  addTile: { alignItems: 'center', justifyContent: 'center', gap: Spacing.two, backgroundColor: Pastel.yellow },
});
