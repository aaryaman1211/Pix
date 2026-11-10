import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Button, Empty, ErrorText, Input, Loading } from '@/components/ui';
import { Pastel, Radius, Spacing } from '@/constants/theme';
import { useColors } from '@/hooks/use-theme';
import { prettyType, priceLabel } from '@/lib/format';
import { useActiveGroup } from '@/lib/groups';
import { supabase } from '@/lib/supabase';
import type { SavedPlace } from '@/lib/types';
import { must, useQuery } from '@/lib/use-query';

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 6;

// Start a poll from the places on the group's wishlist. `preselect` (comma-separated saved place ids)
// lets other screens, e.g. "Surprise me", start a poll with places already ticked.
export default function NewPollScreen() {
  const group = useActiveGroup();
  const c = useColors();
  const { preselect } = useLocalSearchParams<{ preselect?: string }>();
  const [title, setTitle] = useState('Where should we go?');
  const [picked, setPicked] = useState<string[]>(() => (preselect ? preselect.split(',').filter(Boolean) : []));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const places = useQuery(
    async () =>
      must<SavedPlace[]>(
        await supabase.from('saved_places').select('*').eq('group_id', group.id).eq('status', 'want').order('created_at', { ascending: false }),
      ),
    [group.id],
  );

  function toggle(id: string) {
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= MAX_OPTIONS ? cur : [...cur, id]));
  }

  async function create() {
    setSaving(true);
    setError(null);
    try {
      const chosen = (places.data ?? []).filter((p) => picked.includes(p.id));
      const poll = must<{ id: string }>(
        await supabase.from('polls').insert({ group_id: group.id, title: title.trim() }).select('id').single(),
      );
      must(
        await supabase.from('poll_options').insert(
          chosen.map((p) => ({
            poll_id: poll.id,
            group_id: group.id,
            place_id: p.place_id,
            name: p.name,
            address: p.address,
            locality: p.locality,
            primary_type: p.primary_type,
            types: p.types,
            price_level: p.price_level,
            lat: p.lat,
            lng: p.lng,
          })),
        ),
      );
      router.replace({ pathname: '/polls/[id]', params: { id: poll.id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  if (!places.data && places.loading) return <Loading />;
  const list = places.data ?? [];

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
      <Input label="Question" value={title} onChangeText={setTitle} maxLength={120} />
      <ThemedText type="smallBold" themeColor="textMuted">
        Pick {MIN_OPTIONS}–{MAX_OPTIONS} places from your list ({picked.length} picked)
      </ThemedText>

      {list.length < MIN_OPTIONS ? (
        <Empty
          color={Pastel.yellow}
          title="Add a few places first"
          body="Polls choose between places on your to-try list. Save at least two."
          action={<Button title="Find a place" icon="search" small onPress={() => router.push('/search')} />}
        />
      ) : (
        <View style={{ gap: Spacing.two }}>
          {list.map((p) => {
            const on = picked.includes(p.id);
            return (
              <Pressable
                key={p.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                onPress={() => toggle(p.id)}
                style={[styles.row, { backgroundColor: on ? Pastel.lavender : c.surface, borderColor: on ? 'transparent' : c.line }]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <ThemedText style={{ fontWeight: '700', color: on ? '#16161A' : c.text }} numberOfLines={1}>
                    {p.name}
                  </ThemedText>
                  <ThemedText type="small" style={{ color: on ? '#3A3A42' : c.textMuted }} numberOfLines={1}>
                    {[prettyType(p.primary_type), priceLabel(p.price_level), p.locality].filter(Boolean).join(' · ')}
                  </ThemedText>
                </View>
                {on && <Icon name="check" size={18} color="#16161A" />}
              </Pressable>
            );
          })}
        </View>
      )}

      <ErrorText>{error ?? places.error}</ErrorText>
      <Button
        title="Start poll"
        icon="check"
        onPress={create}
        loading={saving}
        disabled={!title.trim() || picked.length < MIN_OPTIONS}
      />
      <ThemedText type="small" themeColor="textSecondary">
        Everyone in {group.name} can vote once, and change their vote until you close the poll.
      </ThemedText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.four, gap: Spacing.three, paddingBottom: Spacing.six },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.field,
    paddingHorizontal: Spacing.three + 2,
    paddingVertical: Spacing.three - 2,
  },
});
