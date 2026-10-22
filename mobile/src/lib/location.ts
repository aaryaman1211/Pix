import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';

export type Coords = { lat: number; lng: number };

export function useLocation() {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setError('Location is off. Turn it on in Settings so Pix can find places near you.');
      return;
    }
    try {
      const pos =
        (await Location.getLastKnownPositionAsync({ maxAge: 10 * 60 * 1000 })) ??
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not get your location');
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { coords, error, refresh };
}
