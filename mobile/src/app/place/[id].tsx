import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, ErrorText, Loading, Stars } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useUserId } from '@/lib/auth';
import { dayLabel, prettyType, priceLabel } from '@/lib/format';
import { useActiveGroup } from '@/lib/groups';
import { logInteraction } from '@/lib/interactions';
import { mapsUrl } from '@/lib/places';
import { supabase } from '@/lib/supabase';
import type { Memory, Rating, SavedPlace } from '@/lib/types';
import { must, useQuery } from '@/lib/use-query';

export default function PlaceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const group = useActiveGroup();
  const userId = useUserId();
  const [error, setError] = useState<string | null>(null);

  const query = useQuery(async () => {
    const place = must<SavedPlace>(await supabase.from('saved_places').select('*').eq('id', id).single());
    const [ratings, memories] = await Promise.all([
      supabase
        .from('ratings')
        .select('user_id, place_id, score, profiles(display_name)')
        .eq('group_id', place.group_id)
        .eq('place_id', place.place_id)
        .returns<Rating[]>(),
      supabase
        .from('memories')
        .select('*')
        .eq('group_id', place.group_id)
        .eq('place_id', place.place_id)
        .order('happened_on', { ascending: false }),
    ]);
    return { place, ratings: must<Rating[]>(ratings), memories: must<Memory[]>(memories) };
  }, [id]);

  const place = query.data?.place;
  const placeId = place?.place_id;
  useEffect(() => {
    if (place) logInteraction(group.id, toFeatures(place), 'view', 'list');
    // Log once per place, not on every refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeId]);

  if (!query.data || !place) return query.error ? <ErrorText>{query.error}</ErrorText> : <Loading />;
  const { ratings, memories } = query.data;
  const myRating = ratings.find((r) => r.user_id === userId)?.score ?? 0;

  async function rate(score: number) {
    const { error } = await supabase
      .from('ratings')
      .upsert(
        { group_id: group.id, user_id: userId, place_id: place!.place_id, score },
        { onConflict: 'group_id,user_id,place_id' },
      );
    if (error) return setError(error.message);
    logInteraction(group.id, toFeatures(place!), 'rate', 'list', score);
    query.reload();
  }

  async function markVisited() {
    const { error } = await supabase.from('saved_places').update({ status: 'visited' }).eq('id', place!.id);
    if (error) return setError(error.message);
    logInteraction(group.id, toFeatures(place!), 'visit', 'list');
    query.reload();
  }

  function remove() {
    Alert.alert(`Remove ${place!.name}?`, 'It will be taken off the list for everyone in the group.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('saved_places').delete().eq('id', place!.id);
          if (error) return setError(error.message);
          logInteraction(group.id, toFeatures(place!), 'unsave', 'list');
          router.back();
        },
      },
    ]);
  }

  const meta = [prettyType(place.primary_type), priceLabel(place.price_level)].filter(Boolean).join(' · ');

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: '' }} />
      <View style={{ gap: Spacing.one }}>
        <ThemedText style={styles.title}>{place.name}</ThemedText>
        <ThemedText themeColor="textSecondary">{meta}</ThemedText>
        {place.address && (
          <ThemedText type="small" themeColor="textSecondary">
            {place.address}
          </ThemedText>
        )}
      </View>

      <View style={styles.actions}>
        <Button
          title={place.status === 'want' ? 'We went! Add a memory' : 'Add a memory'}
          onPress={() => router.push({ pathname: '/memory/new', params: { savedPlaceId: place.id } })}
          style={{ flex: 1 }}
        />
        <Button title="Map" variant="secondary" onPress={() => Linking.openURL(mapsUrl(place.name, place.place_id))} />
      </View>
      {place.status === 'want' && (
        <Button title="Mark as been, no memory" variant="secondary" small onPress={markVisited} />
      )}

      <Card>
        <ThemedText type="smallBold" themeColor="textSecondary">
          Your rating
        </ThemedText>
        <Stars value={myRating} onChange={rate} />
        {ratings
          .filter((r) => r.user_id !== userId)
          .map((r) => (
            <View key={r.user_id} style={styles.otherRating}>
              <ThemedText type="small">{r.profiles?.display_name || 'Someone'}</ThemedText>
              <Stars value={r.score} size={16} />
            </View>
          ))}
      </Card>

      {memories.length > 0 && (
        <View style={{ gap: Spacing.two }}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            Memories here
          </ThemedText>
          {memories.map((m) => (
            <Card key={m.id} onPress={() => router.push({ pathname: '/memory/[id]', params: { id: m.id } })}>
              <ThemedText style={{ fontWeight: '600' }}>{m.title}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {dayLabel(m.happened_on)}
              </ThemedText>
            </Card>
          ))}
        </View>
      )}

      <ErrorText>{error}</ErrorText>
      <Button title="Remove from list" variant="danger" small onPress={remove} />
    </ScrollView>
  );
}

function toFeatures(p: SavedPlace) {
  return { placeId: p.place_id, types: p.types, priceLevel: p.price_level };
}

const styles = StyleSheet.create({
  container: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: Spacing.two },
  otherRating: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
