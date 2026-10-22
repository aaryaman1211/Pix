import { router } from 'expo-router';
import { useEffect } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AddButton, Button, Card, Empty, ErrorText, TabHeader } from '@/components/ui';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { countdownLabel, dayLabel, daysUntil, nextOccurrence } from '@/lib/format';
import { useActiveGroup } from '@/lib/groups';
import { syncReminders } from '@/lib/reminders';
import { supabase } from '@/lib/supabase';
import type { ImportantDate } from '@/lib/types';
import { must, useQuery } from '@/lib/use-query';

export default function DatesScreen() {
  const group = useActiveGroup();

  const query = useQuery(
    async () =>
      must<ImportantDate[]>(await supabase.from('important_dates').select('*').eq('group_id', group.id)),
    [group.id],
  );

  // Someone else in the group may have added dates since last time.
  useEffect(() => {
    if (query.data) syncReminders().catch(console.warn);
  }, [query.data]);

  const upcoming = (query.data ?? [])
    .map((d) => ({ ...d, next: nextOccurrence(d.date, d.repeats_yearly) }))
    .sort((a, b) => {
      if (!a.next) return 1;
      if (!b.next) return -1;
      return a.next.getTime() - b.next.getTime();
    });

  function remove(d: ImportantDate) {
    Alert.alert(`Delete "${d.title}"?`, undefined, [
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
    <View style={{ flex: 1 }}>
      <TabHeader title="Dates" action={<AddButton label="Add a date" onPress={() => router.push('/date/new')} />} />
      <FlatList
        data={upcoming}
        keyExtractor={(d) => d.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={query.loading && !!query.data} onRefresh={query.reload} />}
        ListHeaderComponent={<ErrorText>{query.error}</ErrorText>}
        ListEmptyComponent={
          query.loading ? undefined : (
            <Empty
              title="No dates yet"
              body="Anniversaries, birthdays, the day you met. Everyone in the group gets a reminder."
              action={<Button title="Add a date" small onPress={() => router.push('/date/new')} />}
            />
          )
        }
        renderItem={({ item }) => {
          const days = item.next ? daysUntil(item.next) : null;
          return (
            <Card style={styles.row}>
              <View style={{ flex: 1, gap: 2 }}>
                <ThemedText style={{ fontWeight: '600' }}>{item.title}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {dayLabel(item.date)}
                  {item.repeats_yearly ? ' · every year' : ''}
                </ThemedText>
              </View>
              <View style={{ alignItems: 'flex-end', gap: Spacing.one }}>
                <ThemedText type="smallBold" themeColor={days !== null && days <= 7 ? 'accent' : 'textSecondary'}>
                  {days === null ? 'Past' : countdownLabel(days)}
                </ThemedText>
                <Button title="Delete" variant="danger" small onPress={() => remove(item)} style={styles.delete} />
              </View>
            </Card>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: Spacing.three, gap: Spacing.two, paddingBottom: BottomTabInset + Spacing.four },
  row: { flexDirection: 'row', alignItems: 'center' },
  delete: { minHeight: 28, paddingHorizontal: Spacing.two },
});
