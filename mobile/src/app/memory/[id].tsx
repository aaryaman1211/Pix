import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Button, Chip, ErrorText, IconCircle, Loading } from '@/components/ui';
import { Palette, pastelFor, Radius, Spacing } from '@/constants/theme';
import { dayLabel } from '@/lib/format';
import { deletePhotos, pickPhotos, signedUrls, uploadPhotos } from '@/lib/photos';
import { supabase } from '@/lib/supabase';
import type { Memory, MemoryPhoto } from '@/lib/types';
import { must, useQuery } from '@/lib/use-query';

const COLUMNS = 2;
const GAP = Spacing.two;

export default function MemoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);

  const query = useQuery(async () => {
    const memory = must<Memory>(await supabase.from('memories').select('*').eq('id', id).single());
    const photos = must<MemoryPhoto[]>(
      await supabase.from('memory_photos').select('*').eq('memory_id', id).order('created_at'),
    );
    const urls = await signedUrls(photos.map((p) => p.storage_path));
    return { memory, photos, urls };
  }, [id]);

  if (!query.data) {
    return <View style={styles.screen}>{query.error ? <ErrorText>{query.error}</ErrorText> : <Loading />}</View>;
  }
  const { memory, photos, urls } = query.data;
  const tile = (width - Spacing.four * 2 - GAP * (COLUMNS - 1)) / COLUMNS;
  const [cover, ...rest] = photos;

  async function addPhotos() {
    const picked = await pickPhotos();
    if (!picked.length) return;
    setError(null);
    try {
      await uploadPhotos(memory.group_id, memory.id, picked, (done, total) =>
        setUploading(`Uploading ${done + 1} of ${total}…`),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    setUploading(null);
    query.reload();
  }

  function remove() {
    Alert.alert('Delete this memory?', 'Its photos will be deleted for everyone in the group.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePhotos(photos);
            must(await supabase.from('memories').delete().eq('id', memory.id));
            router.back();
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
          }
        },
      },
    ]);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={[styles.hero, { backgroundColor: pastelFor(memory.id) }]}>
        {cover && (
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setViewing(cover.storage_path)} accessibilityLabel="Open photo">
            <Image source={{ uri: urls[cover.storage_path], cacheKey: cover.storage_path }} style={StyleSheet.absoluteFill} contentFit="cover" />
          </Pressable>
        )}
        <View style={{ flex: 1 }} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
          <Chip label={dayLabel(memory.happened_on)} />
          {memory.place_name && <Chip label={memory.place_name} icon="pin" />}
        </View>
      </View>

      <ThemedText type="title">{memory.title}</ThemedText>
      {memory.notes && <ThemedText style={{ fontSize: 17, lineHeight: 25, color: Palette.inkSoft }}>{memory.notes}</ThemedText>}

      {rest.length > 0 && (
        <View style={styles.grid}>
          {rest.map((p) => (
            <Pressable key={p.id} onPress={() => setViewing(p.storage_path)} accessibilityLabel="Open photo">
              <Image
                source={{ uri: urls[p.storage_path], cacheKey: p.storage_path }}
                style={{ width: tile, height: tile * 1.2, borderRadius: Radius.tile - 6 }}
                contentFit="cover"
                transition={150}
              />
            </Pressable>
          ))}
        </View>
      )}

      <ErrorText>{error}</ErrorText>
      <Button
        title={uploading ?? (photos.length ? 'Add more photos' : 'Add photos')}
        icon="photo"
        variant="secondary"
        onPress={addPhotos}
        disabled={!!uploading}
      />
      <Button title="Delete memory" icon="trash" variant="danger" small onPress={remove} />

      <Modal visible={!!viewing} animationType="fade" onRequestClose={() => setViewing(null)}>
        <View style={styles.viewer}>
          {viewing && (
            <Image source={{ uri: urls[viewing], cacheKey: viewing }} style={StyleSheet.absoluteFill} contentFit="contain" />
          )}
          <View style={[styles.viewerClose, { top: insets.top + Spacing.two }]}>
            <IconCircle icon="close" label="Close photo" color={Palette.white} onPress={() => setViewing(null)} />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.canvas },
  container: { padding: Spacing.four, paddingTop: Spacing.two, gap: Spacing.three, paddingBottom: Spacing.six },
  hero: { height: 340, borderRadius: Radius.card, padding: Spacing.three, overflow: 'hidden' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  viewer: { flex: 1, backgroundColor: '#000' },
  viewerClose: { position: 'absolute', right: Spacing.three },
});
