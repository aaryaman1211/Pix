import { router } from 'expo-router';
import { useEffect } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Chip, Empty, ErrorText, Fab, TabHeader, useTabBarSpace } from '@/components/ui';
import { Palette, pastelAt, Radius, Spacing, TabAccent } from '@/constants/theme';
import { daysUntil, nextOccurrence, parseDay } from '@/lib/format';
import { useActiveGroup } from '@/lib/groups';
import { syncReminders } from '@/lib/reminders';
import { supabase } from '@/lib/supabase';
import type { ImportantDate } from '@/lib/types';
import { must, useQuery } from '@/lib/use-query';

const shortDate = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

export default function DatesScreen() {
  const group = useActiveGroup();
  const bottomSpace = useTabBarSpace();

  const query = useQuery(
    async () =>
      must<ImportantDate[]>(await supabase.from('important_dates').select('*').eq('group_id', group.id)),
    [group.id],
  );

  // Someone else in the group may have added dates since last time.
  useEffect(() => {
    if (query.data) syncReminders().catch(console.warn);
  }, [query.data]);

  const all = (query.data ?? []).map((d) => {
    const next = nextOccurrence(d.date, d.repeats_yearly);
    return { ...d, next, days: next ? daysUntil(next) : null };
  });
  const upcoming = all.filter((d) => d.next).sort((a, b) => a.next!.getTime() - b.next!.getTime());
  const past = all.filter((d) => !d.next);
  const [first, ...rest] = upcoming;

  function remove(d: ImportantDate) {
    Alert.alert(`Delete "${d.title}"?`, 'Reminders for it will stop for everyone in the group.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('important_dates').delete().eq('id', d.id);
          if (error) Alert.alert('Could not delete', error.message);
          else query.reload();
        },
      },
    ]);
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomSpace + 72 }}
        refreshControl={<RefreshControl refreshing={query.loading && !!query.data} onRefresh={query.reload} />}>
        <TabHeader title="Dates" subtitle="Never miss the good days" />
        <View style={styles.body}>
          <ErrorText>{query.error}</ErrorText>

          {all.length === 0 && !query.loading && (
            <Empty
              color={Palette.mint}
              title="No dates yet"
              body="Anniversaries, birthdays, the day you met. Everyone in the group gets a reminder."
              action={<Button title="Add a date" small onPress={() => router.push('/date/new')} />}
            />
          )}

          {first && (
            <Pressable onLongPress={() => remove(first)} style={styles.hero}>
              <Chip label={first.days === 0 ? 'Today' : 'Up next'} />
              {first.days === 0 ? (
                <ThemedText style={styles.heroToday}>It's today!</ThemedText>
              ) : (
                <>
                  <ThemedText style={styles.heroNumber}>{first.days}</ThemedText>
                  <ThemedText style={{ fontWeight: '600' }}>{first.days === 1 ? 'day until' : 'days until'}</ThemedText>
                </>
              )}
              <ThemedText style={styles.heroTitle} numberOfLines={2}>
                {first.title} · {shortDate(first.next!)}
              </ThemedText>
            </Pressable>
          )}

          {rest.map((d, i) => (
            <DateRow
              key={d.id}
              color={pastelAt(i + 2)}
              big={String(d.days)}
              small={d.days === 1 ? 'day' : 'days'}
              title={d.title}
              meta={`${shortDate(parseDay(d.date))}${d.repeats_yearly ? ' · yearly' : ''}`}
              onLongPress={() => remove(d)}
            />
          ))}

          {past.length > 0 && (
            <ThemedText type="label" themeColor="textSecondary" style={{ marginTop: Spacing.three }}>
              Past
            </ThemedText>
          )}
          {past.map((d) => (
            <DateRow
              key={d.id}
              color={Palette.track}
              big="✓"
              small="done"
              title={d.title}
              meta={parseDay(d.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
              onLongPress={() => remove(d)}
            />
          ))}

          {all.length > 0 && (
            <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center', marginTop: Spacing.two }}>
              Press and hold a date to delete it
            </ThemedText>
          )}
        </View>
      </ScrollView>
      <Fab color={TabAccent.dates} label="Add a date" onPress={() => router.push('/date/new')} />
    </View>
  );
}

function DateRow({
  color,
  big,
  small,
  title,
  meta,
  onLongPress,
}: {
  color: string;
  big: string;
  small: string;
  title: string;
  meta: string;
  onLongPress: () => void;
}) {
  return (
    <Pressable onLongPress={onLongPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}>
      <View style={[styles.count, { backgroundColor: color }]}>
        <ThemedText style={styles.countNumber} adjustsFontSizeToFit numberOfLines={1}>
          {big}
        </ThemedText>
        <ThemedText style={{ fontSize: 12, lineHeight: 14, fontWeight: '700' }}>{small}</ThemedText>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <ThemedText style={{ fontSize: 18, fontWeight: '700' }} numberOfLines={1}>
          {title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {meta}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.canvas },
  body: { paddingHorizontal: Spacing.four, gap: Spacing.three - 4 },
  hero: {
    backgroundColor: Palette.mint,
    borderRadius: Radius.card,
    padding: Spacing.four,
    gap: 2,
    alignItems: 'flex-start',
  },
  heroNumber: { fontSize: 104, lineHeight: 112, fontWeight: '800', letterSpacing: -5, marginTop: Spacing.two },
  heroToday: { fontSize: 56, lineHeight: 64, fontWeight: '800', letterSpacing: -2, marginVertical: Spacing.two },
  heroTitle: { fontSize: 24, lineHeight: 30, fontWeight: '700', letterSpacing: -0.5 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: Palette.white,
    borderRadius: Radius.tile,
    borderWidth: 1,
    borderColor: Palette.line,
    padding: Spacing.three - 4,
  },
  count: { width: 68, height: 68, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  countNumber: { fontSize: 26, lineHeight: 30, fontWeight: '800', letterSpacing: -0.8 },
});
