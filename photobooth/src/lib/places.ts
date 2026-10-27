import { supabase } from '@/lib/supabase';
import type { PlaceResult } from '@/lib/types';

// Adds a Google place to the group's wishlist. Returns an error message, or null on success.
export async function addPlace(groupId: string, place: PlaceResult): Promise<string | null> {
  const { error } = await supabase.from('saved_places').insert({
    group_id: groupId,
    place_id: place.placeId,
    name: place.name,
    address: place.address ?? null,
    locality: place.locality ?? null,
    primary_type: place.primaryType ?? null,
    types: place.types,
    price_level: place.priceLevel ?? null,
    lat: place.lat,
    lng: place.lng,
  });
  // 23505 = already on the list (unique group_id, place_id): treat as success.
  if (error && error.code !== '23505') return error.message;
  return null;
}

export function mapsUrl(name: string, placeId: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}&query_place_id=${placeId}`;
}
