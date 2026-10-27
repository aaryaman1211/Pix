import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { ensurePermission } from '@/lib/reminders';
import { supabase } from '@/lib/supabase';

// Group activity pushes ("Promenade really wants to go to …") are sent by the `notify` edge
// function to every Expo push token a member has registered here.

const PREF_KEY = 'pix.groupPush';
let currentToken: string | null = null;

export async function groupPushEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(PREF_KEY)) !== 'off';
  } catch {
    return true;
  }
}

export async function setGroupPushEnabled(on: boolean) {
  await AsyncStorage.setItem(PREF_KEY, on ? 'on' : 'off');
  if (on) await registerForPush();
  else await unregisterPush();
}

export async function registerForPush(): Promise<void> {
  if (Platform.OS === 'web' || !(await groupPushEnabled())) return;
  if (!(await ensurePermission())) return;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!projectId) return;
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  currentToken = token;
  const { error } = await supabase
    .from('push_tokens')
    .upsert({ token, platform: Platform.OS, updated_at: new Date().toISOString() }, { onConflict: 'token' });
  if (error) console.warn('push token save failed', error.message);
}

// Stop this phone getting group pushes (sign out, or the Settings switch).
export async function unregisterPush(): Promise<void> {
  if (!currentToken) return;
  await supabase.from('push_tokens').delete().eq('token', currentToken);
  currentToken = null;
}

// Signing out must drop the token first, while we can still act as this user.
export async function signOut() {
  await unregisterPush().catch(() => {});
  await supabase.auth.signOut();
}
