import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { PastelView } from '@/components/pastel';
import { ThemedText } from '@/components/themed-text';
import { AvatarStack, Button, ErrorText, Loading } from '@/components/ui';
import { Pastel, Radius, Spacing } from '@/constants/theme';
import { useColors } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { prettyType, priceLabel } from '@/lib/format';
import { useActiveGroup } from '@/lib/groups';
import { useMembers } from '@/lib/members';
import { leaders, tallyVotes, type Poll, type PollOption, type PollVote } from '@/lib/plan';
import { mapsUrl } from '@/lib/places';
import { supabase } from '@/lib/supabase';
import { must, useQuery } from '@/lib/use-query';

export default function PollScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const group = useActiveGroup();
  const members = useMembers(group.id);
  const { session } = useAuth();
  const me = session?.user.id;
  const c = useColors();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const query = useQuery(async () => {
    const poll = must<Poll>(await supabase.from('polls').select('*').eq('id', id).single());
    const options = must<PollOption[]>(await supabase.from('poll_options').select('*').eq('poll_id', id).order('name'));
    const votes = must<PollVote[]>(await supabase.from('poll_votes').select('*').eq('poll_id', id));
    return { poll, options, votes };
  }, [id]);

  if (!query.data) return query.error ? <ErrorText>{query.error}</ErrorText> : <Loading />;

  const { poll, options, votes } = query.data;
  const open = poll.status === 'open';
  const isCreator = poll.created_by === me;
  const tally = tallyVotes(options, votes);
  const myVote = votes.find((v) => v.user_id === me)?.option_id;
  const winner = options.find((o) => o.id === poll.winner_option_id);
  const mostVotes = tally[0]?.votes ?? 0;

  async function vote(option: PollOption) {
    if (!open || busy) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase
      .from('poll_votes')
      .upsert({ poll_id: poll.id, option_id: option.id, group_id: group.id, user_id: me }, { onConflict: 'poll_id,user_id' });
    setBusy(false);
    if (error) return setError(error.message);
    query.reload();
  }

  async function closePoll() {
    const top = leaders(tally);
    if (top.length === 0) return setError('Nobody has voted yet.');
    // On a tie, pick one of the leaders at random.
    const pick = top[Math.floor(Math.random() * top.length)].option;
    setBusy(true);
    setError(null);
    const { error } = await supabase.from('polls').update({ status: 'closed', winner_option_id: pick.id }).eq('id', poll.id);
    setBusy(false);
    if (error) return setError(error.message);
    query.reload();
  }

  function confirmClose() {
    const top = leaders(tally);
    Alert.alert(
      'Close this poll?',
      top.length > 1 ? 'There is a tie, so one of the leading places will be picked at random.' : 'The place with the most votes wins.',
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Close poll', onPress: closePoll }],
    );
  }

  function confirmDelete() {
    Alert.alert('Delete this poll?', 'Its votes will be removed for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('polls').delete().eq('id', poll.id);
          if (error) return setError(error.message);
          router.back();
        },
      },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedText type="title">{poll.title}</ThemedText>
      <ThemedText type="small" themeColor="textMuted">
        {votes.length} of {members.length || '?'} voted · {open ? 'Tap a place to vote' : 'Closed'}
      </ThemedText>

      {winner && (
        <PastelView color={Pastel.mint} style={styles.winner}>
          <ThemedText type="smallBold" themeColor="textSoft">
            The group chose
          </ThemedText>
          <ThemedText type="subtitle">{winner.name}</ThemedText>
          <Button
            title="Open in Maps"
            icon="map"
            variant="white"
            small
            onPress={() => Linking.openURL(mapsUrl(winner.name, winner.place_id))}
            style={{ alignSelf: 'flex-start' }}
          />
        </PastelView>
      )}

      <View style={{ gap: Spacing.two }}>
        {tally.map(({ option, votes: count, voterIds }) => {
          const mine = myVote === option.id;
          const isWinner = poll.winner_option_id === option.id;
          const voters = members.filter((m) => voterIds.includes(m.id));
          const share = mostVotes ? count / mostVotes : 0;
          return (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              accessibilityState={{ selected: mine, disabled: !open }}
              onPress={() => vote(option)}
              style={({ pressed }) => [
                styles.option,
                { backgroundColor: c.track, borderColor: mine ? c.primary : c.line, borderWidth: mine ? 2 : 1 },
                pressed && open && { transform: [{ scale: 0.985 }] },
              ]}>
              <View style={[styles.bar, { width: `${share * 100}%`, backgroundColor: isWinner ? Pastel.mint : Pastel.lavender }]} />
              <View style={styles.optionTop}>
                <View style={{ flex: 1, gap: 2 }}>
                  <ThemedText style={{ fontWeight: '700' }} numberOfLines={1}>
                    {option.name}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textMuted" numberOfLines={1}>
                    {[prettyType(option.primary_type), priceLabel(option.price_level), option.locality].filter(Boolean).join(' · ')}
                  </ThemedText>
                </View>
                {mine && <Icon name="check" size={18} />}
                <ThemedText style={{ fontWeight: '800', fontSize: 20 }}>{count}</ThemedText>
              </View>
              {voters.length > 0 && <AvatarStack members={voters} size={24} max={5} />}
            </Pressable>
          );
        })}
      </View>

      <ErrorText>{error ?? query.error}</ErrorText>

      {isCreator && open && <Button title="Close poll and pick the winner" icon="check" onPress={confirmClose} loading={busy} />}
      {isCreator && <Button title="Delete poll" icon="trash" variant="danger" onPress={confirmDelete} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.four, gap: Spacing.three, paddingBottom: Spacing.six },
  winner: { borderRadius: Radius.card, padding: Spacing.three + 2, gap: Spacing.two },
  option: {
    borderRadius: Radius.field,
    overflow: 'hidden',
    paddingHorizontal: Spacing.three + 2,
    paddingVertical: Spacing.three - 2,
    gap: Spacing.two,
  },
  // Fills from the left in proportion to the votes, behind the text.
  bar: { position: 'absolute', top: 0, bottom: 0, left: 0, opacity: 0.45 },
  optionTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
