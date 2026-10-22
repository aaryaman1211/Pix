// Recommend places for a group near a location. Body: { groupId, lat, lng }
import { searchNearby } from '../_shared/google.ts';
import { json, serve, userClient } from '../_shared/http.ts';
import {
  buildTaste,
  scoreCandidates,
  SIGNAL_WEIGHTS,
  topTypes,
  type Candidate,
  type Signal,
} from '../_shared/scoring.ts';

const RESULT_COUNT = 15;

serve(async (req) => {
  const supabase = userClient(req);
  const { groupId, lat, lng } = await req.json();
  if (typeof groupId !== 'string' || typeof lat !== 'number' || typeof lng !== 'number') {
    return json({ error: 'groupId, lat and lng are required' }, 400);
  }

  // RLS returns nothing unless the caller is a member of the group.
  const { data: group } = await supabase
    .from('groups')
    .select('id, search_radius_m')
    .eq('id', groupId)
    .maybeSingle();
  if (!group) return json({ error: 'Group not found' }, 404);

  const [saved, ratings, dismissed] = await Promise.all([
    supabase.from('saved_places').select('place_id, types, price_level, status').eq('group_id', groupId),
    supabase.from('ratings').select('place_id, score').eq('group_id', groupId),
    supabase
      .from('interactions')
      .select('place_id, place_types, price_level')
      .eq('group_id', groupId)
      .eq('action', 'dismiss'),
  ]);
  for (const r of [saved, ratings, dismissed]) if (r.error) throw r.error;

  const savedById = new Map(saved.data!.map((p) => [p.place_id, p]));
  const signals: Signal[] = [
    ...saved.data!.map((p) => ({
      types: p.types,
      priceLevel: p.price_level,
      weight: p.status === 'visited' ? SIGNAL_WEIGHTS.visit : SIGNAL_WEIGHTS.save,
    })),
    ...ratings.data!.flatMap((r) => {
      const p = savedById.get(r.place_id);
      return p ? [{ types: p.types, priceLevel: p.price_level, weight: (r.score - 3) * SIGNAL_WEIGHTS.ratingPerStar }] : [];
    }),
    ...dismissed.data!.map((d) => ({ types: d.place_types, priceLevel: d.price_level, weight: SIGNAL_WEIGHTS.dismiss })),
  ];
  const taste = buildTaste(signals);
  const radiusM = group.search_radius_m;

  // Candidates: popular restaurants nearby, plus nearby places of the group's favourite types.
  const searches = [['restaurant'], ...topTypes(taste, 2).map((t) => [t])];
  const settled = await Promise.allSettled(searches.map((types) => searchNearby(types, lat, lng, radiusM)));
  const candidates = new Map<string, Candidate>();
  for (const s of settled) {
    if (s.status === 'rejected') {
      console.warn(s.reason);
      continue;
    }
    for (const c of s.value) candidates.set(c.placeId, c);
  }
  if (candidates.size === 0 && settled.every((s) => s.status === 'rejected')) {
    throw (settled[0] as PromiseRejectedResult).reason;
  }

  const excluded = new Set([...savedById.keys(), ...dismissed.data!.map((d) => d.place_id)]);
  const results = scoreCandidates(
    taste,
    [...candidates.values()].filter((c) => !excluded.has(c.placeId)),
    { lat, lng },
    radiusM,
  ).slice(0, RESULT_COUNT);

  // Log what was shown: these become the negatives/positives the trained model learns from.
  if (results.length > 0) {
    const { error } = await supabase.from('interactions').insert(
      results.map((r) => ({
        group_id: groupId,
        place_id: r.placeId,
        action: 'shown',
        source: 'recommend',
        value: r.score,
        place_types: r.types,
        price_level: r.priceLevel ?? null,
        google_rating: r.rating ?? null,
        distance_m: r.distanceM,
      })),
    );
    if (error) console.warn('failed to log shown interactions', error);
  }

  return json({ results, topTypes: topTypes(taste, 3) });
});
