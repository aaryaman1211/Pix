import { router } from 'expo-router';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chip, Empty, ErrorText, Loading } from '@/components/ui';
import { Pastel, pastelAt, Spacing } from '@/constants/theme';
import { useActiveGroup } from '@/lib/groups';
import { useMembers } from '@/lib/members';
import { loadPolls } from '@/lib/plan';
import { useQuery } from '@/lib/use-query';

export default function PollsScreen() {
  const group = useActiveGroup();
  const members = useMembers(group.id);

  const query = useQuery(() => loadPolls(group.id), [group.id]);

  if (!query.data && query.loading) return <Loading />;

  const polls = query.data?.polls ?? [];
  const votes = query.data?.votes ?? [];

  return (
    <FlatList
      data={polls}
      keyExtractor={(p) => p.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={query.loading && !!query.data} onRefresh={query.reload} />}
      ListHeaderComponent={
        <View style={{ gap: Spacing.two }}>
          <Button title="New poll" icon="plus" onPress={() => router.push('/polls/new')} />
          <ErrorText>{query.error}</ErrorText>
        </View>
      }
      ListEmptyComponent={
        <Empty
          color={Pastel.lavender}
          title="No polls yet"
          body="Can't decide where to go? Put two or three places up and let everyone vote."
        />
      }
      renderItem={({ item, index }) => {
        const count = votes.filter((v) => v.poll_id === item.id).length;
        const creator = members.find((m) => m.id === item.created_by);
        return (
          <Card color={pastelAt(index)} onPress={() => router.push({ pathname: '/polls/[id]', params: { id: item.id } })}>
            <ThemedText type="subtitle">{item.title}</ThemedText>
            <ThemedText type="small" themeColor="textSoft">
              {creator ? `by ${creator.name} · ` : ''}
              {count} of {members.length || '?'} voted
            </ThemedText>
            <View style={{ flexDirection: 'row' }}>
              <Chip label={item.status === 'open' ? 'Open' : 'Closed'} selected={item.status === 'open'} />
            </View>
          </Card>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: Spacing.four, gap: Spacing.three, paddingBottom: Spacing.six },
});
