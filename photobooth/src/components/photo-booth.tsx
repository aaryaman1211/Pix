import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';

import type { MemoryPhoto } from '@/lib/types';

// A MacBook running Photo Booth: the current photo fills the screen, every photo sits on the
// film strip below it, and tapping a thumbnail brings that photo up (with a little camera flash).
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
    <View style={styles.laptop}>
      <View style={styles.lid}>
        <View style={styles.bezelTop}>
          <View style={styles.camera} />
          <View style={styles.cameraLight} />
        </View>

        <View style={styles.screen}>
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
            {/* Blurred copy fills the frame so any aspect ratio looks good; the sharp copy is contained on top. */}
            <Image
              source={{ uri, cacheKey: current.storage_path }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              blurRadius={28}
              transition={250}
            />
            <View style={[StyleSheet.absoluteFill, styles.dim]} />
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

          <View style={styles.toolbar} onLayout={(e) => setStripWidth(e.nativeEvent.layout.width)}>
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
        </View>
      </View>

      <View style={styles.base}>
        <View style={styles.notch} />
      </View>
      <View style={styles.feet} />
    </View>
  );
}

const styles = StyleSheet.create({
  laptop: { alignItems: 'center' },
  lid: {
    alignSelf: 'stretch',
    marginHorizontal: 14,
    backgroundColor: '#0B0B0D',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#A3A6AC',
    paddingHorizontal: 8,
    paddingBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  bezelTop: { height: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  camera: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#1E2A3A', borderWidth: 1, borderColor: '#2E3B4E' },
  cameraLight: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#3BE36A' },
  screen: { borderRadius: 6, overflow: 'hidden', backgroundColor: '#1B1B1D' },
  titleBar: {
    height: 24,
    backgroundColor: '#2A2A2D',
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#000',
  },
  lights: { position: 'absolute', left: 8, flexDirection: 'row', gap: 5 },
  light: { width: 9, height: 9, borderRadius: 5 },
  title: { textAlign: 'center', color: '#C7C7CC', fontSize: 11, fontWeight: '600', letterSpacing: 0.2 },
  stage: { aspectRatio: 4 / 3, backgroundColor: '#000', overflow: 'hidden' },
  dim: { backgroundColor: 'rgba(0,0,0,0.25)' },
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
  toolbar: { backgroundColor: '#232326', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#3A3A3E' },
  stripContent: { paddingHorizontal: STRIP_PAD, paddingVertical: 10, gap: THUMB_GAP },
  thumbFrame: { borderRadius: 6, borderWidth: 2, borderColor: 'transparent', padding: 1 },
  thumbFrameActive: { borderColor: '#FFFFFF' },
  thumb: { width: THUMB_W - 6, height: THUMB_H - 6, borderRadius: 3, backgroundColor: '#111' },
  base: {
    alignSelf: 'stretch',
    height: 14,
    marginTop: -1,
    backgroundColor: '#C4C7CC',
    borderTopWidth: 1,
    borderTopColor: '#E4E6EA',
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    alignItems: 'center',
  },
  notch: { width: 70, height: 6, backgroundColor: '#A2A5AB', borderBottomLeftRadius: 6, borderBottomRightRadius: 6 },
  feet: { width: '86%', height: 3, backgroundColor: '#8E9196', borderBottomLeftRadius: 3, borderBottomRightRadius: 3 },
});
