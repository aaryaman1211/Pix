import { useEffect, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Pastel } from '@/constants/theme';
import { useColors } from '@/hooks/use-theme';

type Shape = 'circle' | 'squircle' | 'pill' | 'ring' | 'half' | 'cross';

// One shape drifting across the screen. x and y move on separate timers so the path wanders
// instead of tracing a straight line; non-round shapes also turn slowly. Positions are fractions
// of the screen (can go off-edge).
type Drift = {
  shape: Shape;
  size: number;
  color: string;
  x: [number, number];
  y: [number, number];
  xMs: number;
  yMs: number;
  delay: number;
  spinMs?: number; // full turn; negative spins the other way
};

const DRIFTS: Drift[] = [
  { shape: 'circle', size: 230, color: Pastel.salmon, x: [0.95, 0.1], y: [0.08, 0.32], xMs: 26000, yMs: 19000, delay: 0 },
  { shape: 'squircle', size: 150, color: Pastel.yellow, x: [0.05, 0.85], y: [0.55, 0.28], xMs: 22000, yMs: 27000, delay: 600, spinMs: 40000 },
  { shape: 'pill', size: 170, color: Pastel.lavender, x: [0.7, 0.15], y: [0.85, 0.6], xMs: 18000, yMs: 23000, delay: 1200, spinMs: -52000 },
  { shape: 'ring', size: 110, color: Pastel.mint, x: [0.25, 0.8], y: [0.2, 0.75], xMs: 15000, yMs: 31000, delay: 300 },
  { shape: 'cross', size: 80, color: Pastel.sky, x: [0.95, 0.45], y: [0.95, 0.45], xMs: 20000, yMs: 17000, delay: 900, spinMs: 24000 },
  { shape: 'half', size: 120, color: Pastel.salmon, x: [0.15, 0.6], y: [0.7, 0.92], xMs: 24000, yMs: 16000, delay: 1800, spinMs: -36000 },
  { shape: 'circle', size: 60, color: Pastel.yellow, x: [0.1, 0.55], y: [0.42, 0.08], xMs: 13000, yMs: 21000, delay: 1500 },
  { shape: 'cross', size: 46, color: Pastel.lavender, x: [0.55, 0.9], y: [0.15, 0.5], xMs: 17000, yMs: 25000, delay: 2400, spinMs: -18000 },
];

const ease = Easing.inOut(Easing.sin);

function loop(value: { value: number }, ms: number, delay: number) {
  value.value = withDelay(delay, withRepeat(withTiming(1, { duration: ms, easing: ease }), -1, true));
}

function spin(value: { value: number }, ms: number, delay: number) {
  value.value = withDelay(delay, withRepeat(withTiming(1, { duration: ms, easing: Easing.linear }), -1, false));
}

// Width and height of a shape's box.
function box(d: Drift): [number, number] {
  if (d.shape === 'pill') return [d.size, d.size * 0.42];
  if (d.shape === 'half') return [d.size, d.size / 2];
  return [d.size, d.size];
}

function ShapeView({ d }: { d: Drift }) {
  const [w, h] = box(d);
  switch (d.shape) {
    case 'cross': {
      // A plain plus sign: two rounded bars.
      const bar = w * 0.3;
      return (
        <View style={{ width: w, height: h }}>
          <View style={{ position: 'absolute', left: (w - bar) / 2, top: 0, width: bar, height: h, borderRadius: bar / 2, backgroundColor: d.color }} />
          <View style={{ position: 'absolute', top: (h - bar) / 2, left: 0, width: w, height: bar, borderRadius: bar / 2, backgroundColor: d.color }} />
        </View>
      );
    }
    case 'ring':
      return <View style={{ width: w, height: h, borderRadius: w / 2, borderWidth: w * 0.17, borderColor: d.color }} />;
    case 'half':
      return <View style={{ width: w, height: h, borderTopLeftRadius: w / 2, borderTopRightRadius: w / 2, backgroundColor: d.color }} />;
    case 'squircle':
      return <View style={{ width: w, height: h, borderRadius: w * 0.3, backgroundColor: d.color }} />;
    default:
      return <View style={{ width: w, height: h, borderRadius: h / 2, backgroundColor: d.color }} />;
  }
}

function DriftingShape({ drift, width, height, still }: { drift: Drift; width: number; height: number; still: boolean }) {
  const tx = useSharedValue(0.5);
  const ty = useSharedValue(0.5);
  const pulse = useSharedValue(0);
  const turn = useSharedValue(0);

  useEffect(() => {
    if (still) return;
    tx.value = 0;
    ty.value = 0;
    loop(tx, drift.xMs, drift.delay);
    loop(ty, drift.yMs, drift.delay);
    loop(pulse, drift.xMs / 3, drift.delay);
    if (drift.spinMs) spin(turn, Math.abs(drift.spinMs), drift.delay);
    return () => {
      cancelAnimation(tx);
      cancelAnimation(ty);
      cancelAnimation(pulse);
      cancelAnimation(turn);
    };
  }, [still, drift, tx, ty, pulse, turn]);

  const [w, h] = box(drift);
  const direction = (drift.spinMs ?? 0) < 0 ? -1 : 1;
  const style = useAnimatedStyle(() => {
    const x = (drift.x[0] + (drift.x[1] - drift.x[0]) * tx.value) * width - w / 2;
    const y = (drift.y[0] + (drift.y[1] - drift.y[0]) * ty.value) * height - h / 2;
    return {
      transform: [
        { translateX: x },
        { translateY: y },
        { rotate: `${direction * 360 * turn.value}deg` },
        { scale: 1 + 0.08 * pulse.value },
      ],
    };
  });

  return (
    <Animated.View style={[styles.shape, style]}>
      <ShapeView d={drift} />
    </Animated.View>
  );
}

// Full-screen layer of pastel shapes floating slowly behind everything. `strength` scales how
// visible they are (a little softer behind busy screens, stronger on sign-in).
export function FloatingBlobs({ strength = 1 }: { strength?: number }) {
  const { width, height } = useWindowDimensions();
  const c = useColors();
  const still = useReducedMotion();
  const opacity = (c.scheme === 'dark' ? 0.22 : 0.42) * strength;
  return (
    <View style={[StyleSheet.absoluteFill, { opacity, overflow: 'hidden' }]} pointerEvents="none">
      {DRIFTS.map((d, i) => (
        <DriftingShape key={i} drift={d} width={width} height={height} still={still} />
      ))}
    </View>
  );
}

// Gentle float in place, for decoration circles on cards. Each instance gets its own rhythm.
export function Bob({
  children,
  distance = 8,
  ms = 4200,
  delay = 0,
  style,
}: {
  children?: ReactNode;
  distance?: number;
  ms?: number;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useSharedValue(0);
  const still = useReducedMotion();

  useEffect(() => {
    if (still) return;
    loop(t, ms, delay);
    return () => cancelAnimation(t);
  }, [still, ms, delay, t]);

  const animated = useAnimatedStyle(() => ({
    transform: [{ translateY: (t.value - 0.5) * 2 * distance }, { translateX: (0.5 - t.value) * distance * 0.6 }],
  }));

  return (
    <Animated.View style={[style, animated]} pointerEvents="none">
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shape: { position: 'absolute', left: 0, top: 0 },
});
