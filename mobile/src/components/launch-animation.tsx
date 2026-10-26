import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type EasingFunction,
  type SharedValue,
} from 'react-native-reanimated';

import { useColors } from '@/hooks/use-theme';

// The one-colour Pix logo (three tiles and a pin, on ink) acted out on cold start: the pin hops in
// like the Pixar lamp, lands on the top-left tile, looks over at the empty slot, drops into it (the
// logo), then jumps and stomps the tile below it, which grows to fill the screen and fades into
// the app. Tapping skips it; with Reduce Motion on it doesn't play.

const INK = '#16161A';
const TILE = '#FAFAF7';

type Channel = 'x' | 'y' | 'sx' | 'sy' | 'r';
type Pose = Record<Channel, number>;
// One beat of the pin's timeline. Unset channels hold their value; x always moves linearly so
// hops trace an arc (y eases up, then down).
type Step = { ms: number; ease?: EasingFunction } & Partial<Pose>;

const out = Easing.out(Easing.quad);
const into = Easing.in(Easing.quad);

function pinSteps(start: Pose, tl: [number, number], br: [number, number], T: number): Step[] {
  const [tlx, tly] = tl;
  const [brx, bry] = br;
  return [
    { ms: 300 }, // tiles pop in
    // hop in from the left onto the top-left tile
    { ms: 300, x: (start.x + tlx) / 2, y: tly - 1.4 * T, sx: 0.92, sy: 1.1, r: 14, ease: out },
    { ms: 260, x: tlx, y: tly, sx: 0.95, sy: 1.06, r: 4, ease: into },
    { ms: 90, sx: 1.24, sy: 0.74, r: 0, ease: out },
    { ms: 180, sx: 1, sy: 1, ease: Easing.out(Easing.back(2)) },
    // look over at the empty slot, and back
    { ms: 180, r: 12 },
    { ms: 100 },
    { ms: 160, r: 0 },
    // crouch, hop right and drop into the slot, standing on the bottom-right tile
    { ms: 150, sx: 1.16, sy: 0.8, r: -6, ease: out },
    { ms: 240, x: (tlx + brx) / 2, y: tly - 0.9 * T, sx: 0.9, sy: 1.12, r: 16, ease: out },
    { ms: 280, x: brx, y: bry, sx: 0.94, sy: 1.08, r: 0, ease: into },
    { ms: 90, sx: 1.22, sy: 0.76, ease: out },
    { ms: 180, sx: 1, sy: 1, ease: Easing.out(Easing.back(2)) },
    { ms: 300 }, // the logo, for a moment
    // big jump straight up, then stomp
    { ms: 180, sx: 1.28, sy: 0.68, ease: out },
    { ms: 300, y: bry - 1.9 * T, sx: 0.88, sy: 1.16, ease: Easing.out(Easing.cubic) },
    { ms: 50, sx: 0.95, sy: 1.05 },
    { ms: 200, y: bry, sx: 0.86, sy: 1.2, ease: Easing.in(Easing.cubic) },
  ];
}

const STOMP_MS = 110; // pin and tile squash together
const SQUASH = 0.7; // tile height at the bottom of the stomp
const EXPAND_MS = 520;
const FADE_MS = 240;

function track(steps: Step[], key: Channel, from: number) {
  let v = from;
  const parts = steps.map((s) => {
    if (s[key] !== undefined) v = s[key];
    const easing = key === 'x' ? Easing.linear : (s.ease ?? Easing.inOut(Easing.quad));
    return withTiming(v, { duration: s.ms, easing });
  });
  return withSequence(...parts);
}

export function LaunchAnimation({ onDone }: { onDone: () => void }) {
  const { width: W, height: H } = useWindowDimensions();
  const c = useColors();
  const still = useReducedMotion();

  // Logo geometry, from the 100-unit icon: 28-unit tiles, 6-unit gaps, 24-unit pin.
  const T = Math.round(Math.min(Math.max(Math.min(W, H) * 0.18, 56), 88));
  const G = (T * 6) / 28;
  const D = (T * 24) / 28; // pin head diameter
  const PH = D / 2 + D / Math.SQRT2; // pin height, head top to tip
  const S = 2 * T + G;
  const tl: [number, number] = [-S / 2 + T / 2, -S / 2];
  const br: [number, number] = [S / 2 - T / 2, -S / 2 + T + G];
  const start: Pose = { x: -W / 2 - D, y: tl[1] + T / 2, sx: 1, sy: 1, r: 0 };

  const x = useSharedValue(start.x);
  const y = useSharedValue(start.y);
  const sx = useSharedValue(1);
  const sy = useSharedValue(1);
  const r = useSharedValue(0);
  // Pop-in scale of each tile: top-left, bottom-left, bottom-right.
  const t0 = useSharedValue(0);
  const t1 = useSharedValue(0);
  const t2 = useSharedValue(0);
  const squash = useSharedValue(1);
  const expand = useSharedValue(0);
  const rest = useSharedValue(1); // pin and the other two tiles
  const fade = useSharedValue(1);

  const done = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const finish = () => {
    if (done.current) return;
    done.current = true;
    onDone();
  };

  useEffect(() => {
    if (still) {
      finish();
      return;
    }
    const steps = pinSteps(start, tl, br, T);
    const stompAt = steps.reduce((sum, s) => sum + s.ms, 0);
    const stomp = [{ ms: STOMP_MS, y: br[1] + (1 - SQUASH) * T, sx: 1.4, sy: 0.55, ease: out }];
    const all = [...steps, ...stomp];

    x.value = track(all, 'x', start.x);
    y.value = track(all, 'y', start.y);
    sx.value = track(all, 'sx', 1);
    sy.value = track(all, 'sy', 1);
    r.value = track(all, 'r', 0);

    [t0, t1, t2].forEach((t, i) => {
      t.value = withDelay(i * 70, withTiming(1, { duration: 260, easing: Easing.out(Easing.back(1.6)) }));
    });
    const grow = stompAt + STOMP_MS;
    squash.value = withDelay(stompAt, withSequence(
      withTiming(SQUASH, { duration: STOMP_MS, easing: out }),
      withTiming(1, { duration: 200, easing: out }),
    ));
    expand.value = withDelay(grow, withTiming(1, { duration: EXPAND_MS, easing: Easing.inOut(Easing.cubic) }));
    rest.value = withDelay(grow, withTiming(0, { duration: 160 }));
    fade.value = withDelay(grow + EXPAND_MS, withTiming(0, { duration: FADE_MS }));
    timer.current = setTimeout(finish, grow + EXPAND_MS + FADE_MS);

    return () => {
      clearTimeout(timer.current);
      [x, y, sx, sy, r, t0, t1, t2, squash, expand, rest, fade].forEach((v) => cancelAnimation(v));
    };
    // Plays once per mount; a rotation mid-animation doesn't restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [still]);

  const skip = () => {
    clearTimeout(timer.current);
    fade.value = withTiming(0, { duration: 200 });
    timer.current = setTimeout(finish, 200);
  };

  const overlay = useAnimatedStyle(() => ({ opacity: fade.value }));
  const restStyle = useAnimatedStyle(() => ({ opacity: rest.value }));

  // Scaled and rotated about the tip, so it stands on whatever it lands on.
  const pin = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value + PH / 2 },
      { rotate: `${r.value}deg` },
      { scaleX: sx.value },
      { scaleY: sy.value },
      { translateY: -PH / 2 },
    ],
  }));

  // The stomped tile squashes towards its bottom edge, then grows from where it sits to cover the
  // screen, turning the app's canvas colour on the way.
  const cover = (Math.max(W, H) * 1.6) / T;
  const stomped = useAnimatedStyle(() => {
    const k = 1 + (cover - 1) * expand.value;
    return {
      backgroundColor: interpolateColor(expand.value, [0, 1], [TILE, c.canvas]),
      transform: [
        { translateX: br[0] * (1 - expand.value) },
        { translateY: (br[1] + T / 2) * (1 - expand.value) + ((1 - squash.value) * T) / 2 },
        { scale: k * t2.value },
        { scaleY: squash.value },
      ],
    };
  });

  const pop0 = useAnimatedStyle(() => ({ transform: [{ scale: t0.value }] }));
  const pop1 = useAnimatedStyle(() => ({ transform: [{ scale: t1.value }] }));

  if (still) return null;

  const radius = (T * 8) / 28;
  const tile = { width: T, height: T, borderRadius: radius, marginLeft: -T / 2, marginTop: -T / 2 };

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, overlay]}>
      <StatusBar style="light" />
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={skip}
        accessibilityRole="button"
        accessibilityLabel="Pix is starting. Tap to skip.">
        <View style={styles.center}>
          <Animated.View style={[styles.abs, restStyle]}>
            {/* top-left and bottom-left; the bottom-right one is drawn last, above the pin */}
            <View style={[styles.abs, { transform: [{ translateX: tl[0] }, { translateY: tl[1] + T / 2 }] }]}>
              <Animated.View style={[tile, styles.tile, pop0]} />
            </View>
            <View style={[styles.abs, { transform: [{ translateX: tl[0] }, { translateY: br[1] + T / 2 }] }]}>
              <Animated.View style={[tile, styles.tile, pop1]} />
            </View>
            <Animated.View style={[styles.abs, { width: D, height: PH, marginLeft: -D / 2, marginTop: -PH }, pin]}>
              <View style={[styles.head, { width: D, height: D, borderRadius: D / 2, borderBottomRightRadius: 0 }]} />
              <View
                style={[
                  styles.abs,
                  { left: D / 3, top: D / 3, width: D / 3, height: D / 3, borderRadius: D / 6, backgroundColor: INK },
                ]}
              />
            </Animated.View>
          </Animated.View>
          <Animated.View style={[styles.abs, tile, styles.tile, stomped]} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: INK, zIndex: 1000 },
  center: { position: 'absolute', left: '50%', top: '50%' },
  abs: { position: 'absolute', left: 0, top: 0 },
  tile: { backgroundColor: TILE },
  // A rounded square with one sharp corner, turned 45° so the corner points down: a map pin.
  head: { backgroundColor: TILE, transform: [{ rotate: '45deg' }] },
});
