import { Image } from 'expo-image';
import { router } from 'expo-router';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AddButton, Button, Card, Empty, ErrorText, TabHeader } from '@/components/ui';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { dayLabel, parseDay } from '@/lib/format';
import { useActiveGroup } from '@/lib/groups';
import { signedUrls } from '@/lib/photos';
import { supabase } from '@/lib/supabase';
import type { Memory } from '@/lib/types';
import { must, useQuery } from '@/lib/use-query';

type MemoryWithCover = Memory & { memory_photos: { storage_path: string }[] };

export default function MemoriesScreen() {
  const group = useActiveGroup();
  const theme = useTheme();

  const query = useQuery(async () => {
    const memories = must<MemoryWithCover[]>(
      await supabase
        .from('memories')
        .select('*, memory_photos(storage_path)')
        .eq('group_id', group.id)
        .order('happened_on', { ascending: false })
        .order('created_at', { referencedTable: 'memory_photos' })
        .limit(1, { referencedTable: 'memory_photos' })
        .returns<MemoryWithCover[]>(),
    );
    const covers = await signedUrls(memories.flatMap((m) => m.memory_photos.map((p) => p.storage_path)));
    return { memories, covers };
  }, [group.id]);

  const memories = query.data?.memories ?? [];
  const today = new Date();
  const onThisDay = memories.filter((m) => {
    const d = parseDay(m.happened_on);
    return d.getMonth() === today.getMonth() && d.getDate() === today.getDate() && d.getFullYear() < today.getFullYear();
  });

  return (
    <View style={{ flex: 1 }}>
      <TabHeader title="Memories" action={<AddButton label="New memory" onPress={() => router.push('/memory/new')} />} />
      <FlatList
        data={memories}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={query.loading && !!query.data} onRefresh={query.reload} />}
        ListHeaderComponent={
          <View style={{ gap: Spacing.two }}>
            <ErrorText>{query.error}</ErrorText>
            {onThisDay.map((m) => (
              <Card
                key={m.id}
                onPress={() => router.push({ pathname: '/memory/[id]', params: { id: m.id } })}
                style={{ backgroundColor: theme.accent }}>
                <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
                  On this day, {today.getFullYear() - parseDay(m.happened_on).getFullYear()} year(s) ago
                </ThemedText>
                <ThemedText style={{ color: theme.onAccent, fontWeight: '600' }}>{m.title}</ThemedText>
              </Card>
            ))}
          </View>
        }
        ListEmptyComponent={
          query.loading ? undefined : (
            <Empty
              title="No memories yet"
              body="Save the photos and notes from a date or a day out, all in one place."
              action={<Button title="Add a memory" small onPress={() => router.push('/memory/new')} />}
            />
          )
        }
        renderItem={({ item }) => {
          const cover = item.memory_photos[0]?.storage_path;
          return (
            <Card
              onPress={() => router.push({ pathname: '/memory/[id]', params: { id: item.id } })}
              style={styles.card}>
              {cover ? (
                <Image
                  source={{ uri: query.data?.covers[cover], cacheKey: cover }}
                  style={styles.cover}
                  contentFit="cover"
                  transition={150}
                />
              ) : null}
              <View style={styles.cardBody}>
                <ThemedText style={{ fontWeight: '600' }}>{item.title}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {[dayLabel(item.happened_on), item.place_name].filter(Boolean).join(' · ')}
                </ThemedText>
              </View>
            </Card>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: Spacing.three, gap: Spacing.three, paddingBottom: BottomTabInset + Spacing.four },
  card: { padding: 0, overflow: 'hidden' },
  cover: { width: '100%', aspectRatio: 16 / 10 },
  cardBody: { padding: Spacing.three, gap: 2 },
});
