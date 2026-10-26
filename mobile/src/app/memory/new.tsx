import type { ImagePickerAsset } from 'expo-image-picker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { DateField } from '@/components/date-field';
import { PhotoPickerStrip } from '@/components/photo-picker-strip';
import { ThemedText } from '@/components/themed-text';
import { Button, Chip, ErrorText, Input, Loading } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { toDay } from '@/lib/format';
import { useActiveGroup } from '@/lib/groups';
import { logInteraction } from '@/lib/interactions';
import { uploadPhotos } from '@/lib/photos';
import { supabase } from '@/lib/supabase';
import type { Memory, SavedPlace } from '@/lib/types';
import { must, useQuery } from '@/lib/use-query';

type PlaceRef = { placeId: string; name: string };

// Creates a memory, or edits one when opened with ?editId=<memory id>. Photos of an existing memory
// are managed on the memory screen itself.
export default function NewMemoryScreen() {
  const { savedPlaceId, editId } = useLocalSearchParams<{ savedPlaceId?: string; editId?: string }>();
  const group = useActiveGroup();

  const [title, setTitle] = useState('');
  const [day, setDay] = useState(toDay(new Date()));
  const [notes, setNotes] = useState('');
  const [selected, setSelected] = useState<PlaceRef | null>(null);
  // The place the memory had when editing started; kept as an option even if it's off the list now.
  const [original, setOriginal] = useState<PlaceRef | null>(null);
  const [loaded, setLoaded] = useState(!editId);
  const [photos, setPhotos] = useState<ImagePickerAsset[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const places = useQuery(
    async () =>
      must<SavedPlace[]>(
        await supabase
          .from('saved_places')
          .select('*')
          .eq('group_id', group.id)
          .order('created_at', { ascending: false }),
      ),
    [group.id],
  );
  // A memory links to a place by its Google id; the saved row (if still on the list) gives its status.
  const saved = places.data?.find((p) => p.place_id === selected?.placeId) ?? null;

  // New memory from a place page: preselect that place once the list arrives.
  useEffect(() => {
    if (editId || !savedPlaceId || !places.data) return;
    const p = places.data.find((x) => x.id === savedPlaceId);
    if (p) setSelected((cur) => cur ?? { placeId: p.place_id, name: p.name });
  }, [editId, savedPlaceId, places.data]);

  // Editing: fill the form once.
  useEffect(() => {
    if (!editId) return;
    let cancelled = false;
    supabase
      .from('memories')
      .select('*')
      .eq('id', editId)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) return setError(error.message);
        const m = data as Memory;
        setTitle(m.title);
        setDay(m.happened_on);
        setNotes(m.notes ?? '');
        const ref = m.place_id ? { placeId: m.place_id, name: m.place_name ?? 'Place' } : null;
        setSelected(ref);
        setOriginal(ref);
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [editId]);

  async function save() {
    setError(null);
    setStatus('Saving…');
    try {
      const fields = {
        title: title.trim() || selected?.name || 'A good day',
        happened_on: day,
        notes: notes.trim() || null,
        place_id: selected?.placeId ?? null,
        place_name: selected?.name ?? null,
      };

      if (editId) {
        must(await supabase.from('memories').update(fields).eq('id', editId));
        await markVisited();
        router.back();
        return;
      }

      const memory = must<{ id: string }>(
        await supabase
          .from('memories')
          .insert({ group_id: group.id, ...fields })
          .select('id')
          .single(),
      );

      if (photos.length) {
        await uploadPhotos(group.id, memory.id, photos, (done, total) =>
          setStatus(`Uploading photo ${done + 1} of ${total}…`),
        );
      }

      await markVisited();
      router.replace({ pathname: '/memory/[id]', params: { id: memory.id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus(null);
    }
  }

  // A memory at a place on the "Want to go" list means you went: move it to "Been".
  async function markVisited() {
    if (!saved || saved.status !== 'want') return;
    await supabase.from('saved_places').update({ status: 'visited' }).eq('id', saved.id);
    logInteraction(group.id, { placeId: saved.place_id, types: saved.types, priceLevel: saved.price_level }, 'visit', 'list');
  }

  if (!loaded) return error ? <ErrorText>{error}</ErrorText> : <Loading />;

  // Place options: the chosen one first so it's visible without scrolling, then the rest of the list.
  const options: PlaceRef[] = [
    ...(original && !places.data?.some((p) => p.place_id === original.placeId) ? [original] : []),
    ...(places.data ?? []).map((p) => ({ placeId: p.place_id, name: p.name })),
  ];
  const chosen = options.find((o) => o.placeId === selected?.placeId);
  const ordered = chosen ? [chosen, ...options.filter((o) => o !== chosen)] : options;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {editId && <Stack.Screen options={{ title: 'Edit memory' }} />}
        {!editId && <PhotoPickerStrip assets={photos} onChange={setPhotos} />}
        {!editId && photos.length > 0 && (
          <ThemedText type="small" themeColor="textSecondary">
            Originals stay in your camera roll. A smaller copy is shared with the group. Long-press to remove.
          </ThemedText>
        )}

        <Input
          label="Title"
          placeholder={selected?.name ?? 'Picnic in the park'}
          value={title}
          onChangeText={setTitle}
          maxLength={120}
        />
        <DateField label="When" value={day} onChange={setDay} />

        <View style={{ gap: Spacing.two }}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            Where (optional)
          </ThemedText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginHorizontal: -Spacing.four }}
            contentContainerStyle={{ gap: Spacing.two, paddingHorizontal: Spacing.four }}>
            <Chip label="Not a saved place" tone="track" selected={!selected} onPress={() => setSelected(null)} />
            {ordered.map((o) => (
              <Chip
                key={o.placeId}
                label={o.name}
                tone="track"
                selected={o.placeId === selected?.placeId}
                onPress={() => setSelected(o)}
              />
            ))}
          </ScrollView>
        </View>

        <Input
          label="Notes"
          placeholder="What made it special?"
          value={notes}
          onChangeText={setNotes}
          multiline
        />

        <ErrorText>{error}</ErrorText>
        <Button title={status ?? (editId ? 'Save changes' : 'Save memory')} onPress={save} disabled={!!status} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.four, gap: Spacing.three, paddingBottom: Spacing.six },
});
