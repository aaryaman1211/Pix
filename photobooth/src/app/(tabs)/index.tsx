import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';

import { Icon } from '@/components/icon';
import { PastelScope } from '@/components/pastel';
import { InitialBadge, PlaceRow } from '@/components/place-row';
import { ThemedText } from '@/components/themed-text';
import { Button, Empty, ErrorText, Fab, TabHeader, useTabBarSpace } from '@/components/ui';
import { Pastel, pastelAt, Radius, Spacing } from '@/constants/theme';
import { useColors } from '@/hooks/use-theme';
import { distanceLabel } from '@/lib/format';
import { distanceMeters } from '@/lib/geo';
import { useActiveGroup } from '@/lib/groups';
import { logInteraction } from '@/lib/interactions';
import { useLocation } from '@/lib/location';
import { useMembers } from '@/lib/members';
import { supabase } from '@/lib/supabase';
import type { SavedPlace } from '@/lib/types';
import { must, useQuery } from '@/lib/use-query';

type Tab = 'want' | 'visited';

export default function PlacesScreen() {
  const group = useActiveGroup();
  const members = useMembers(group.id);
  const { coords } = useLocation();
  const bottomSpace = useTabBarSpace();
  const [tab, setTab] = useState<Tab>('want');
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

  const all = places.data ?? [];
  const shown = all.filter((p) => p.status === tab);
  const wantCount = all.filter((p) => p.status === 'want').length;
  const beenCount = all.length - wantCount;

  // Swipe-to-remove: drop it from the list straight away, then delete it for the group.
  async function remove(place: SavedPlace) {
    setError(null);
    places.setData(all.filter((p) => p.id !== place.id));
    const { error } = await supabase.from('saved_places').delete().eq('id', place.id);
    if (error) {
      setError(error.message);
      places.reload();
      return;
    }
    logInteraction(group.id, { placeId: place.place_id, types: place.types, priceLevel: place.price_level }, 'unsave', 'list');
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={shown}
        keyExtractor={(p) => p.id}
        contentContainerStyle={[styles.list, { paddingBottom: bottomSpace + 72 }]}
        refreshControl={<RefreshControl refreshing={places.loading && !!places.data} onRefresh={places.reload} />}
        ListHeaderComponent={
          <View style={{ gap: Spacing.three, marginBottom: Spacing.one }}>
            <View style={{ marginHorizontal: -Spacing.four }}>
              <TabHeader title="Places" />
            </View>
            <View style={styles.tiles}>
              <CountTile count={wantCount} label="to try" color={Pastel.salmon} selected={tab === 'want'} onPress={() => setTab('want')} />
              <CountTile count={beenCount} label="been" color={Pastel.mint} selected={tab === 'visited'} onPress={() => setTab('visited')} />
            </View>
            <ErrorText>{places.error ?? error}</ErrorText>
          </View>
        }
        ListEmptyComponent={
          places.loading ? undefined : tab === 'want' ? (
            <Empty
              color={Pastel.yellow}
              title="Nothing on the list yet"
              body="Add the places you keep saying you should try."
              action={<Button title="Find a place" icon="search" small onPress={() => router.push('/search')} />}
            />
          ) : (
            <Empty
              color={Pastel.mint}
              title="No visits yet"
              body="When you go somewhere on your list, add a memory and it moves here."
            />
          )
        }
        renderItem={({ item, index }) => {
          const color = pastelAt(index);
          const adder = members.find((m) => m.id === item.added_by);
          const distance =
            coords && item.lat != null && item.lng != null
              ? distanceLabel(distanceMeters(coords, { lat: item.lat, lng: item.lng }))
              : null;
          return (
            <ReanimatedSwipeable
              friction={2}
              rightThreshold={40}
              overshootRight={false}
              renderRightActions={(_progress, _translation, swipe) => (
                <RemoveAction
                  onPress={() => {
                    swipe.close();
                    remove(item);
                  }}
                />
              )}>
              <PlaceRow
                name={item.name}
                type={item.primary_type}
                priceLevel={item.price_level}
                distance={distance}
                subtitle={item.locality}
                color={color}
                right={adder ? <InitialBadge initial={adder.initial} /> : null}
                onPress={() => router.push({ pathname: '/place/[id]', params: { id: item.id, color } })}
              />
            </ReanimatedSwipeable>
          );
        }}
      />
      <Fab color={Pastel.yellow} label="Add a place" onPress={() => router.push('/search')} />
    </View>
  );
}

// Big number + label; the selected one is filled with its pastel, the other sits back in grey.
function CountTile({
  count,
  label,
  color,
  selected,
  onPress,
}: {
  count: number;
  label: string;
  color: string;
  selected: boolean;
  onPress: () => void;
}) {
  const c = useColors();
  const body = (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={`${count} ${label}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor: selected ? color : c.track },
        pressed && { transform: [{ scale: 0.97 }] },
      ]}>
      <ThemedText style={styles.tileCount} themeColor={selected ? 'text' : 'textMuted'}>
        {count}
      </ThemedText>
      <ThemedText style={styles.tileLabel} themeColor={selected ? 'text' : 'textMuted'}>
        {label}
      </ThemedText>
    </Pressable>
  );
  return selected ? <PastelScope>{body}</PastelScope> : body;
}

function RemoveAction({ onPress }: { onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Remove from list"
      onPress={onPress}
      style={({ pressed }) => [styles.remove, { backgroundColor: c.danger }, pressed && { opacity: 0.8 }]}>
      <Icon name="trash" size={20} color="#FFFFFF" />
      <ThemedText type="smallBold" style={{ color: '#FFFFFF' }}>
        Remove
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { paddingHorizontal: Spacing.four, gap: Spacing.three - 4 },
  tiles: { flexDirection: 'row', gap: Spacing.two },
  tile: { flex: 1, borderRadius: Radius.tile, paddingHorizontal: Spacing.three + 2, paddingVertical: Spacing.three },
  tileCount: { fontSize: 44, lineHeight: 48, fontWeight: '800', letterSpacing: -1.5 },
  tileLabel: { fontSize: 15, fontWeight: '700' },
  remove: {
    width: 96,
    marginLeft: Spacing.two,
    borderRadius: Radius.tile,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
});
