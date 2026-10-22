import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, ErrorText, Loading } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { dayLabel } from '@/lib/format';
import { deletePhotos, pickPhotos, signedUrls, uploadPhotos } from '@/lib/photos';
import { supabase } from '@/lib/supabase';
import type { Memory, MemoryPhoto } from '@/lib/types';
import { must, useQuery } from '@/lib/use-query';

const COLUMNS = 3;
const GAP = 4;

export default function MemoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
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

  if (!query.data) return query.error ? <ErrorText>{query.error}</ErrorText> : <Loading />;
  const { memory, photos, urls } = query.data;
  const tile = (width - Spacing.three * 2 - GAP * (COLUMNS - 1)) / COLUMNS;

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
    <ScrollView contentContainerStyle={styles.container}>
      <View style={{ gap: Spacing.one }}>
        <ThemedText style={styles.title}>{memory.title}</ThemedText>
        <ThemedText themeColor="textSecondary">
          {[dayLabel(memory.happened_on), memory.place_name].filter(Boolean).join(' · ')}
        </ThemedText>
      </View>

      {memory.notes && <ThemedText>{memory.notes}</ThemedText>}

      <View style={styles.grid}>
        {photos.map((p) => (
          <Pressable key={p.id} onPress={() => setViewing(p.storage_path)} accessibilityLabel="Open photo">
            <Image
              source={{ uri: urls[p.storage_path], cacheKey: p.storage_path }}
              style={{ width: tile, height: tile, borderRadius: 6 }}
              contentFit="cover"
              transition={150}
            />
          </Pressable>
        ))}
      </View>

      <ErrorText>{error}</ErrorText>
      <Button
        title={uploading ?? (photos.length ? 'Add more photos' : 'Add photos')}
        variant="secondary"
        onPress={addPhotos}
        disabled={!!uploading}
      />
      <Button title="Delete memory" variant="danger" small onPress={remove} />

      <Modal visible={!!viewing} animationType="fade" onRequestClose={() => setViewing(null)}>
        <Pressable style={styles.viewer} onPress={() => setViewing(null)} accessibilityLabel="Close photo">
          {viewing && (
            <Image
              source={{ uri: urls[viewing], cacheKey: viewing }}
              style={StyleSheet.absoluteFill}
              contentFit="contain"
            />
          )}
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  viewer: { flex: 1, backgroundColor: '#000' },
});
