import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Bob } from '@/components/floating';
import { PastelView } from '@/components/pastel';
import { PlaceDetailsSection } from '@/components/place-details';
import { ThemedText } from '@/components/themed-text';
import { Button, Chip, ErrorText } from '@/components/ui';
import { Pastel, pastelFor, Radius, Spacing } from '@/constants/theme';
import { distanceLabel, prettyType, priceLabel } from '@/lib/format';
import { distanceMeters } from '@/lib/geo';
import { useActiveGroup } from '@/lib/groups';
import { logInteraction } from '@/lib/interactions';
import { useLocation } from '@/lib/location';
import { usePlaceDetails } from '@/lib/place-details';
import { addPlace } from '@/lib/places';
import { supabase } from '@/lib/supabase';
import type { PlaceResult } from '@/lib/types';
import { must, useQuery } from '@/lib/use-query';

// A place from search that isn't necessarily on the list yet: its details, plus "Add to list".
// The search result is passed in as JSON so the card can draw before details arrive.
export default function PlacePreviewScreen() {
  const { data } = useLocalSearchParams<{ data: string }>();
  const place = JSON.parse(data) as PlaceResult;
  const group = useActiveGroup();
  const { coords } = useLocation();
  const { details, error: detailsError } = usePlaceDetails(place.placeId);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saved = useQuery(
    async () =>
      must<{ id: string }[]>(
        await supabase.from('saved_places').select('id').eq('group_id', group.id).eq('place_id', place.placeId),
      )[0] ?? null,
    [group.id, place.placeId],
  );

  async function add() {
    setAdding(true);
    setError(null);
    const err = await addPlace(group.id, { ...place, locality: place.locality ?? details?.locality });
    setAdding(false);
    if (err) return setError(err);
    logInteraction(group.id, { ...place, distanceM: coords ? distanceMeters(coords, place) : null }, 'save', 'search');
    saved.reload();
  }

  const color = pastelFor(place.placeId);
  const chips = [prettyType(place.primaryType), priceLabel(place.priceLevel), coords ? distanceLabel(distanceMeters(coords, place)) : '']
    .filter(Boolean);
  const locality = place.locality ?? details?.locality;
  const rating = place.rating
    ? `${place.rating.toFixed(1)} ★${place.ratingCount ? ` · ${place.ratingCount.toLocaleString()} reviews` : ''}`
    : null;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.container}>
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
        {locality && <ThemedText themeColor="textSoft">{locality}</ThemedText>}
        {rating && <ThemedText themeColor="textSoft">{rating}</ThemedText>}
      </PastelView>

      {saved.data ? (
        <Button
          title="On your list · Open"
          icon="check"
          variant="secondary"
          onPress={() => router.replace({ pathname: '/place/[id]', params: { id: saved.data!.id, color } })}
        />
      ) : (
        <Button title="Add to list" icon="plus" onPress={add} loading={adding || saved.loading} />
      )}
      <ErrorText>{error}</ErrorText>

      <PlaceDetailsSection details={details} error={detailsError} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.four, paddingTop: Spacing.two, gap: Spacing.three, paddingBottom: Spacing.six },
  hero: { borderRadius: Radius.card, padding: Spacing.four, paddingTop: 120, gap: Spacing.two, overflow: 'hidden' },
  heroCircle: { position: 'absolute', width: 180, height: 180, top: -60, right: -40 },
  title: { fontSize: 36, lineHeight: 40, fontWeight: '800', letterSpacing: -1 },
});
