import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { nextOccurrence, parseDay } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { ImportantDate } from '@/lib/types';

const KIND = 'important-date';
const REMIND_HOUR = 9;
// iOS keeps at most 64 pending local notifications per app.
const MAX_DATES = 30;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function ensurePermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

function trigger(date: Date, repeatsYearly: boolean): Notifications.SchedulableNotificationTriggerInput {
  if (repeatsYearly) {
    return {
      type: Notifications.SchedulableTriggerInputTypes.YEARLY,
      month: date.getMonth(),
      day: date.getDate(),
      hour: REMIND_HOUR,
      minute: 0,
    };
  }
  const at = new Date(date);
  at.setHours(REMIND_HOUR, 0, 0, 0);
  return { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at };
}

// Reminders are local to each device, so every member gets them. Rebuilt from
// scratch across all of the user's groups whenever dates change.
export async function syncReminders(): Promise<void> {
  if (!(await ensurePermission())) return;

  const { data, error } = await supabase
    .from('important_dates')
    .select('*, groups(name)')
    .returns<(ImportantDate & { groups: { name: string } | null })[]>();
  if (error) throw error;

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.content.data?.kind === KIND)
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );

  const upcoming = data
    .map((d) => ({ d, next: nextOccurrence(d.date, d.repeats_yearly) }))
    .filter((x): x is { d: typeof x.d; next: Date } => x.next !== null)
    .sort((a, b) => a.next.getTime() - b.next.getTime())
    .slice(0, MAX_DATES);

  for (const { d } of upcoming) {
    const date = parseDay(d.date);
    const dayBefore = new Date(date);
    dayBefore.setDate(date.getDate() - 1);
    const group = d.groups?.name ?? '';

    await Notifications.scheduleNotificationAsync({
      content: { title: d.title, body: `Today · ${group}`, data: { kind: KIND, id: d.id } },
      trigger: trigger(date, d.repeats_yearly),
    });
    if (dayBefore >= new Date() || d.repeats_yearly) {
      await Notifications.scheduleNotificationAsync({
        content: { title: `Tomorrow: ${d.title}`, body: group, data: { kind: KIND, id: d.id } },
        trigger: trigger(dayBefore, d.repeats_yearly),
      });
    }
  }
}
