import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';

import { Icon } from '@/components/icon';
import type { MemoryPhoto } from '@/lib/types';

// Looks like the Mac Photo Booth window: traffic-light title bar, the current photo on a black
// stage, a strip of every photo, and the bottom control bar (view modes, red camera button,
// Effects). Tapping a thumbnail brings that photo up (with a little camera flash).
// Tapping the big photo calls `onOpen` so the caller can show it full screen.

const THUMB_W = 64;
const THUMB_H = 48;
const THUMB_GAP = 8;
const STRIP_PAD = 10;

export function PhotoBooth({
  photos,
  urls,
  initialId,
  onOpen,
}: {
  photos: MemoryPhoto[];
  urls: Record<string, string>;
  initialId?: string;
  onOpen?: (photo: MemoryPhoto) => void;
}) {
  const [currentId, setCurrentId] = useState(initialId ?? photos[0]?.id);
  const [stripWidth, setStripWidth] = useState(0);
  const strip = useRef<ScrollViewInstance>(null);
  const flash = useRef(new Animated.Value(0)).current;

  // Falls back to the first photo if the shown one was deleted.
  const index = Math.max(0, photos.findIndex((p) => p.id === currentId));
  const current = photos[index];

  // Keep the chosen thumbnail centred on the strip.
  useEffect(() => {
    if (!stripWidth) return;
    const x = STRIP_PAD + index * (THUMB_W + THUMB_GAP) - (stripWidth - THUMB_W) / 2;
    strip.current?.scrollTo({ x: Math.max(0, x), animated: true });
  }, [index, stripWidth]);

  if (!current) return null;

  function show(photo: MemoryPhoto) {
    if (photo.id === current.id) return;
    setCurrentId(photo.id);
    flash.setValue(0.85);
    Animated.timing(flash, { toValue: 0, duration: 380, useNativeDriver: true }).start();
  }

  const uri = urls[current.storage_path];

  return (
    <View style={styles.window}>
      <View style={styles.titleBar}>
        <View style={styles.lights}>
          <View style={[styles.light, { backgroundColor: '#FF5F57' }]} />
          <View style={[styles.light, { backgroundColor: '#FEBC2E' }]} />
          <View style={[styles.light, { backgroundColor: '#28C840' }]} />
        </View>
        <Text style={styles.title}>Photo Booth</Text>
      </View>

      <Pressable
        style={styles.stage}
        onPress={() => onOpen?.(current)}
        accessibilityRole="imagebutton"
        accessibilityLabel={`Photo ${index + 1} of ${photos.length}. Tap to view full size.`}>
        {/* Solid black behind the photo, so portrait photos get black bars. */}
        <Image
          source={{ uri, cacheKey: current.storage_path }}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          transition={250}
        />
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.flash, { opacity: flash }]} />
        <View style={styles.counter}>
          <Text style={styles.counterText}>
            {index + 1} / {photos.length}
          </Text>
        </View>
      </Pressable>

      <View style={styles.filmStrip} onLayout={(e) => setStripWidth(e.nativeEvent.layout.width)}>
        <ScrollView
          ref={strip}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.stripContent}>
          {photos.map((p, i) => {
            const active = p.id === current.id;
            return (
              <Pressable
                key={p.id}
                onPress={() => show(p)}
                accessibilityRole="button"
                accessibilityLabel={`Show photo ${i + 1}`}
                accessibilityState={{ selected: active }}
                style={({ pressed }) => [
                  styles.thumbFrame,
                  active && styles.thumbFrameActive,
                  pressed && { transform: [{ scale: 0.94 }] },
                ]}>
                <Image
                  source={{ uri: urls[p.storage_path], cacheKey: p.storage_path }}
                  style={[styles.thumb, !active && { opacity: 0.6 }]}
                  contentFit="cover"
                  transition={150}
                />
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.controls}>
        <View style={styles.controlSide}>
          <View style={[styles.modeBtn, styles.modeBtnActive]}>
            <Icon name="photo" size={16} color="#FFFFFF" />
          </View>
          <View style={styles.modeBtn}>
            <Icon name="grid" size={16} color="#C7C7CC" />
          </View>
        </View>
        <View style={styles.shutter} accessibilityElementsHidden importantForAccessibility="no">
          <Icon name="camera" size={22} color="#FFFFFF" />
        </View>
        <View style={[styles.controlSide, { justifyContent: 'flex-end' }]}>
          <View style={styles.effects}>
            <Icon name="sparkle" size={14} color="#C7C7CC" />
            <Text style={styles.effectsText}>Effects</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  window: {
    backgroundColor: '#1B1B1D',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#4A4A4E',
  },
  titleBar: { height: 28, backgroundColor: '#2A2A2D', justifyContent: 'center' },
  lights: { position: 'absolute', left: 10, flexDirection: 'row', gap: 6 },
  light: { width: 11, height: 11, borderRadius: 6 },
  title: { textAlign: 'center', color: '#C7C7CC', fontSize: 12, fontWeight: '600' },
  stage: { aspectRatio: 4 / 3, backgroundColor: '#000', overflow: 'hidden' },
  flash: { backgroundColor: '#FFFFFF' },
  counter: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  counterText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] },
  filmStrip: { backgroundColor: '#232326', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#3A3A3E' },
  stripContent: { paddingHorizontal: STRIP_PAD, paddingVertical: 8, gap: THUMB_GAP },
  thumbFrame: { borderRadius: 6, borderWidth: 2, borderColor: 'transparent', padding: 1 },
  thumbFrameActive: { borderColor: '#FFFFFF' },
  thumb: { width: THUMB_W - 6, height: THUMB_H - 6, borderRadius: 3, backgroundColor: '#111' },
  controls: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    backgroundColor: '#2C2C2F',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#3A3A3E',
  },
  controlSide: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  modeBtn: { width: 30, height: 26, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: '#3A3A3E' },
  modeBtnActive: { backgroundColor: '#5A5A60' },
  shutter: {
    width: 52,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E5322D',
    borderWidth: 1,
    borderColor: '#FF6A66',
    alignItems: 'center',
    justifyContent: 'center',
  },
  effects: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 26, paddingHorizontal: 10, borderRadius: 6, backgroundColor: '#3A3A3E' },
  effectsText: { color: '#C7C7CC', fontSize: 12, fontWeight: '600' },
});
