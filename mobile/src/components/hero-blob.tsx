import { StyleSheet, View } from 'react-native';

import { Palette } from '@/constants/theme';

// The overlapping-circles motif from the Discover card, used as a header decoration.
export function HeroBlob({ height = 220 }: { height?: number }) {
  return (
    <View style={{ height }} pointerEvents="none">
      <View style={[styles.circle, { width: 200, height: 200, backgroundColor: Palette.lavender, top: -40, right: -50 }]} />
      <View style={[styles.circle, { width: 120, height: 120, backgroundColor: Palette.yellow, top: 70, right: 110 }]} />
      <View style={[styles.circle, { width: 64, height: 64, backgroundColor: Palette.salmon, top: 150, right: 60 }]} />
      <View style={[styles.circle, { width: 90, height: 90, backgroundColor: Palette.mint, top: 20, left: -30 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { position: 'absolute', borderRadius: 999 },
});
