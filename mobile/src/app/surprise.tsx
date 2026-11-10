import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { PastelView } from '@/components/pastel';
import { ThemedText } from '@/components/themed-text';
import { Button, Chip, Empty, ErrorText, Loading } from '@/components/ui';
import { Pastel, pastelAt, Radius, Spacing } from '@/constants/theme';
import { distanceLabel, prettyType, priceLabel } from '@/lib/format';
import { distanceMeters } from '@/lib/geo';
import { useActiveGroup } from '@/lib/groups';
import { useLocation } from '@/lib/location';
import { pickRandom, surpriseCandidates, type SurpriseFilter } from '@/lib/plan';
import { supabase } from '@/lib/supabase';
import type { SavedPlace } from '@/lib/types';
import { must, useQuery } from '@/lib/use-query';

const SPIN_MS = 1100;
const TICK_MS = 90;
const PRICES: { label: string; max: number | null }[] = [
  { label: 'Any budget', max: null },
  { label: '₹', max: 1 },
  { label: '₹₹', max: 2 },
  { label: '₹₹₹', max: 3 },
];

// Picks a random place from the group's to-try list. Nothing is saved; it only reads the wishlist.
export default function SurpriseScreen() {
  const group = useActiveGroup();
  const { coords } = useLocation();
  const [filter, setFilter] = useState<SurpriseFilter>({ maxPrice: null, type: null });
  const [shown, setShown] = useState<SavedPlace | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [round, setRound] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const query = useQuery(
    async () =>
      must<SavedPlace[]>(await supabase.from('saved_places').select('*').eq('group_id', group.id).eq('status', 'want')),
    [group.id],
  );

  const all = query.data ?? [];
  const pool = useMemo(() => surpriseCandidates(all, filter), [all, filter]);
  const types = useMemo(() => [...new Set(all.map((p) => p.primary_type).filter((t): t is string => !!t))].sort(), [all]);

  useEffect(() => () => void (timer.current && clearInterval(timer.current)), []);

  function spin() {
    if (pool.length === 0 || spinning) return;
    const final = pickRandom(pool, shown?.id);
    if (!final) return;
    setSpinning(true);
    setRound((r) => r + 1);
    // Flick through names for a moment, then land on the pick.
    timer.current = setInterval(() => setShown(pickRandom(pool) ?? final), TICK_MS);
    setTimeout(() => {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
      setShown(final);
      setSpinning(false);
    }, SPIN_MS);
  }

  // A filter change makes the old pick stale.
  function change(next: SurpriseFilter) {
    setFilter(next);
    setShown(null);
  }

  if (!query.data && query.loading) return <Loading />;

  if (all.length === 0) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Empty
          color={Pastel.yellow}
          title="Nothing to pick from"
          body="Surprise me chooses from your to-try list. Add a few places first."
          action={<Button title="Find a place" icon="search" small onPress={() => router.push('/search')} />}
        />
      </ScrollView>
    );
  }

  const distance =
    shown && coords && shown.lat != null && shown.lng != null
      ? distanceLabel(distanceMeters(coords, { lat: shown.lat, lng: shown.lng }))
      : null;
  const meta = shown
    ? [prettyType(shown.primary_type), priceLabel(shown.price_level), distance, shown.locality].filter(Boolean).join(' · ')
    : '';

  function pollThese() {
    if (!shown) return;
    const others = pool.filter((p) => p.id !== shown.id).sort(() => Math.random() - 0.5).slice(0, 2);
    router.push({ pathname: '/polls/new', params: { preselect: [shown.id, ...others.map((p) => p.id)].join(',') } });
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedText themeColor="textSoft">Can&apos;t decide? Let Pix choose from your to-try list.</ThemedText>

      <View style={styles.chips}>
        {PRICES.map((p) => (
          <Chip
            key={p.label}
            label={p.label}
            tone="track"
            selected={filter.maxPrice === p.max}
            onPress={() => change({ ...filter, maxPrice: p.max })}
          />
        ))}
      </View>
      {types.length > 1 && (
        <View style={styles.chips}>
          <Chip label="Anything" tone="track" selected={filter.type == null} onPress={() => change({ ...filter, type: null })} />
          {types.map((t) => (
            <Chip key={t} label={prettyType(t)} tone="track" selected={filter.type === t} onPress={() => change({ ...filter, type: t })} />
          ))}
        </View>
      )}

      <PastelView color={pastelAt(round)} style={styles.card}>
        {shown ? (
          <>
            <ThemedText type="smallBold" themeColor="textSoft">
              {spinning ? 'Picking…' : 'Tonight, how about'}
            </ThemedText>
            <ThemedText type="title" numberOfLines={3}>
              {shown.name}
            </ThemedText>
            {!!meta && <ThemedText themeColor="textSoft">{meta}</ThemedText>}
          </>
        ) : (
          <>
            <ThemedText type="subtitle">{pool.length === 0 ? 'No place matches' : 'Ready when you are'}</ThemedText>
            <ThemedText themeColor="textSoft">
              {pool.length === 0
                ? 'Try a different budget or type.'
                : `${pool.length} ${pool.length === 1 ? 'place' : 'places'} to choose from.`}
            </ThemedText>
          </>
        )}
      </PastelView>

      <ErrorText>{query.error}</ErrorText>

      <Button
        title={shown ? 'Spin again' : 'Surprise me'}
        icon="sparkle"
        onPress={spin}
        loading={spinning}
        disabled={pool.length === 0}
      />
      {shown && !spinning && (
        <View style={{ gap: Spacing.two }}>
          <Button
            title="Let's go here"
            icon="pin"
            variant="white"
            onPress={() => router.push({ pathname: '/place/[id]', params: { id: shown.id, color: pastelAt(round) } })}
          />
          {pool.length > 1 && <Button title="Start a poll with this" icon="check" variant="white" onPress={pollThese} />}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.four, gap: Spacing.three, paddingBottom: Spacing.six },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  card: { borderRadius: Radius.card, padding: Spacing.four, gap: Spacing.two, minHeight: 190, justifyContent: 'center' },
});
