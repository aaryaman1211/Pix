// Google Places API (New) calls. The API key lives only on the server.
import { distanceMeters, type Candidate } from './scoring.ts';

// Searches never return places further than this from the search centre.
export const MAX_SEARCH_M = 50_000;

// Lists only need enough to draw a card: the neighbourhood comes from addressComponents, and the
// full address, hours and reviews are fetched per place with placeDetails() when it's opened.
const LIST_FIELDS = [
  'places.id',
  'places.displayName',
  'places.addressComponents',
  'places.location',
  'places.types',
  'places.primaryType',
  'places.priceLevel',
  'places.rating',
  'places.userRatingCount',
].join(',');

const DETAIL_FIELDS = [
  'id',
  'formattedAddress',
  'addressComponents',
  'nationalPhoneNumber',
  'websiteUri',
  'googleMapsUri',
  'currentOpeningHours',
  'editorialSummary',
  'reviews',
].join(',');

const PRICE_LEVELS: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

type AddressComponent = { longText: string; shortText?: string; types: string[] };

type GooglePlace = {
  id: string;
  displayName?: { text: string };
  addressComponents?: AddressComponent[];
  location?: { latitude: number; longitude: number };
  types?: string[];
  primaryType?: string;
  priceLevel?: string;
  rating?: number;
  userRatingCount?: number;
};

type GoogleDetails = {
  id: string;
  formattedAddress?: string;
  addressComponents?: AddressComponent[];
  nationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  currentOpeningHours?: { openNow?: boolean; weekdayDescriptions?: string[] };
  editorialSummary?: { text: string };
  reviews?: {
    rating?: number;
    text?: { text: string };
    originalText?: { text: string };
    relativePublishTimeDescription?: string;
    authorAttribution?: { displayName?: string; uri?: string; photoUri?: string };
  }[];
};

function apiKey(): string {
  const key = Deno.env.get('GOOGLE_PLACES_API_KEY');
  if (!key) throw new Error('GOOGLE_PLACES_API_KEY is not set');
  return key;
}

async function call<T>(url: string, fieldMask: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey(),
      'X-Goog-FieldMask': fieldMask,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Google Places request failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

async function list(path: string, body: unknown): Promise<Candidate[]> {
  const json = await call<{ places?: GooglePlace[] }>(`https://places.googleapis.com/v1/places:${path}`, LIST_FIELDS, body);
  return (json.places ?? []).filter((p) => p.location).map(toCandidate);
}

// The neighbourhood a place is in ("Bandra West", "Colaba"), falling back to the city.
export function locality(components?: AddressComponent[]): string | undefined {
  if (!components) return undefined;
  for (const type of ['sublocality_level_1', 'neighborhood', 'sublocality', 'locality']) {
    const c = components.find((x) => x.types.includes(type));
    if (c) return c.longText;
  }
  return undefined;
}

function toCandidate(p: GooglePlace): Candidate {
  return {
    placeId: p.id,
    name: p.displayName?.text ?? 'Unknown place',
    locality: locality(p.addressComponents),
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
  return { circle: { center: { latitude: lat, longitude: lng }, radius: Math.min(radiusM, MAX_SEARCH_M) } };
}

// Text search only accepts a rectangle as a hard limit, so use the box around the circle and then
// drop the corners.
function box(lat: number, lng: number, radiusM: number) {
  const dLat = radiusM / 111_320;
  const dLng = radiusM / (111_320 * Math.cos((lat * Math.PI) / 180));
  return {
    rectangle: {
      low: { latitude: lat - dLat, longitude: lng - dLng },
      high: { latitude: lat + dLat, longitude: lng + dLng },
    },
  };
}

export async function searchText(query: string, lat: number, lng: number) {
  const results = await list('searchText', {
    textQuery: query,
    pageSize: 20,
    locationRestriction: box(lat, lng, MAX_SEARCH_M),
  });
  return results.filter((r) => distanceMeters(lat, lng, r.lat, r.lng) <= MAX_SEARCH_M);
}

export function searchNearby(types: string[], lat: number, lng: number, radiusM: number) {
  return list('searchNearby', {
    includedTypes: types,
    maxResultCount: 20,
    rankPreference: 'POPULARITY',
    locationRestriction: circle(lat, lng, radiusM),
  });
}

export type PlaceDetails = {
  placeId: string;
  address?: string;
  locality?: string;
  phone?: string;
  website?: string;
  mapsUrl?: string;
  openNow?: boolean;
  hours?: string[];
  summary?: string;
  reviews: { author: string; authorUrl?: string; rating?: number; when?: string; text: string }[];
};

export async function placeDetails(placeId: string): Promise<PlaceDetails> {
  const d = await call<GoogleDetails>(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=en`,
    DETAIL_FIELDS,
  );
  return {
    placeId: d.id,
    address: d.formattedAddress,
    locality: locality(d.addressComponents),
    phone: d.nationalPhoneNumber,
    website: d.websiteUri,
    mapsUrl: d.googleMapsUri,
    openNow: d.currentOpeningHours?.openNow,
    hours: d.currentOpeningHours?.weekdayDescriptions,
    summary: d.editorialSummary?.text,
    reviews: (d.reviews ?? [])
      .map((r) => ({
        author: r.authorAttribution?.displayName ?? 'Google user',
        authorUrl: r.authorAttribution?.uri,
        rating: r.rating,
        when: r.relativePublishTimeDescription,
        text: r.text?.text ?? r.originalText?.text ?? '',
      }))
      .filter((r) => r.text),
  };
}
