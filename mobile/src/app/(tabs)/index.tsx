import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { PlaceRow } from '@/components/place-row';
import { AddButton, Button, Empty, ErrorText, Segmented, TabHeader } from '@/components/ui';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useActiveGroup } from '@/lib/groups';
import { supabase } from '@/lib/supabase';
import type { SavedPlace } from '@/lib/types';
import { must, useQuery } from '@/lib/use-query';

type Tab = 'want' | 'visited';

export default function PlacesScreen() {
  const group = useActiveGroup();
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

  return (
    <View style={{ flex: 1 }}>
      <TabHeader title="Places" action={<AddButton label="Add a place" onPress={() => router.push('/search')} />} />
      <FlatList
        data={shown}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={places.loading && !!places.data} onRefresh={places.reload} />}
        ListHeaderComponent={
          <View style={{ gap: Spacing.two }}>
            <Segmented
              value={tab}
              onChange={setTab}
              options={[
                { value: 'want', label: `Want to go (${wantCount})` },
                { value: 'visited', label: `Been (${all.length - wantCount})` },
              ]}
            />
            <ErrorText>{places.error}</ErrorText>
          </View>
        }
        ListEmptyComponent={
          places.loading ? undefined : tab === 'want' ? (
            <Empty
              title="Nothing on the list yet"
              body="Add the places you keep saying you should try."
              action={<Button title="Add a place" small onPress={() => router.push('/search')} />}
            />
          ) : (
            <Empty title="No visits yet" body="When you go somewhere on your list, mark it as visited." />
          )
        }
        renderItem={({ item }) => (
          <PlaceRow
            name={item.name}
            type={item.primary_type}
            priceLevel={item.price_level}
            subtitle={item.address}
            onPress={() => router.push({ pathname: '/place/[id]', params: { id: item.id } })}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: Spacing.three, gap: Spacing.two, paddingBottom: BottomTabInset + Spacing.four },
});
