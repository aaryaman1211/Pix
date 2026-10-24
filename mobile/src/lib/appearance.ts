import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Appearance } from 'react-native';

export type AppearancePref = 'system' | 'light' | 'dark';

const KEY = 'pix.appearance';
let current: AppearancePref = 'system';
const listeners = new Set<(p: AppearancePref) => void>();

function apply(pref: AppearancePref) {
  // Overrides the native appearance too, so alerts, keyboards and pickers match.
  Appearance.setColorScheme(pref === 'system' ? 'unspecified' : pref);
}

// Called once at startup, before the first screen renders.
export async function loadAppearance(): Promise<void> {
  try {
    const stored = (await AsyncStorage.getItem(KEY)) as AppearancePref | null;
    if (stored === 'light' || stored === 'dark') current = stored;
  } catch {}
  apply(current);
}

export async function setAppearance(pref: AppearancePref) {
  current = pref;
  apply(pref);
  listeners.forEach((l) => l(pref));
  await AsyncStorage.setItem(KEY, pref);
}

export function useAppearancePref(): AppearancePref {
  const [pref, setPref] = useState(current);
  useEffect(() => {
    listeners.add(setPref);
    return () => {
      listeners.delete(setPref);
    };
  }, []);
  return pref;
}
