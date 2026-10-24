import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { PastelScope } from '@/components/pastel';
import { ThemedText } from '@/components/themed-text';
import { Button, Empty, ErrorText, Fab, TabHeader, useTabBarSpace } from '@/components/ui';
import { OnPastel, Pastel, pastelAt, Radius, Spacing } from '@/constants/theme';
import { parseDay } from '@/lib/format';
import { useActiveGroup } from '@/lib/groups';
import { signedUrls } from '@/lib/photos';
import { supabase } from '@/lib/supabase';
import type { Memory } from '@/lib/types';
import { must, useQuery } from '@/lib/use-query';

type MemoryWithCover = Memory & { memory_photos: { storage_path: string }[] };

const TALL = 230;
const SHORT = 165;

export default function MemoriesScreen() {
  const group = useActiveGroup();
  const bottomSpace = useTabBarSpace();

  const query = useQuery(async () => {
    const [memories, photoCount] = await Promise.all([
      supabase
        .from('memories')
        .select('*, memory_photos(storage_path)')
        .eq('group_id', group.id)
        .order('happened_on', { ascending: false })
        .order('created_at', { referencedTable: 'memory_photos' })
        .limit(1, { referencedTable: 'memory_photos' })
        .returns<MemoryWithCover[]>(),
      supabase.from('memory_photos').select('id', { count: 'exact', head: true }).eq('group_id', group.id),
    ]);
    const list = must<MemoryWithCover[]>(memories);
    const covers = await signedUrls(list.flatMap((m) => m.memory_photos.map((p) => p.storage_path)));
    return { memories: list, covers, photos: photoCount.count ?? 0 };
  }, [group.id]);

  const memories = query.data?.memories ?? [];
  const covers = query.data?.covers ?? {};
  const today = new Date();
  const onThisDay = memories.filter((m) => {
    const d = parseDay(m.happened_on);
    return d.getMonth() === today.getMonth() && d.getDate() === today.getDate() && d.getFullYear() < today.getFullYear();
  });

  // Two columns that alternate tall/short tiles, like the mockup.
  const columns: { item: MemoryWithCover; index: number; height: number }[][] = [[], []];
  memories.forEach((item, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    columns[col].push({ item, index, height: (row + col) % 2 === 0 ? TALL : SHORT });
  });

  const subtitle = query.data
    ? `${memories.length} ${memories.length === 1 ? 'memory' : 'memories'} · ${query.data.photos} photos`
    : undefined;
  const open = (id: string) => router.push({ pathname: '/memory/[id]', params: { id } });

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomSpace + 72 }}
        refreshControl={<RefreshControl refreshing={query.loading && !!query.data} onRefresh={query.reload} />}>
        <TabHeader title="Memories" subtitle={subtitle} />
        <View style={styles.body}>
          <ErrorText>{query.error}</ErrorText>

          {onThisDay.map((m) => {
            const cover = m.memory_photos[0]?.storage_path;
            const years = today.getFullYear() - parseDay(m.happened_on).getFullYear();
            return (
              <PastelScope key={m.id}>
              <Pressable onPress={() => open(m.id)} style={({ pressed }) => [styles.otd, pressed && styles.pressed]}>
                {cover ? (
                  <Image source={{ uri: covers[cover], cacheKey: cover }} style={styles.otdThumb} contentFit="cover" />
                ) : (
                  <View style={[styles.otdThumb, { backgroundColor: Pastel.salmon }]} />
                )}
                <View style={{ flex: 1 }}>
                  <ThemedText type="label">
                    On this day · {years} {years === 1 ? 'year' : 'years'} ago
                  </ThemedText>
                  <ThemedText style={{ fontSize: 18, fontWeight: '700' }} numberOfLines={1}>
                    {m.title}
                  </ThemedText>
                </View>
                <Icon name="chevronRight" size={16} />
              </Pressable>
              </PastelScope>
            );
          })}

          {memories.length === 0 && !query.loading ? (
            <Empty
              color={Pastel.yellow}
              title="No memories yet"
              body="Photos and notes from a date or a day out, all in one shared folder."
              action={<Button title="Add a memory" small onPress={() => router.push('/memory/new')} />}
            />
          ) : (
            <View style={styles.grid}>
              {columns.map((col, c) => (
                <View key={c} style={styles.column}>
                  {col.map(({ item, index, height }) => {
                    const cover = item.memory_photos[0]?.storage_path;
                    const date = parseDay(item.happened_on).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
                    return (
                      <PastelScope key={item.id}>
                      <Pressable
                        onPress={() => open(item.id)}
                        style={({ pressed }) => [
                          styles.tile,
                          { height, backgroundColor: pastelAt(index + 2) },
                          pressed && styles.pressed,
                        ]}>
                        {cover && (
                          <Image
                            source={{ uri: covers[cover], cacheKey: cover }}
                            style={StyleSheet.absoluteFill}
                            contentFit="cover"
                            transition={150}
                          />
                        )}
                        <View style={styles.dateChip}>
                          <ThemedText style={{ fontSize: 12, fontWeight: '700' }}>{date}</ThemedText>
                        </View>
                        <View style={{ flex: 1 }} />
                        <ThemedText
                          numberOfLines={2}
                          style={[styles.tileTitle, cover && styles.tileTitleOnPhoto]}>
                          {item.title}
                        </ThemedText>
                      </Pressable>
                      </PastelScope>
                    );
                  })}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
      <Fab label="New memory" onPress={() => router.push('/memory/new')} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { paddingHorizontal: Spacing.four, gap: Spacing.three - 4 },
  pressed: { transform: [{ scale: 0.98 }] },
  otd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: Pastel.yellow,
    borderRadius: Radius.tile,
    padding: Spacing.three - 4,
    paddingRight: Spacing.four - 4,
  },
  otdThumb: { width: 60, height: 60, borderRadius: 16 },
  grid: { flexDirection: 'row', gap: Spacing.three - 4 },
  column: { flex: 1, gap: Spacing.three - 4 },
  tile: { borderRadius: Radius.tile, padding: Spacing.three - 4, overflow: 'hidden' },
  dateChip: {
    alignSelf: 'flex-start',
    backgroundColor: OnPastel.chip,
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tileTitle: { fontSize: 18, lineHeight: 22, fontWeight: '700', letterSpacing: -0.3 },
  tileTitleOnPhoto: {
    alignSelf: 'flex-start',
    backgroundColor: OnPastel.chip,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 15,
    lineHeight: 19,
    overflow: 'hidden',
  },
});
