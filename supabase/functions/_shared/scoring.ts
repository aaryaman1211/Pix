// Stage 1/2 recommender: a hand-weighted linear score over a group's taste vector.
// The feature names here match what is logged to public.interactions, so a trained
// model (stage 3) can later replace WEIGHTS without changing callers.
// Pure TypeScript with no imports: runs in Deno (edge functions) and Node (tests).

export type Candidate = {
  placeId: string;
  name: string;
  address?: string;
  locality?: string; // neighbourhood, e.g. "Bandra West"
  lat: number;
  lng: number;
  primaryType?: string;
  types: string[];
  priceLevel?: number; // 0-4
  rating?: number; // 1-5 Google rating
  ratingCount?: number;
};

export type Signal = {
  types: string[];
  priceLevel?: number | null;
  // positive = liked (saved, visited, rated highly), negative = disliked/dismissed
  weight: number;
};

export type Taste = {
  types: Map<string, number>;
  pricePreference: number | null;
  signalCount: number;
};

export type Scored = Candidate & {
  score: number;
  distanceM: number;
  reason: string;
};

export const WEIGHTS = {
  typeMatch: 3.0,
  priceMatch: 1.0,
  distance: 1.0,
  rating: 1.5,
};

export const SIGNAL_WEIGHTS = {
  save: 1.0,
  visit: 1.5,
  dismiss: -1.0,
  // ratings are centred on 3: 5 stars -> +2, 1 star -> -2
  ratingPerStar: 1.0,
};

// Types that say nothing about taste.
const GENERIC_TYPES = new Set([
  'restaurant',
  'food',
  'point_of_interest',
  'establishment',
  'store',
  'meal_takeaway',
  'meal_delivery',
]);

export function tasteTypes(types: string[]): string[] {
  return types.filter((t) => !GENERIC_TYPES.has(t));
}

export function buildTaste(signals: Signal[]): Taste {
  const types = new Map<string, number>();
  let priceSum = 0;
  let priceWeight = 0;

  for (const s of signals) {
    for (const t of tasteTypes(s.types)) {
      types.set(t, (types.get(t) ?? 0) + s.weight);
    }
    if (s.priceLevel != null && s.weight > 0) {
      priceSum += s.priceLevel * s.weight;
      priceWeight += s.weight;
    }
  }

  return {
    types,
    pricePreference: priceWeight > 0 ? priceSum / priceWeight : null,
    signalCount: signals.length,
  };
}

// Cosine similarity between the candidate's (binary) type vector and the taste vector.
export function typeSimilarity(taste: Taste, types: string[]): number {
  const own = tasteTypes(types);
  if (own.length === 0 || taste.types.size === 0) return 0;

  let dot = 0;
  for (const t of own) dot += taste.types.get(t) ?? 0;

  let tasteNorm = 0;
  for (const v of taste.types.values()) tasteNorm += v * v;

  return dot / (Math.sqrt(tasteNorm) * Math.sqrt(own.length));
}

export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Google rating adjusted for how many reviews back it up.
export function ratingScore(rating?: number, count?: number): number {
  if (rating == null) return 0;
  const confidence = Math.min(1, Math.log10((count ?? 0) + 1) / 3);
  return Math.max(-1, Math.min(1, (rating - 3.8) / 1.2)) * confidence;
}

export function prettyType(type: string): string {
  return type.replace(/_restaurant$/, '').replace(/_/g, ' ');
}

export function scoreCandidates(
  taste: Taste,
  candidates: Candidate[],
  origin: { lat: number; lng: number },
  radiusM: number,
): Scored[] {
  const scored = candidates.map((c) => {
    const distanceM = distanceMeters(origin.lat, origin.lng, c.lat, c.lng);
    const typeMatch = typeSimilarity(taste, c.types);
    const priceMatch =
      taste.pricePreference == null || c.priceLevel == null
        ? 0
        : 1 - Math.abs(c.priceLevel - taste.pricePreference) / 2;
    const distance = Math.max(0, 1 - distanceM / radiusM);
    const rating = ratingScore(c.rating, c.ratingCount);

    const score =
      WEIGHTS.typeMatch * typeMatch +
      WEIGHTS.priceMatch * priceMatch +
      WEIGHTS.distance * distance +
      WEIGHTS.rating * rating;

    return { ...c, score, distanceM, reason: explain(taste, c, typeMatch, rating) };
  });

  return scored.sort((a, b) => b.score - a.score);
}

function explain(taste: Taste, c: Candidate, typeMatch: number, rating: number): string {
  if (typeMatch > 0) {
    const best = tasteTypes(c.types)
      .map((t) => [t, taste.types.get(t) ?? 0] as const)
      .sort((a, b) => b[1] - a[1])[0];
    if (best && best[1] > 0) return `You like ${prettyType(best[0])} places`;
  }
  if (rating > 0.5) return `Highly rated (${c.rating?.toFixed(1)}★)`;
  if (taste.signalCount === 0) return 'Popular nearby';
  return 'Something different nearby';
}

// The group's most-liked specific types, used to widen the Google candidate search.
export function topTypes(taste: Taste, n: number): string[] {
  return [...taste.types.entries()]
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([t]) => t);
}
