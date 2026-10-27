import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useState } from 'react';

export type Coords = { lat: number; lng: number };

// Where searches and Discover are centred: the phone's GPS, or an area the user picked in Settings.
// Stored per device, since each member may be somewhere different.
export type LocationPref = { mode: 'device' } | { mode: 'custom'; label: string; lat: number; lng: number };

const PREF_KEY = 'pix.locationPref';
const DEFAULT_PREF: LocationPref = { mode: 'device' };

let currentPref: LocationPref | null = null;
const listeners = new Set<(pref: LocationPref) => void>();
let loading: Promise<LocationPref> | null = null;

function loadPref(): Promise<LocationPref> {
  loading ??= AsyncStorage.getItem(PREF_KEY)
    .then((raw) => (raw ? (JSON.parse(raw) as LocationPref) : DEFAULT_PREF))
    .catch(() => DEFAULT_PREF)
    .then((pref) => {
      currentPref ??= pref;
      return currentPref;
    });
  return loading;
}

export async function setLocationPref(pref: LocationPref) {
  currentPref = pref;
  listeners.forEach((l) => l(pref));
  await AsyncStorage.setItem(PREF_KEY, JSON.stringify(pref));
}

// null until the stored preference has loaded.
export function useLocationPref(): LocationPref | null {
  const [pref, setPref] = useState<LocationPref | null>(currentPref);
  useEffect(() => {
    listeners.add(setPref);
    loadPref().then(setPref);
    return () => {
      listeners.delete(setPref);
    };
  }, []);
  return pref;
}

// The coordinates to search around, following the user's preference.
export function useLocation() {
  const pref = useLocationPref();
  const [device, setDevice] = useState<Coords | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setError('Location is off. Turn it on in Settings, or pick an area in the Settings tab.');
      return;
    }
    try {
      const pos =
        (await Location.getLastKnownPositionAsync({ maxAge: 10 * 60 * 1000 })) ??
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      setDevice({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setError(null);
    } catch (err) {
      console.warn('location failed', err);
      setError("Couldn't find your location. Try again, or pick an area in the Settings tab.");
    }
  }, []);

  const usesDevice = pref?.mode === 'device';
  useEffect(() => {
    if (usesDevice) refresh();
  }, [usesDevice, refresh]);

  // Keep the object identity stable so screens that reload on coords change don't loop.
  const coords = useMemo<Coords | null>(() => {
    if (!pref) return null;
    return pref.mode === 'custom' ? { lat: pref.lat, lng: pref.lng } : device;
  }, [pref, device]);

  return { coords, error: usesDevice ? error : null, refresh, pref };
}

// "Bandra East, Mumbai"-style label for a point, using the phone's own geocoder (no API cost).
export async function describeArea(coords: Coords): Promise<string> {
  try {
    const [a] = await Location.reverseGeocodeAsync({ latitude: coords.lat, longitude: coords.lng });
    if (!a) return 'Selected area';
    const local = a.district ?? a.subregion ?? a.name;
    return [local, a.city ?? a.region].filter((x, i, arr) => x && arr.indexOf(x) === i).join(', ') || 'Selected area';
  } catch {
    return 'Selected area';
  }
}

// Turn "Bandra, Mumbai" into candidate areas.
export async function findAreas(query: string): Promise<{ label: string; lat: number; lng: number }[]> {
  const results = await Location.geocodeAsync(query);
  return Promise.all(
    results.slice(0, 5).map(async (r) => {
      const point = { lat: r.latitude, lng: r.longitude };
      return { ...point, label: await describeArea(point) };
    }),
  );
}
