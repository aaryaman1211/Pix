// Row shapes for the tables in supabase/migrations. Regenerate with
// `supabase gen types typescript --linked` if the schema grows much further.

export type Group = {
  id: string;
  name: string;
  invite_code: string;
  search_radius_m: number;
  created_by: string;
  created_at: string;
};

export type Member = {
  user_id: string;
  role: 'owner' | 'member';
  profiles: { display_name: string } | null;
};

export type SavedPlace = {
  id: string;
  group_id: string;
  place_id: string;
  name: string;
  address: string | null;
  locality: string | null;
  primary_type: string | null;
  types: string[];
  price_level: number | null;
  lat: number | null;
  lng: number | null;
  status: 'want' | 'visited';
  notes: string | null;
  added_by: string;
  created_at: string;
};

export type Memory = {
  id: string;
  group_id: string;
  title: string;
  happened_on: string; // YYYY-MM-DD
  notes: string | null;
  place_id: string | null;
  place_name: string | null;
  cover_photo_id: string | null; // null: use the first photo
  created_by: string;
  created_at: string;
};

export type MemoryPhoto = {
  id: string;
  memory_id: string;
  group_id: string;
  storage_path: string;
  width: number | null;
  height: number | null;
  uploaded_by: string;
};

export type Rating = {
  user_id: string;
  place_id: string;
  score: number;
  profiles: { display_name: string } | null;
};

export type ImportantDate = {
  id: string;
  group_id: string;
  title: string;
  date: string; // YYYY-MM-DD
  repeats_yearly: boolean;
  created_by: string;
};

// A place as returned by the places-search and recommend edge functions.
export type PlaceResult = {
  placeId: string;
  name: string;
  address?: string;
  locality?: string;
  lat: number;
  lng: number;
  primaryType?: string;
  types: string[];
  priceLevel?: number;
  rating?: number;
  ratingCount?: number;
};

export type Recommendation = PlaceResult & {
  score: number;
  distanceM: number;
  reason: string;
};

export type InteractionAction = 'shown' | 'view' | 'save' | 'unsave' | 'dismiss' | 'visit' | 'rate';
export type InteractionSource = 'search' | 'recommend' | 'list';

// From the place-details edge function, fetched when a place is opened.
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
