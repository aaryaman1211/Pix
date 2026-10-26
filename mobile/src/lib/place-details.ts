import { useEffect, useState } from 'react';

import { invoke } from '@/lib/functions';
import type { PlaceDetails } from '@/lib/types';

// Each open costs a Google Places call, so keep what we've fetched for this app session.
const cache = new Map<string, Promise<PlaceDetails>>();

function load(placeId: string): Promise<PlaceDetails> {
  let p = cache.get(placeId);
  if (!p) {
    p = invoke<PlaceDetails>('place-details', { placeId });
    p.catch(() => cache.delete(placeId));
    cache.set(placeId, p);
  }
  return p;
}

export function usePlaceDetails(placeId: string | undefined) {
  const [details, setDetails] = useState<PlaceDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!placeId) return;
    let cancelled = false;
    setError(null);
    load(placeId)
      .then((d) => !cancelled && setDetails(d))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : String(err)));
    return () => {
      cancelled = true;
    };
  }, [placeId]);
  return { details, error };
}
