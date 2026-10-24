import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';

import { CreateOrJoin } from '@/components/create-or-join';
import { PastelView } from '@/components/pastel';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Avatar, Button, Card, Chip, ErrorText } from '@/components/ui';
import { Pastel, pastelFor, Radius, Spacing, type Theme } from '@/constants/theme';
import { useColors, useStyles } from '@/hooks/use-theme';
import { useUserId } from '@/lib/auth';
import { useGroups } from '@/lib/groups';
import { invalidateMembers, useMembers } from '@/lib/members';
import { supabase } from '@/lib/supabase';

export default function GroupsScreen() {
  const userId = useUserId();
  const c = useColors();
  const s = useStyles(makeStyles);
  const { groups, active, setActiveId, refresh } = useGroups();
  const members = useMembers(active?.id);
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!active) return null;

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
          invalidateMembers(active!.id);
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
              style={[s.groupRow, selected && { borderColor: c.text }]}>
              <Avatar member={{ initial: g.name.charAt(0).toUpperCase(), color: pastelFor(g.id) }} size={40} />
              <ThemedText style={{ flex: 1, fontSize: 18, fontWeight: '700' }} numberOfLines={1}>
                {g.name}
              </ThemedText>
              {selected && (
                <View style={[styles.check, { backgroundColor: c.primary }]}>
                  <Icon name="check" size={14} color={c.onPrimary} />
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      <PastelView color={Pastel.yellow} style={styles.invite}>
        <ThemedText type="label">Invite to {active.name}</ThemedText>
        <ThemedText style={styles.code}>{active.invite_code}</ThemedText>
        <Button
          title="Share invite"
          icon="share"
          onPress={() =>
            Share.share({ message: `Join "${active.name}" on Pix with invite code ${active.invite_code}` })
          }
        />
      </PastelView>

      <Card>
        <ThemedText type="label" themeColor="textSecondary">
          Members
        </ThemedText>
        <View style={{ gap: Spacing.two, marginTop: Spacing.two }}>
          {members.map((m) => (
            <View key={m.id} style={styles.member}>
              <Avatar member={m} size={36} />
              <ThemedText style={{ flex: 1, fontWeight: '600' }}>
                {m.name}
                {m.id === userId ? ' (you)' : ''}
              </ThemedText>
              {m.role === 'owner' && <Chip label="Owner" tone="track" />}
            </View>
          ))}
        </View>
      </Card>

      <ErrorText>{error}</ErrorText>

      {showAdd ? (
        <CreateOrJoin onDone={() => setShowAdd(false)} />
      ) : (
        <Button title="Create or join another group" icon="plus" variant="secondary" onPress={() => setShowAdd(true)} />
      )}

      <View style={{ gap: Spacing.two, marginTop: Spacing.four }}>
        <Button title="Leave group" variant="danger" onPress={leave} />
        <Button title="Sign out" variant="secondary" onPress={() => supabase.auth.signOut()} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.four, gap: Spacing.three, paddingBottom: Spacing.six },
  check: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  invite: { borderRadius: Radius.card, padding: Spacing.four, gap: Spacing.two },
  code: { fontSize: 48, lineHeight: 56, fontWeight: '800', letterSpacing: 6, marginBottom: Spacing.two },
  member: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
});

const makeStyles = (c: Theme) =>
  StyleSheet.create({
    groupRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.three,
      padding: Spacing.three - 4,
      borderRadius: Radius.tile,
      backgroundColor: c.surface,
      borderWidth: 2,
      borderColor: c.line,
    },
  });
