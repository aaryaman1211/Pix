// Google Places API (New) calls. The API key lives only on the server.
import type { Candidate } from './scoring.ts';

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.types',
  'places.primaryType',
  'places.priceLevel',
  'places.rating',
  'places.userRatingCount',
].join(',');

const PRICE_LEVELS: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

type GooglePlace = {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  types?: string[];
  primaryType?: string;
  priceLevel?: string;
  rating?: number;
  userRatingCount?: number;
};

function apiKey(): string {
  const key = Deno.env.get('GOOGLE_PLACES_API_KEY');
  if (!key) throw new Error('GOOGLE_PLACES_API_KEY is not set');
  return key;
}

async function post(path: string, body: unknown): Promise<Candidate[]> {
  const res = await fetch(`https://places.googleapis.com/v1/places:${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey(),
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Google Places ${path} failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { places?: GooglePlace[] };
  return (json.places ?? []).filter((p) => p.location).map(toCandidate);
}

function toCandidate(p: GooglePlace): Candidate {
  return {
    placeId: p.id,
    name: p.displayName?.text ?? 'Unknown place',
    address: p.formattedAddress,
    lat: p.location!.latitude,
    lng: p.location!.longitude,
    primaryType: p.primaryType,
    types: p.types ?? [],
    priceLevel: p.priceLevel ? PRICE_LEVELS[p.priceLevel] : undefined,
    rating: p.rating,
    ratingCount: p.userRatingCount,
  };
}

function circle(lat: number, lng: number, radiusM: number) {
  return { circle: { center: { latitude: lat, longitude: lng }, radius: Math.min(radiusM, 50000) } };
}

export function searchText(query: string, lat: number, lng: number, radiusM: number) {
  return post('searchText', {
    textQuery: query,
    pageSize: 20,
    locationBias: circle(lat, lng, radiusM),
  });
}

export function searchNearby(types: string[], lat: number, lng: number, radiusM: number) {
  return post('searchNearby', {
    includedTypes: types,
    maxResultCount: 20,
    rankPreference: 'POPULARITY',
    locationRestriction: circle(lat, lng, radiusM),
  });
}
