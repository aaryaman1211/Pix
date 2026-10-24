import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { InitialBadge, PlaceRow } from '@/components/place-row';
import { Button, Empty, ErrorText, Fab, Segmented, TabHeader, useTabBarSpace } from '@/components/ui';
import { Pastel, pastelAt, Spacing } from '@/constants/theme';
import { distanceLabel } from '@/lib/format';
import { distanceMeters } from '@/lib/geo';
import { useActiveGroup } from '@/lib/groups';
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
              <TabHeader title="Places" subtitle={`${wantCount} to try · ${beenCount} been`} />
            </View>
            <Segmented
              value={tab}
              onChange={setTab}
              options={[
                { value: 'want', label: 'Want to go' },
                { value: 'visited', label: 'Been' },
              ]}
            />
            <ErrorText>{places.error}</ErrorText>
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
            <PlaceRow
              name={item.name}
              type={item.primary_type}
              priceLevel={item.price_level}
              distance={distance}
              color={color}
              right={adder ? <InitialBadge initial={adder.initial} /> : null}
              onPress={() => router.push({ pathname: '/place/[id]', params: { id: item.id, color } })}
            />
          );
        }}
      />
      <Fab color={Pastel.yellow} label="Add a place" onPress={() => router.push('/search')} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { paddingHorizontal: Spacing.four, gap: Spacing.three - 4 },
});
