import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { PlaceRow } from '@/components/place-row';
import { ThemedText } from '@/components/themed-text';
import { Button, Empty, ErrorText, Input, Loading } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { distanceLabel } from '@/lib/format';
import { invoke } from '@/lib/functions';
import { distanceMeters } from '@/lib/geo';
import { useActiveGroup } from '@/lib/groups';
import { logInteraction } from '@/lib/interactions';
import { useLocation } from '@/lib/location';
import { addPlace } from '@/lib/places';
import { supabase } from '@/lib/supabase';
import type { PlaceResult } from '@/lib/types';
import { must, useQuery } from '@/lib/use-query';

export default function SearchScreen() {
  const group = useActiveGroup();
  const { coords, error: locationError } = useLocation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);

  const saved = useQuery(
    async () =>
      new Set(
        must<{ place_id: string }[]>(
          await supabase.from('saved_places').select('place_id').eq('group_id', group.id),
        ).map((p) => p.place_id),
      ),
    [group.id],
  );

  async function search() {
    if (!coords || !query.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const data = await invoke<{ results: PlaceResult[] }>('places-search', {
        query: query.trim(),
        lat: coords.lat,
        lng: coords.lng,
        radiusM: group.search_radius_m,
      });
      setResults(data.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSearching(false);
    }
  }

  async function add(place: PlaceResult) {
    setAdding(place.placeId);
    const distanceM = coords ? distanceMeters(coords, place) : null;
    const err = await addPlace(group.id, place);
    setAdding(null);
    if (err) return setError(err);
    logInteraction(group.id, { ...place, distanceM }, 'save', 'search');
    saved.setData(new Set([...(saved.data ?? []), place.placeId]));
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.searchBar}>
        <View style={{ flex: 1 }}>
          <Input
            placeholder="Restaurant, café, anything…"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={search}
            returnKeyType="search"
            autoFocus
            autoCorrect={false}
          />
        </View>
        <Button title="Search" small onPress={search} disabled={!coords || !query.trim()} style={{ minHeight: 48 }} />
      </View>
      <ErrorText>{locationError}</ErrorText>

      <FlatList
        data={results ?? []}
        keyExtractor={(p) => p.placeId}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={<ErrorText>{error}</ErrorText>}
        ListEmptyComponent={
          searching ? (
            <Loading />
          ) : results ? (
            <Empty title="No matches" body="Try a different name or a broader search." />
          ) : (
            <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
              Searching within {group.search_radius_m / 1000} km of you
            </ThemedText>
          )
        }
        renderItem={({ item }) => {
          const isSaved = saved.data?.has(item.placeId);
          return (
            <PlaceRow
              name={item.name}
              type={item.primaryType}
              priceLevel={item.priceLevel}
              rating={item.rating}
              subtitle={[coords && distanceLabel(distanceMeters(coords, item)), item.address].filter(Boolean).join(' · ')}
              right={
                <Button
                  title={isSaved ? 'Saved' : 'Add'}
                  small
                  variant={isSaved ? 'secondary' : 'primary'}
                  disabled={isSaved}
                  loading={adding === item.placeId}
                  onPress={() => add(item)}
                />
              }
            />
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  searchBar: { flexDirection: 'row', gap: Spacing.two, padding: Spacing.three, alignItems: 'center' },
  list: { paddingHorizontal: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.six },
});
