import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';

import { CreateOrJoin } from '@/components/create-or-join';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chip, ErrorText } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUserId } from '@/lib/auth';
import { useGroups } from '@/lib/groups';
import { supabase } from '@/lib/supabase';
import type { Member } from '@/lib/types';
import { must, useQuery } from '@/lib/use-query';

const RADIUS_OPTIONS_KM = [1, 3, 5, 10, 25];

export default function GroupsScreen() {
  const theme = useTheme();
  const userId = useUserId();
  const { groups, active, setActiveId, refresh } = useGroups();
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const members = useQuery(
    async () =>
      active
        ? must<Member[]>(
            await supabase
              .from('group_members')
              .select('user_id, role, profiles(display_name)')
              .eq('group_id', active.id)
              .returns<Member[]>(),
          )
        : [],
    [active?.id],
  );

  if (!active) return null;

  async function setRadius(km: number) {
    const { error } = await supabase.from('groups').update({ search_radius_m: km * 1000 }).eq('id', active!.id);
    if (error) setError(error.message);
    else refresh();
  }

  function leave() {
    Alert.alert(`Leave ${active!.name}?`, 'You will lose access to its places, memories and dates.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase
            .from('group_members')
            .delete()
            .eq('group_id', active!.id)
            .eq('user_id', userId);
          if (error) return setError(error.message);
          const remaining = await refresh();
          if (remaining[0]) setActiveId(remaining[0].id);
          if (router.canGoBack()) router.back();
        },
      },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={{ gap: Spacing.two }}>
        {groups.map((g) => {
          const selected = g.id === active.id;
          return (
            <Pressable
              key={g.id}
              onPress={() => setActiveId(g.id)}
              accessibilityState={{ selected }}
              style={[
                styles.groupRow,
                { backgroundColor: theme.backgroundElement, borderColor: selected ? theme.accent : 'transparent' },
              ]}>
              <ThemedText style={{ flex: 1, fontWeight: '600' }}>{g.name}</ThemedText>
              {selected && <ThemedText themeColor="accent">✓</ThemedText>}
            </Pressable>
          );
        })}
      </View>

      <Card>
        <ThemedText type="smallBold" themeColor="textSecondary">
          Invite to {active.name}
        </ThemedText>
        <ThemedText style={styles.code}>{active.invite_code}</ThemedText>
        <Button
          title="Share invite"
          small
          onPress={() =>
            Share.share({ message: `Join "${active.name}" on Pix with invite code ${active.invite_code}` })
          }
        />
      </Card>

      <Card>
        <ThemedText type="smallBold" themeColor="textSecondary">
          Members
        </ThemedText>
        {members.data?.map((m) => (
          <ThemedText key={m.user_id}>
            {m.profiles?.display_name || 'Someone'}
            {m.user_id === userId ? ' (you)' : ''}
            {m.role === 'owner' ? ' · owner' : ''}
          </ThemedText>
        ))}
      </Card>

      <Card>
        <ThemedText type="smallBold" themeColor="textSecondary">
          Search radius for places
        </ThemedText>
        <View style={styles.chips}>
          {RADIUS_OPTIONS_KM.map((km) => (
            <Chip
              key={km}
              label={`${km} km`}
              selected={active.search_radius_m === km * 1000}
              onPress={() => setRadius(km)}
            />
          ))}
        </View>
      </Card>

      <ErrorText>{error ?? members.error}</ErrorText>

      {showAdd ? (
        <CreateOrJoin onDone={() => setShowAdd(false)} />
      ) : (
        <Button title="Create or join another group" variant="secondary" onPress={() => setShowAdd(true)} />
      )}

      <View style={{ gap: Spacing.two, marginTop: Spacing.four }}>
        <Button title={`Leave ${active.name}`} variant="danger" onPress={leave} />
        <Button title="Sign out" variant="secondary" onPress={() => supabase.auth.signOut()} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: 14,
    borderWidth: 2,
  },
  code: { fontSize: 32, lineHeight: 40, fontWeight: '700', letterSpacing: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.one },
});
