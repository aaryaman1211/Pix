import { useCallback, useEffect, useMemo, useState } from 'react';
import { Animated, PanResponder, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Bob } from '@/components/floating';
import { Icon } from '@/components/icon';
import { PastelScope } from '@/components/pastel';
import { ThemedText } from '@/components/themed-text';
import { Button, Chip, Empty, ErrorText, IconCircle, Loading, TabHeader, useTabBarSpace } from '@/components/ui';
import { OnPastel, Pastel, Radius, Spacing } from '@/constants/theme';
import { useColors } from '@/hooks/use-theme';
import { distanceLabel, prettyType, priceLabel } from '@/lib/format';
import { invoke } from '@/lib/functions';
import { useActiveGroup } from '@/lib/groups';
import { logInteraction } from '@/lib/interactions';
import { useLocation } from '@/lib/location';
import { addPlace } from '@/lib/places';
import type { Recommendation } from '@/lib/types';

type Response = { results: Recommendation[]; topTypes: string[] };

// Card colour, then the two decoration circles on it.
const CARD_THEMES = [
  [Pastel.lavender, Pastel.yellow, Pastel.salmon],
  [Pastel.mint, Pastel.sky, Pastel.yellow],
  [Pastel.yellow, Pastel.salmon, Pastel.lavender],
  [Pastel.salmon, Pastel.yellow, Pastel.mint],
  [Pastel.sky, Pastel.mint, Pastel.salmon],
] as const;

const SWIPE_THRESHOLD = 110;

export default function DiscoverScreen() {
  const group = useActiveGroup();
  const c = useColors();
  const { coords, error: locationError, refresh: refreshLocation, pref } = useLocation();
  const { width } = useWindowDimensions();
  const bottomSpace = useTabBarSpace();
  const [data, setData] = useState<Response | null>(null);
  const [seen, setSeen] = useState(0); // how many cards have been swiped, for colour rotation
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pos] = useState(() => new Animated.ValueXY());

  const load = useCallback(async () => {
    if (!coords) return;
    setLoading(true);
    setError(null);
    try {
      setData(await invoke<Response>('recommend', { groupId: group.id, lat: coords.lat, lng: coords.lng }));
      setSeen(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [coords, group.id]);

  useEffect(() => {
    load();
  }, [load]);

  const results = data?.results ?? [];
  const top = results[0];
  const next = results[1];

  const decide = useCallback(
    async (item: Recommendation, action: 'save' | 'dismiss') => {
      setData((d) => d && { ...d, results: d.results.filter((r) => r.placeId !== item.placeId) });
      setSeen((n) => n + 1);
      pos.setValue({ x: 0, y: 0 });
      if (action === 'save') {
        const err = await addPlace(group.id, item);
        if (err) return setError(err);
      }
      logInteraction(group.id, item, action, 'recommend', item.score);
    },
    [group.id, pos],
  );

  const fling = useCallback(
    (dir: 1 | -1) => {
      if (!top) return;
      Animated.timing(pos, {
        toValue: { x: dir * width * 1.4, y: 40 },
        duration: 220,
        useNativeDriver: false,
      }).start(() => decide(top, dir > 0 ? 'save' : 'dismiss'));
    },
    [top, pos, width, decide],
  );

  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderMove: Animated.event([null, { dx: pos.x, dy: pos.y }], { useNativeDriver: false }),
        onPanResponderRelease: (_e, g) => {
          if (g.dx > SWIPE_THRESHOLD || g.vx > 0.8) fling(1);
          else if (g.dx < -SWIPE_THRESHOLD || g.vx < -0.8) fling(-1);
          else Animated.spring(pos, { toValue: { x: 0, y: 0 }, useNativeDriver: false, friction: 6 }).start();
        },
      }),
    [pos, fling],
  );

  const rotate = pos.x.interpolate({ inputRange: [-width, 0, width], outputRange: ['-14deg', '0deg', '14deg'] });
  const saveOpacity = pos.x.interpolate({ inputRange: [0, SWIPE_THRESHOLD], outputRange: [0, 1], extrapolate: 'clamp' });
  const skipOpacity = pos.x.interpolate({ inputRange: [-SWIPE_THRESHOLD, 0], outputRange: [1, 0], extrapolate: 'clamp' });

  const km = group.search_radius_m / 1000;
  let body;
  if (locationError) {
    body = (
      <Empty
        color={Pastel.sky}
        title="Where are you?"
        body={locationError}
        action={<Button title="Try again" small onPress={refreshLocation} />}
      />
    );
  } else if (!data || (loading && results.length === 0)) {
    body = error ? null : <Loading />;
  } else if (!top) {
    body = (
      <Empty
        title="That's everything nearby"
        body="Save or skip a few more and Pix learns what you like. Check back for fresh picks."
        action={<Button title="Find more" small onPress={load} loading={loading} />}
      />
    );
  } else {
    body = (
      <View style={{ flex: 1 }}>
        <View style={styles.deck}>
          {next && (
            <View style={[styles.card, styles.behind, { backgroundColor: CARD_THEMES[(seen + 1) % CARD_THEMES.length][0] }]} />
          )}
          <Animated.View
            {...responder.panHandlers}
            style={[styles.card, { transform: [{ translateX: pos.x }, { translateY: pos.y }, { rotate }] }]}>
            <PlaceCard item={top} theme={CARD_THEMES[seen % CARD_THEMES.length]} />
            <Animated.View style={[styles.stamp, styles.stampSave, { opacity: saveOpacity }]}>
              <ThemedText type="smallBold" style={{ color: OnPastel.text }}>SAVE</ThemedText>
            </Animated.View>
            <Animated.View style={[styles.stamp, styles.stampSkip, { opacity: skipOpacity }]}>
              <ThemedText type="smallBold" style={{ color: OnPastel.text }}>SKIP</ThemedText>
            </Animated.View>
          </Animated.View>
        </View>
        <View style={styles.actions}>
          <IconCircle icon="close" label="Skip" size={60} color={c.surface} onPress={() => fling(-1)} />
          <Button title="Save to list" icon="heart" onPress={() => fling(1)} style={{ flex: 1 }} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <TabHeader
        title="Discover"
        subtitle={`Picked for ${group.name} · within ${km} km${pref?.mode === 'custom' ? ` of ${pref.label}` : ''}`}
      />
      <View style={[styles.body, { paddingBottom: bottomSpace }]}>
        <ErrorText>{error}</ErrorText>
        {body}
      </View>
    </View>
  );
}

function PlaceCard({ item, theme }: { item: Recommendation; theme: readonly [string, string, string] }) {
  const [bg, big, small] = theme;
  const chips = [prettyType(item.primaryType), priceLabel(item.priceLevel), distanceLabel(item.distanceM)].filter(Boolean);
  const rating = item.rating
    ? `${item.rating.toFixed(1)} ★${item.ratingCount ? ` · ${item.ratingCount.toLocaleString()} reviews` : ''}`
    : null;
  return (
    <PastelScope>
    <View style={[StyleSheet.absoluteFill, styles.cardInner, { backgroundColor: bg }]}>
      <Bob distance={12} ms={5200} style={styles.circleBig}>
        <View style={[styles.circleFill, { backgroundColor: big, borderRadius: 115 }]} />
      </Bob>
      <Bob distance={9} ms={3400} delay={600} style={styles.circleSmall}>
        <View style={[styles.circleFill, { backgroundColor: small, borderRadius: 36 }]} />
      </Bob>
      <View style={{ flex: 1 }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
        {chips.map((c) => (
          <Chip key={c} label={c} />
        ))}
      </View>
      <ThemedText style={styles.name} numberOfLines={2} adjustsFontSizeToFit>
        {item.name}
      </ThemedText>
      {(rating || item.locality) && (
        <ThemedText themeColor="textSoft">{[item.locality, rating].filter(Boolean).join(' · ')}</ThemedText>
      )}
      <View style={styles.reason}>
        <Icon name="sparkle" size={16} />
        <ThemedText type="smallBold" numberOfLines={1} style={{ flex: 1 }}>
          {item.reason}
        </ThemedText>
      </View>
    </View>
    </PastelScope>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { flex: 1, paddingHorizontal: Spacing.four, gap: Spacing.two },
  deck: { flex: 1, marginBottom: Spacing.four },
  card: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, borderRadius: Radius.card },
  behind: { top: 16, bottom: -14, left: 16, right: 16 },
  cardInner: { borderRadius: Radius.card, padding: Spacing.four, gap: Spacing.two, overflow: 'hidden' },
  circleBig: { position: 'absolute', width: 230, height: 230, top: -70, right: -70 },
  circleSmall: { position: 'absolute', width: 72, height: 72, top: 110, right: 50 },
  circleFill: { width: '100%', height: '100%' },
  name: { fontSize: 40, lineHeight: 44, fontWeight: '800', letterSpacing: -1.2, marginTop: Spacing.two },
  reason: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: OnPastel.chip,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three + 2,
    paddingVertical: 14,
    marginTop: Spacing.two,
  },
  stamp: {
    position: 'absolute',
    top: Spacing.four,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    backgroundColor: OnPastel.chip,
  },
  stampSave: { left: Spacing.four },
  stampSkip: { right: Spacing.four },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, marginTop: Spacing.two },
});
