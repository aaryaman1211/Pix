import { supabase } from '@/lib/supabase';
import type { InteractionAction, InteractionSource } from '@/lib/types';

type PlaceFeatures = {
  placeId: string;
  types?: string[];
  priceLevel?: number | null;
  rating?: number | null;
  distanceM?: number | null;
};

// Every save/visit/rating/dismissal is logged: this is the training data for the
// recommendation model. Failures are logged but never block the user.
export function logInteraction(
  groupId: string,
  place: PlaceFeatures,
  action: InteractionAction,
  source: InteractionSource,
  value?: number,
) {
  supabase
    .from('interactions')
    .insert({
      group_id: groupId,
      place_id: place.placeId,
      action,
      source,
      value: value ?? null,
      place_types: place.types ?? [],
      price_level: place.priceLevel ?? null,
      google_rating: place.rating ?? null,
      distance_m: place.distanceM ?? null,
    })
    .then(({ error }) => {
      if (error) console.warn('logInteraction failed', error.message);
    });
}
