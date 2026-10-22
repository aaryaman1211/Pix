import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { PlaceRow } from '@/components/place-row';
import { ThemedText } from '@/components/themed-text';
import { Button, Chip, Empty, ErrorText, Loading, TabHeader } from '@/components/ui';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { distanceLabel, prettyType } from '@/lib/format';
import { invoke } from '@/lib/functions';
import { useActiveGroup } from '@/lib/groups';
import { logInteraction } from '@/lib/interactions';
import { useLocation } from '@/lib/location';
import { addPlace } from '@/lib/places';
import type { Recommendation } from '@/lib/types';

type Response = { results: Recommendation[]; topTypes: string[] };

export default function DiscoverScreen() {
  const group = useActiveGroup();
  const { coords, error: locationError, refresh: refreshLocation } = useLocation();
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!coords) return;
    setLoading(true);
    setError(null);
    try {
      setData(await invoke<Response>('recommend', { groupId: group.id, lat: coords.lat, lng: coords.lng }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [coords, group.id]);

  useEffect(() => {
    load();
  }, [load]);

  function drop(placeId: string) {
    setData((d) => d && { ...d, results: d.results.filter((r) => r.placeId !== placeId) });
  }

  async function save(r: Recommendation) {
    setBusy(r.placeId);
    const err = await addPlace(group.id, r);
    setBusy(null);
    if (err) return setError(err);
    logInteraction(group.id, r, 'save', 'recommend', r.score);
    drop(r.placeId);
  }

  function dismiss(r: Recommendation) {
    logInteraction(group.id, r, 'dismiss', 'recommend', r.score);
    drop(r.placeId);
  }

  return (
    <View style={{ flex: 1 }}>
      <TabHeader title="Discover" />
      <FlatList
        data={data?.results ?? []}
        keyExtractor={(r) => r.placeId}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={load} />}
        ListHeaderComponent={
          <View style={{ gap: Spacing.two }}>
            {data && data.topTypes.length > 0 && (
              <View style={styles.taste}>
                <ThemedText type="small" themeColor="textSecondary">
                  Your group likes
                </ThemedText>
                {data.topTypes.map((t) => (
                  <Chip key={t} label={prettyType(t)} />
                ))}
              </View>
            )}
            {locationError && (
              <>
                <ErrorText>{locationError}</ErrorText>
                <Button title="Try again" small variant="secondary" onPress={refreshLocation} />
              </>
            )}
            <ErrorText>{error}</ErrorText>
          </View>
        }
        ListEmptyComponent={
          loading || (!coords && !locationError) ? (
            <Loading />
          ) : data ? (
            <Empty
              title="That's everything nearby"
              body="Save or skip a few places and pull down to refresh. Suggestions get better the more you use Pix."
            />
          ) : undefined
        }
        renderItem={({ item }) => (
          <View style={{ gap: Spacing.two }}>
            <PlaceRow
              name={item.name}
              type={item.primaryType}
              priceLevel={item.priceLevel}
              rating={item.rating}
              subtitle={distanceLabel(item.distanceM)}
              note={item.reason}
              right={
                <View style={{ gap: Spacing.one }}>
                  <Button title="Save" small loading={busy === item.placeId} onPress={() => save(item)} />
                  <Button title="Skip" small variant="secondary" onPress={() => dismiss(item)} />
                </View>
              }
            />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: Spacing.three, gap: Spacing.two, paddingBottom: BottomTabInset + Spacing.four },
  taste: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.two },
});
