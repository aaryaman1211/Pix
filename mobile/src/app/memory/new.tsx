import type { ImagePickerAsset } from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { DateField } from '@/components/date-field';
import { PhotoPickerStrip } from '@/components/photo-picker-strip';
import { ThemedText } from '@/components/themed-text';
import { Button, Chip, ErrorText, Input } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { toDay } from '@/lib/format';
import { useActiveGroup } from '@/lib/groups';
import { logInteraction } from '@/lib/interactions';
import { uploadPhotos } from '@/lib/photos';
import { supabase } from '@/lib/supabase';
import type { SavedPlace } from '@/lib/types';
import { must, useQuery } from '@/lib/use-query';

export default function NewMemoryScreen() {
  const { savedPlaceId } = useLocalSearchParams<{ savedPlaceId?: string }>();
  const group = useActiveGroup();

  const [title, setTitle] = useState('');
  const [day, setDay] = useState(toDay(new Date()));
  const [notes, setNotes] = useState('');
  const [placeId, setPlaceId] = useState<string | null>(savedPlaceId ?? null);
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
  const place = places.data?.find((p) => p.id === placeId) ?? null;

  async function save() {
    setError(null);
    setStatus('Saving…');
    try {
      const memory = must<{ id: string }>(
        await supabase
          .from('memories')
          .insert({
            group_id: group.id,
            title: title.trim() || (place ? place.name : 'A good day'),
            happened_on: day,
            notes: notes.trim() || null,
            place_id: place?.place_id ?? null,
            place_name: place?.name ?? null,
          })
          .select('id')
          .single(),
      );

      if (photos.length) {
        await uploadPhotos(group.id, memory.id, photos, (done, total) =>
          setStatus(`Uploading photo ${done + 1} of ${total}…`),
        );
      }

      if (place && place.status === 'want') {
        await supabase.from('saved_places').update({ status: 'visited' }).eq('id', place.id);
        logInteraction(group.id, { placeId: place.place_id, types: place.types, priceLevel: place.price_level }, 'visit', 'list');
      }

      router.replace({ pathname: '/memory/[id]', params: { id: memory.id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus(null);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <PhotoPickerStrip assets={photos} onChange={setPhotos} />
        {photos.length > 0 && (
          <ThemedText type="small" themeColor="textSecondary">
            Originals stay in your camera roll. A smaller copy is shared with the group. Long-press to remove.
          </ThemedText>
        )}

        <Input
          label="Title"
          placeholder={place ? place.name : 'Picnic in the park'}
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
            <Chip label="Not a saved place" tone="track" selected={!placeId} onPress={() => setPlaceId(null)} />
            {places.data?.map((p) => (
              <Chip key={p.id} label={p.name} tone="track" selected={p.id === placeId} onPress={() => setPlaceId(p.id)} />
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
        <Button title={status ?? 'Save memory'} onPress={save} disabled={!!status} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.four, gap: Spacing.three, paddingBottom: Spacing.six },
});
