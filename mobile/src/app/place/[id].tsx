import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, View } from 'react-native';

import { Bob } from '@/components/floating';
import { Icon } from '@/components/icon';
import { PastelView } from '@/components/pastel';
import { ThemedText } from '@/components/themed-text';
import { Avatar, Button, Card, Chip, ErrorText, IconCircle, Loading, Stars } from '@/components/ui';
import { Pastel, pastelAt, pastelFor, Radius, Spacing } from '@/constants/theme';
import { useColors } from '@/hooks/use-theme';
import { useUserId } from '@/lib/auth';
import { dayLabel, prettyType, priceLabel } from '@/lib/format';
import { useActiveGroup } from '@/lib/groups';
import { logInteraction } from '@/lib/interactions';
import { useMembers } from '@/lib/members';
import { mapsUrl } from '@/lib/places';
import { supabase } from '@/lib/supabase';
import type { Memory, Rating, SavedPlace } from '@/lib/types';
import { must, useQuery } from '@/lib/use-query';

export default function PlaceScreen() {
  const { id, color: colorParam } = useLocalSearchParams<{ id: string; color?: string }>();
  const group = useActiveGroup();
  const userId = useUserId();
  const members = useMembers(group.id);
  const c = useColors();
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

  if (!query.data || !place) {
    return <View style={styles.screen}>{query.error ? <ErrorText>{query.error}</ErrorText> : <Loading />}</View>;
  }
  const { ratings, memories } = query.data;
  const myRating = ratings.find((r) => r.user_id === userId)?.score ?? 0;
  const color = colorParam ?? pastelFor(place.place_id);

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

  const chips = [prettyType(place.primary_type), priceLabel(place.price_level), place.status === 'visited' ? 'Been' : 'Want to go'].filter(Boolean);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <PastelView color={color} style={styles.hero}>
        <Bob distance={10} ms={5000} style={styles.heroCircle}>
          <View style={{ flex: 1, borderRadius: 90, backgroundColor: color === Pastel.yellow ? Pastel.salmon : Pastel.yellow }} />
        </Bob>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
          {chips.map((c) => (
            <Chip key={c} label={c} />
          ))}
        </View>
        <ThemedText style={styles.title}>{place.name}</ThemedText>
        {place.address && <ThemedText themeColor="textSoft">{place.address}</ThemedText>}
      </PastelView>

      <View style={styles.actions}>
        <Button
          title={place.status === 'want' ? 'We went! Add a memory' : 'Add a memory'}
          icon="photo"
          onPress={() => router.push({ pathname: '/memory/new', params: { savedPlaceId: place.id } })}
          style={{ flex: 1 }}
        />
        <IconCircle
          icon="map"
          label="Open in Maps"
          size={54}
          color={c.surface}
          onPress={() => Linking.openURL(mapsUrl(place.name, place.place_id))}
        />
      </View>
      {place.status === 'want' && (
        <Button title="Mark as been, no memory" variant="secondary" small onPress={markVisited} />
      )}

      <Card>
        <ThemedText type="label" themeColor="textSecondary">
          Your rating
        </ThemedText>
        <View style={{ marginTop: Spacing.two }}>
          <Stars value={myRating} onChange={rate} />
        </View>
        {ratings
          .filter((r) => r.user_id !== userId)
          .map((r) => {
            const m = members.find((x) => x.id === r.user_id);
            return (
              <View key={r.user_id} style={styles.otherRating}>
                {m && <Avatar member={m} size={28} />}
                <ThemedText type="small" style={{ flex: 1 }}>
                  {r.profiles?.display_name || 'Someone'}
                </ThemedText>
                <Stars value={r.score} size={14} />
              </View>
            );
          })}
      </Card>

      {memories.length > 0 && (
        <View style={{ gap: Spacing.two }}>
          <ThemedText type="label" themeColor="textSecondary">
            Memories here
          </ThemedText>
          {memories.map((m, i) => (
            <Card
              key={m.id}
              color={pastelAt(i + 2)}
              onPress={() => router.push({ pathname: '/memory/[id]', params: { id: m.id } })}
              style={styles.memory}>
              <View style={{ flex: 1 }}>
                <ThemedText style={{ fontSize: 18, fontWeight: '700' }}>{m.title}</ThemedText>
                <ThemedText type="small" themeColor="textSoft">
                  {dayLabel(m.happened_on)}
                </ThemedText>
              </View>
              <Icon name="chevronRight" size={16} />
            </Card>
          ))}
        </View>
      )}

      <ErrorText>{error}</ErrorText>
      <Button title="Remove from list" icon="trash" variant="danger" small onPress={remove} />
    </ScrollView>
  );
}

function toFeatures(p: SavedPlace) {
  return { placeId: p.place_id, types: p.types, priceLevel: p.price_level };
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { padding: Spacing.four, paddingTop: Spacing.two, gap: Spacing.three, paddingBottom: Spacing.six },
  hero: {
    borderRadius: Radius.card,
    padding: Spacing.four,
    paddingTop: 120,
    gap: Spacing.two,
    overflow: 'hidden',
  },
  heroCircle: { position: 'absolute', width: 180, height: 180, top: -60, right: -40 },
  title: { fontSize: 36, lineHeight: 40, fontWeight: '800', letterSpacing: -1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  otherRating: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: Spacing.two },
  memory: { flexDirection: 'row', alignItems: 'center' },
});
