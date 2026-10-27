import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { PastelView } from '@/components/pastel';
import { ThemedText } from '@/components/themed-text';
import { Button, Chip, ErrorText, IconCircle, Loading } from '@/components/ui';
import { OnPastel, pastelFor, Radius, Spacing } from '@/constants/theme';
import { useColors } from '@/hooks/use-theme';
import { dayLabel } from '@/lib/format';
import { deletePhotos, pickCover, pickPhotos, signedUrls, uploadPhotos } from '@/lib/photos';
import { supabase } from '@/lib/supabase';
import type { Memory, MemoryPhoto } from '@/lib/types';
import { must, useQuery } from '@/lib/use-query';

const COLUMNS = 2;
const GAP = Spacing.two;

export default function MemoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const c = useColors();
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<MemoryPhoto | null>(null);
  const [busy, setBusy] = useState(false);
  // Select mode: tap photos to pick them, then delete them or make one the cover.
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const query = useQuery(async () => {
    const memory = must<Memory>(await supabase.from('memories').select('*').eq('id', id).single());
    const photos = must<MemoryPhoto[]>(
      await supabase.from('memory_photos').select('*').eq('memory_id', id).order('created_at'),
    );
    const urls = await signedUrls(photos.map((p) => p.storage_path));
    return { memory, photos, urls };
  }, [id]);

  const photoCount = query.data?.photos.length ?? 0;
  const header = (
    <Stack.Screen
      options={{
        headerRight: () =>
          photoCount > 0 ? (
            <Pressable onPress={() => (selecting ? stopSelecting() : setSelecting(true))} hitSlop={10}>
              <ThemedText style={{ fontWeight: '700', fontSize: 16 }}>{selecting ? 'Done' : 'Select'}</ThemedText>
            </Pressable>
          ) : null,
      }}
    />
  );

  if (!query.data) {
    return (
      <View style={styles.screen}>
        {header}
        {query.error ? <ErrorText>{query.error}</ErrorText> : <Loading />}
      </View>
    );
  }
  const { memory, photos, urls } = query.data;
  const tile = (width - Spacing.four * 2 - GAP * (COLUMNS - 1)) / COLUMNS;
  const cover = pickCover(photos, memory.cover_photo_id);
  // Normally the cover is the big photo on top and the grid holds the rest; when selecting, every
  // photo (cover included) is in the grid so any of them can be picked.
  const gridPhotos = selecting ? photos : photos.filter((p) => p !== cover);

  function stopSelecting() {
    setSelecting(false);
    setSelected(new Set());
  }

  function toggle(photo: MemoryPhoto) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(photo.id)) next.delete(photo.id);
      else next.add(photo.id);
      return next;
    });
  }

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

  async function setCover(photo: MemoryPhoto) {
    setBusy(true);
    setError(null);
    const { error } = await supabase.from('memories').update({ cover_photo_id: photo.id }).eq('id', memory.id);
    setBusy(false);
    if (error) return setError(error.message);
    setViewing(null);
    stopSelecting();
    query.reload();
  }

  function deleteSelected(toDelete: MemoryPhoto[]) {
    const n = toDelete.length;
    Alert.alert(
      n === 1 ? 'Delete this photo?' : `Delete ${n} photos?`,
      'They will be removed for everyone in the group. Originals stay in your camera roll.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: n === 1 ? 'Delete photo' : `Delete ${n} photos`,
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            setError(null);
            try {
              await deletePhotos(toDelete);
              must(await supabase.from('memory_photos').delete().in('id', toDelete.map((p) => p.id)));
              if (toDelete.some((p) => p.id === memory.cover_photo_id)) {
                await supabase.from('memories').update({ cover_photo_id: null }).eq('id', memory.id);
              }
              setViewing(null);
              stopSelecting();
              query.reload();
            } catch (err) {
              setError(err instanceof Error ? err.message : String(err));
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
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

  const picked = photos.filter((p) => selected.has(p.id));

  return (
    <View style={styles.screen}>
      {header}
      <ScrollView
        contentContainerStyle={[styles.container, selecting && { paddingBottom: insets.bottom + 140 }]}>
        <PastelView color={pastelFor(memory.id)} style={styles.hero}>
          {cover && (
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => (selecting ? toggle(cover) : setViewing(cover))}
              accessibilityLabel="Open photo">
              <Image source={{ uri: urls[cover.storage_path], cacheKey: cover.storage_path }} style={StyleSheet.absoluteFill} contentFit="cover" />
            </Pressable>
          )}
          <View style={{ flex: 1 }} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
            <Chip label={dayLabel(memory.happened_on)} />
            {memory.place_name && <Chip label={memory.place_name} icon="pin" />}
          </View>
        </PastelView>

        <View style={styles.titleRow}>
          <ThemedText type="title" style={{ flex: 1 }}>
            {memory.title}
          </ThemedText>
          <IconCircle
            icon="pencil"
            label="Edit memory"
            onPress={() => router.push({ pathname: '/memory/new', params: { editId: memory.id } })}
          />
        </View>
        {memory.notes && (
          <ThemedText themeColor="textSoft" style={{ fontSize: 17, lineHeight: 25 }}>
            {memory.notes}
          </ThemedText>
        )}

        {selecting && (
          <ThemedText type="small" themeColor="textMuted">
            Tap photos to select them.
          </ThemedText>
        )}

        {gridPhotos.length > 0 && (
          <View style={styles.grid}>
            {gridPhotos.map((p) => {
              const isSelected = selected.has(p.id);
              return (
                <Pressable
                  key={p.id}
                  onPress={() => (selecting ? toggle(p) : setViewing(p))}
                  accessibilityLabel={selecting ? (isSelected ? 'Deselect photo' : 'Select photo') : 'Open photo'}
                  accessibilityState={{ selected: isSelected }}>
                  <Image
                    source={{ uri: urls[p.storage_path], cacheKey: p.storage_path }}
                    style={[
                      { width: tile, height: tile * 1.2, borderRadius: Radius.tile - 6 },
                      selecting && !isSelected && { opacity: 0.6 },
                    ]}
                    contentFit="cover"
                    transition={150}
                  />
                  {selecting && p === cover && (
                    <View style={styles.coverTag}>
                      <Chip label="Cover" />
                    </View>
                  )}
                  {selecting && (
                    <View
                      style={[
                        styles.check,
                        isSelected ? { backgroundColor: c.primary, borderColor: c.primary } : { borderColor: '#FFFFFF' },
                      ]}>
                      {isSelected && <Icon name="check" size={14} color={c.onPrimary} />}
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        )}

        <ErrorText>{error}</ErrorText>
        {!selecting && (
          <>
            <Button
              title={uploading ?? (photos.length ? 'Add more photos' : 'Add photos')}
              icon="photo"
              variant="secondary"
              onPress={addPhotos}
              disabled={!!uploading}
            />
            <Button title="Delete memory" icon="trash" variant="danger" small onPress={remove} />
          </>
        )}
      </ScrollView>

      {selecting && (
        <View style={[styles.actionBar, { paddingBottom: insets.bottom + Spacing.two, backgroundColor: c.surface, borderTopColor: c.line }]}>
          <ThemedText type="smallBold" themeColor="textMuted" style={{ textAlign: 'center' }}>
            {picked.length === 0 ? 'No photos selected' : `${picked.length} selected`}
          </ThemedText>
          <View style={styles.actionRow}>
            <Button
              title="Set as cover"
              icon="photo"
              variant="secondary"
              disabled={picked.length !== 1 || picked[0] === cover || busy}
              onPress={() => setCover(picked[0])}
              style={{ flex: 1 }}
            />
            <Button
              title={picked.length > 1 ? `Delete ${picked.length}` : 'Delete'}
              icon="trash"
              disabled={picked.length === 0}
              loading={busy}
              onPress={() => deleteSelected(picked)}
              style={{ flex: 1, backgroundColor: c.danger }}
            />
          </View>
        </View>
      )}

      <Modal visible={!!viewing} animationType="fade" onRequestClose={() => setViewing(null)}>
        <View style={styles.viewer}>
          {viewing && (
            <Image
              source={{ uri: urls[viewing.storage_path], cacheKey: viewing.storage_path }}
              style={StyleSheet.absoluteFill}
              contentFit="contain"
            />
          )}
          <View style={[styles.viewerBar, { top: insets.top + Spacing.two }]}>
            <View />
            <IconCircle icon="close" label="Close photo" color={OnPastel.chip} iconColor={OnPastel.text} onPress={() => setViewing(null)} />
          </View>
          {viewing && (
            <View style={[styles.viewerActions, { bottom: insets.bottom + Spacing.three }]}>
              {viewing !== cover && (
                <Button title="Set as cover" icon="photo" variant="white" onPress={() => setCover(viewing)} loading={busy} style={{ flex: 1 }} />
              )}
              <Button
                title="Delete"
                icon="trash"
                onPress={() => deleteSelected([viewing])}
                style={{ flex: 1, backgroundColor: c.danger }}
              />
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { padding: Spacing.four, paddingTop: Spacing.two, gap: Spacing.three, paddingBottom: Spacing.six },
  hero: { height: 340, borderRadius: Radius.card, padding: Spacing.three, overflow: 'hidden' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  check: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverTag: { position: 'absolute', left: 8, bottom: 8 },
  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: Spacing.three,
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionRow: { flexDirection: 'row', gap: Spacing.two },
  viewer: { flex: 1, backgroundColor: '#000' },
  viewerBar: { position: 'absolute', left: Spacing.three, right: Spacing.three, flexDirection: 'row', justifyContent: 'space-between' },
  viewerActions: { position: 'absolute', left: Spacing.three, right: Spacing.three, flexDirection: 'row', gap: Spacing.two },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
});
