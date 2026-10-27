import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';

import { Radius } from '@/constants/theme';
import { useColors } from '@/hooks/use-theme';
import type { MemoryPhoto } from '@/lib/types';

// Photo Booth view: the current photo is shown big, every photo sits on a strip below it, and
// tapping a thumbnail brings that photo up (with a little camera flash).
// Tapping the big photo calls `onOpen` so the caller can show it full screen.

const THUMB_W = 64;
const THUMB_H = 48;
const THUMB_GAP = 8;
const STRIP_PAD = 4;

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
  const c = useColors();
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
    <View style={styles.wrap}>
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

      <View onLayout={(e) => setStripWidth(e.nativeEvent.layout.width)}>
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
                  active && { borderColor: c.primary },
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
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  stage: { aspectRatio: 4 / 3, backgroundColor: '#000', overflow: 'hidden', borderRadius: Radius.card },
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
  stripContent: { paddingHorizontal: STRIP_PAD, paddingVertical: 4, gap: THUMB_GAP },
  thumbFrame: { borderRadius: 8, borderWidth: 2, borderColor: 'transparent', padding: 1 },
  thumb: { width: THUMB_W - 6, height: THUMB_H - 6, borderRadius: 5, backgroundColor: '#111' },
});
