import { StyleSheet, View } from 'react-native';

import { Bob } from '@/components/floating';
import { Pastel } from '@/constants/theme';

const CIRCLES = [
  { size: 200, color: Pastel.lavender, pos: { top: -40, right: -50 }, ms: 5200, delay: 0 },
  { size: 120, color: Pastel.yellow, pos: { top: 70, right: 110 }, ms: 4100, delay: 500 },
  { size: 64, color: Pastel.salmon, pos: { top: 150, right: 60 }, ms: 3300, delay: 900 },
  { size: 90, color: Pastel.mint, pos: { top: 20, left: -30 }, ms: 4600, delay: 300 },
];

// The overlapping-circles motif from the Discover card, used as a header decoration. Each circle
// floats on its own rhythm.
export function HeroBlob({ height = 220 }: { height?: number }) {
  return (
    <View style={{ height }} pointerEvents="none">
      {CIRCLES.map((c, i) => (
        <Bob key={i} distance={10} ms={c.ms} delay={c.delay} style={[styles.circle, c.pos]}>
          <View style={{ width: c.size, height: c.size, borderRadius: c.size / 2, backgroundColor: c.color }} />
        </Bob>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { position: 'absolute' },
});
