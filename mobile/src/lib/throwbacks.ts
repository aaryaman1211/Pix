import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

import { parseDay } from '@/lib/format';
import { ensurePermission } from '@/lib/reminders';
import { supabase } from '@/lib/supabase';

// Local "go look at your photos" nudges, scheduled on this phone:
//   weekly  – a random memory every Sunday morning
//   monthly – a recap of the month on the 1st
//   yearly  – "on this day" for each memory's anniversary
// Notifications can't change once scheduled, so the text is written now and everything is rebuilt
// each time the app opens or a memory is added.

const KIND = 'throwback';
const PREF_KEY = 'pix.throwbacks';
const WEEKS_AHEAD = 4;
const MAX_ANNIVERSARIES = 15; // with 4 weekly + 1 monthly, stays inside the shared 64 limit

type Row = {
  id: string;
  title: string;
  happened_on: string;
  created_at: string;
  groups: { name: string } | null;
  memory_photos: { count: number }[];
};

const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];

function timeAgo(day: string): string {
  const days = Math.round((Date.now() - parseDay(day).getTime()) / 86_400_000);
  if (days < 14) return 'just last week';
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  if (days < 365) return `${Math.round(days / 30)} months ago`;
  const years = Math.round(days / 365);
  return years === 1 ? 'a year ago' : `${years} years ago`;
}

const photos = (n: number) => (n === 1 ? '1 photo' : `${n} photos`);

const WEEKLY = [
  (m: Row, n: number) => ({ title: 'Throwback Sunday 📸', body: `Remember ${m.title}? ${photos(n)} from ${timeAgo(m.happened_on)} want some attention.` }),
  (m: Row, n: number) => ({ title: 'Your camera roll called ☎️', body: `It misses ${m.title}. ${photos(n)}, one tap away.` }),
  (m: Row) => ({ title: 'Nostalgia o’clock ⏰', body: `${m.title} with ${m.groups?.name ?? 'your crew'}, ${timeAgo(m.happened_on)}. Go relive it.` }),
  (m: Row) => ({ title: 'Quick, look busy 👀', body: `${m.title} just resurfaced. Worth a scroll before Monday hits.` }),
  (m: Row, n: number) => ({ title: 'Sunday reruns 🍿', body: `Today’s episode: ${m.title}. Starring you, ${photos(n)}.` }),
];

export async function throwbacksEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(PREF_KEY)) !== 'off';
  } catch {
    return true;
  }
}

export async function setThrowbacksEnabled(on: boolean) {
  await AsyncStorage.setItem(PREF_KEY, on ? 'on' : 'off');
  await syncThrowbacks();
}

async function cancelThrowbacks() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.content.data?.kind === KIND)
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

function nextSundays(count: number): Date[] {
  const out: Date[] = [];
  const d = new Date();
  d.setHours(11, 0, 0, 0);
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7)); // this Sunday (today if it's Sunday)
  if (d <= new Date()) d.setDate(d.getDate() + 7);
  while (out.length < count) {
    out.push(new Date(d));
    d.setDate(d.getDate() + 7);
  }
  return out;
}

export async function syncThrowbacks(): Promise<void> {
  if (!(await throwbacksEnabled())) return cancelThrowbacks();
  if (!(await ensurePermission())) return;

  // RLS limits this to the user's own groups.
  const { data, error } = await supabase
    .from('memories')
    .select('id, title, happened_on, created_at, groups(name), memory_photos(count)')
    .returns<Row[]>();
  if (error) throw error;
  await cancelThrowbacks();

  const withPhotos = data.filter((m) => (m.memory_photos[0]?.count ?? 0) > 0);
  const count = (m: Row) => m.memory_photos[0]?.count ?? 0;

  // Weekly: a different memory each Sunday where possible.
  if (withPhotos.length > 0) {
    const shuffled = [...withPhotos].sort(() => Math.random() - 0.5);
    for (const [i, date] of nextSundays(WEEKS_AHEAD).entries()) {
      const m = shuffled[i % shuffled.length];
      const { title, body } = pick(WEEKLY)(m, count(m));
      await Notifications.scheduleNotificationAsync({
        content: { title, body, data: { kind: KIND, memoryId: m.id } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
      });
    }
  }

  // Monthly: on the 1st, recap the month that's ending.
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + 1, 1, 10, 0, 0);
  const monthName = now.toLocaleDateString(undefined, { month: 'long' });
  const thisMonth = data.filter((m) => {
    const d = parseDay(m.happened_on);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  const monthPhotos = thisMonth.reduce((sum, m) => sum + count(m), 0);
  const monthly =
    thisMonth.length > 0
      ? {
          title: `${monthName}, wrapped 🎁`,
          body: `${thisMonth.length} ${thisMonth.length === 1 ? 'memory' : 'memories'} and ${photos(monthPhotos)}. Not bad at all. Tap to look back.`,
        }
      : {
          title: `${monthName} was suspiciously quiet 🦗`,
          body: 'Zero memories saved. Your Want to go list is right there, just saying.',
        };
  await Notifications.scheduleNotificationAsync({
    content: { ...monthly, data: { kind: KIND, tab: 'memories' } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: first },
  });

  // Yearly: "on this day", soonest anniversaries first.
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const anniversaries = withPhotos
    .map((m) => {
      const d = parseDay(m.happened_on);
      const next = new Date(today.getFullYear(), d.getMonth(), d.getDate());
      if (next <= today) next.setFullYear(next.getFullYear() + 1);
      return { m, d, next };
    })
    .filter(({ d, next }) => next.getFullYear() > d.getFullYear()) // only once it's at least a year old
    .sort((a, b) => a.next.getTime() - b.next.getTime())
    .slice(0, MAX_ANNIVERSARIES);

  for (const { m, d } of anniversaries) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'On this day ✨',
        body: `${d.getFullYear()}: ${m.title} with ${m.groups?.name ?? 'your crew'}. ${photos(count(m))} to get misty-eyed over.`,
        data: { kind: KIND, memoryId: m.id },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.YEARLY,
        month: d.getMonth(),
        day: d.getDate(),
        hour: 10,
        minute: 0,
      },
    });
  }
}
