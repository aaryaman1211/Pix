import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, ErrorText, Input } from '@/components/ui';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { useGroups } from '@/lib/groups';
import { supabase } from '@/lib/supabase';
import type { Group } from '@/lib/types';

// Create a new group or join one with an invite code. Used by onboarding and the groups screen.
export function CreateOrJoin({ onDone }: { onDone?: (group: Group) => void }) {
  const { refresh, setActiveId } = useGroups();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(kind: 'create' | 'join') {
    setBusy(kind);
    setError(null);
    const { data, error } =
      kind === 'create'
        ? await supabase.rpc('create_group', { group_name: name.trim() })
        : await supabase.rpc('join_group', { code: code.trim() });
    if (error) {
      setError(error.message);
      setBusy(null);
      return;
    }
    const group = data as Group;
    setActiveId(group.id);
    await refresh();
    setBusy(null);
    setName('');
    setCode('');
    onDone?.(group);
  }

  return (
    <View style={{ gap: Spacing.three }}>
      <View style={[styles.panel, { backgroundColor: Palette.salmon }]}>
        <ThemedText type="subtitle">Start a group</ThemedText>
        <Input placeholder="e.g. Us two, College crew" value={name} onChangeText={setName} maxLength={60} />
        <Button title="Create group" onPress={() => run('create')} loading={busy === 'create'} disabled={!name.trim()} />
      </View>

      <View style={[styles.panel, { backgroundColor: Palette.sky }]}>
        <ThemedText type="subtitle">Join with a code</ThemedText>
        <Input
          placeholder="ABC123"
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={6}
          style={{ letterSpacing: 4 }}
        />
        <Button
          title="Join group"
          variant="white"
          onPress={() => run('join')}
          loading={busy === 'join'}
          disabled={code.trim().length !== 6}
        />
      </View>

      <ErrorText>{error}</ErrorText>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderRadius: Radius.card, padding: Spacing.four - 4, gap: Spacing.three },
});
