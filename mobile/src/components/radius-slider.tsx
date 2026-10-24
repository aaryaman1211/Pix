import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View, type HostInstance, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { Icon } from '@/components/icon';
import { PastelScope } from '@/components/pastel';
import { ThemedText } from '@/components/themed-text';
import { OnPastel, Pastel, Radius, Spacing } from '@/constants/theme';
import { useColors } from '@/hooks/use-theme';

// Snap points in km: tighter at short distances, where a kilometre matters more.
const STEPS = [0.5, 1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50];
const TICKS = [1, 5, 10, 25, 50];
const THUMB = 52;
const TRACK = 60;
const INSET = (TRACK - THUMB) / 2;

function nearestIndex(km: number) {
  let best = 0;
  STEPS.forEach((s, i) => {
    if (Math.abs(s - km) < Math.abs(STEPS[best] - km)) best = i;
  });
  return best;
}

function vibe(km: number) {
  if (km <= 2) return 'Walkable';
  if (km <= 6) return 'Your neighbourhood';
  if (km <= 15) return 'Across town';
  return 'The whole city';
}

const format = (km: number) => (km < 1 ? km.toFixed(1) : String(km));

// Big readout + pill track with a draggable handle. Calls onCommit once, when the drag ends.
export function RadiusSlider({ km, onCommit }: { km: number; onCommit: (km: number) => void }) {
  const c = useColors();
  const [index, setIndex] = useState(() => nearestIndex(km));
  const [dragging, setDragging] = useState(false);
  const [width, setWidth] = useState(0);
  const trackRef = useRef<HostInstance>(null);
  const trackX = useRef(0);
  const indexRef = useRef(index);
  const commitRef = useRef(onCommit);
  useEffect(() => {
    commitRef.current = onCommit;
  }, [onCommit]);
  const grow = useSharedValue(1);

  // Follow outside changes (another member, or the group switching) unless mid-drag.
  useEffect(() => {
    if (!dragging) {
      const i = nearestIndex(km);
      setIndex(i);
      indexRef.current = i;
    }
  }, [km, dragging]);

  const usable = Math.max(0, width - THUMB - INSET * 2);
  // Left edge of the handle at step i.
  const xFor = (i: number) => INSET + (usable * i) / (STEPS.length - 1);

  const responder = useMemo(() => {
    const indexAt = (pageX: number) => {
      const usableWidth = Math.max(1, width - THUMB - INSET * 2);
      const ratio = Math.min(1, Math.max(0, (pageX - trackX.current - INSET - THUMB / 2) / usableWidth));
      return Math.round(ratio * (STEPS.length - 1));
    };
    const update = (pageX: number) => {
      const i = indexAt(pageX);
      if (i !== indexRef.current) {
        indexRef.current = i;
        setIndex(i);
      }
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Once dragging, don't let the scroll view take the gesture back.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        setDragging(true);
        grow.value = withSpring(1.15, { damping: 12 });
        const pageX = e.nativeEvent.pageX;
        trackRef.current?.measureInWindow((x) => {
          trackX.current = x;
          update(pageX);
        });
      },
      onPanResponderMove: (e) => update(e.nativeEvent.pageX),
      onPanResponderRelease: () => {
        setDragging(false);
        grow.value = withSpring(1, { damping: 12 });
        commitRef.current(STEPS[indexRef.current]);
      },
      onPanResponderTerminate: () => {
        setDragging(false);
        grow.value = withSpring(1, { damping: 12 });
      },
    });
  }, [width, grow]);

  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ scale: grow.value }] }));
  const value = STEPS[index];
  const x = xFor(index);

  return (
    <View style={{ gap: Spacing.three }}>
      <View style={styles.readoutRow}>
        <View style={styles.readout}>
          <ThemedText style={styles.number}>{format(value)}</ThemedText>
          <ThemedText style={styles.unit}>km</ThemedText>
        </View>
        <PastelScope>
          <View style={styles.vibe}>
            <ThemedText type="smallBold">{vibe(value)}</ThemedText>
          </View>
        </PastelScope>
      </View>

      <View
        ref={trackRef}
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        style={[styles.track, { backgroundColor: c.track }]}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Search radius"
        accessibilityValue={{ text: `${format(value)} kilometres` }}
        onAccessibilityAction={(e) => {
          const next = e.nativeEvent.actionName === 'increment' ? index + 1 : index - 1;
          const i = Math.min(STEPS.length - 1, Math.max(0, next));
          setIndex(i);
          indexRef.current = i;
          onCommit(STEPS[i]);
        }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        {...responder.panHandlers}>
        {width > 0 && (
          <>
            <View style={[styles.fill, { width: x + THUMB + INSET }]} />
            {STEPS.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  { left: xFor(i) + THUMB / 2 - 2, backgroundColor: i <= index ? OnPastel.text : c.textMuted },
                  { opacity: i <= index ? 0.25 : 0.35 },
                ]}
              />
            ))}
            <Animated.View style={[styles.thumb, { left: x }, thumbStyle]}>
              <View style={[styles.thumbInner, { backgroundColor: c.primary }]}>
                <Icon name="pin" size={20} color={c.onPrimary} />
              </View>
            </Animated.View>
          </>
        )}
      </View>

      {width > 0 && (
        <View style={styles.ticks}>
          {TICKS.map((t) => {
            const i = STEPS.indexOf(t);
            return (
              <ThemedText
                key={t}
                type="smallBold"
                themeColor={STEPS[index] >= t ? 'text' : 'textMuted'}
                style={[styles.tick, { left: xFor(i) + THUMB / 2 - 20 }]}>
                {t}
              </ThemedText>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  readoutRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  readout: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  number: { fontSize: 72, lineHeight: 74, fontWeight: '800', letterSpacing: -3 },
  unit: { fontSize: 22, fontWeight: '700', marginBottom: 10 },
  vibe: {
    backgroundColor: Pastel.sky,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    marginBottom: 12,
  },
  track: { height: TRACK, borderRadius: TRACK / 2, justifyContent: 'center', overflow: 'visible' },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: TRACK / 2,
    backgroundColor: Pastel.sky,
  },
  dot: { position: 'absolute', width: 4, height: 4, borderRadius: 2, top: TRACK / 2 - 2 },
  thumb: {
    position: 'absolute',
    top: INSET,
    width: THUMB,
    height: THUMB,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  thumbInner: { flex: 1, borderRadius: THUMB / 2, alignItems: 'center', justifyContent: 'center' },
  ticks: { height: 20 },
  tick: { position: 'absolute', width: 40, textAlign: 'center' },
});
