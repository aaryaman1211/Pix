import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, TextInput, View } from 'react-native';

import { Icon } from '@/components/icon';
import { PlaceRow } from '@/components/place-row';
import { ThemedText } from '@/components/themed-text';
import { Button, Empty, ErrorText, Loading } from '@/components/ui';
import { Font, Pastel, Radius, Spacing, type Theme } from '@/constants/theme';
import { useColors, useStyles } from '@/hooks/use-theme';
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
  const c = useColors();
  const s = useStyles(makeStyles);
  const { coords, error: locationError, refresh: refreshLocation, pref } = useLocation();
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
    <View style={styles.screen}>
      <View style={s.searchBar}>
        <Icon name="search" size={18} color={c.textMuted} />
        <TextInput
          placeholder="Restaurant, café, anything…"
          placeholderTextColor={c.textMuted}
          keyboardAppearance={c.scheme}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={search}
          returnKeyType="search"
          autoFocus
          autoCorrect={false}
          style={s.searchInput}
        />
        <Button title="Search" small onPress={search} disabled={!coords || !query.trim()} />
      </View>

      {locationError && (
        <View style={styles.locationError}>
          <ErrorText>{locationError}</ErrorText>
          <Button title="Try again" small variant="secondary" onPress={refreshLocation} />
        </View>
      )}

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
            <Empty color={Pastel.sky} title="No matches" body="Try a different name or a broader search." />
          ) : (
            <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center', marginTop: Spacing.three }}>
              Searching within 50 km of {pref?.mode === 'custom' ? pref.label : 'you'}. Tap a result for its address and reviews.
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
              distance={coords ? distanceLabel(distanceMeters(coords, item)) : null}
              subtitle={item.locality}
              onPress={() => router.push({ pathname: '/place/preview', params: { data: JSON.stringify(item) } })}
              right={
                <Button
                  title={isSaved ? 'Saved' : 'Add'}
                  icon={isSaved ? 'check' : 'plus'}
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
  screen: { flex: 1 },
  locationError: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.three, gap: Spacing.two, alignItems: 'flex-start' },
  list: { paddingHorizontal: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.six },
});

const makeStyles = (c: Theme) =>
  StyleSheet.create({
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.two,
      margin: Spacing.three,
      paddingLeft: Spacing.three,
      paddingRight: 6,
      height: 56,
      backgroundColor: c.surface,
      borderRadius: Radius.pill,
      borderWidth: 1,
      borderColor: c.line,
    },
    searchInput: { flex: 1, fontSize: 16, fontFamily: Font.medium, color: c.text, height: '100%' },
  });
