import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { DateField } from '@/components/date-field';
import { ThemedText } from '@/components/themed-text';
import { Button, Chip, ErrorText, Input } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { toDay } from '@/lib/format';
import { useActiveGroup } from '@/lib/groups';
import { useMembers } from '@/lib/members';
import { createExpense, parseRupees, rupees, splitEvenly } from '@/lib/plan';

const SUGGESTIONS = ['Breakfast', 'Lunch', 'Dinner', 'Coffee', 'Movie', 'Cab'];

// Add an expense: what, how much, who paid, and who shares it (split evenly).
export default function NewExpenseScreen() {
  const { title: initialTitle } = useLocalSearchParams<{ title?: string }>();
  const group = useActiveGroup();
  const members = useMembers(group.id);
  const { session } = useAuth();
  const me = session?.user.id ?? '';
  const [title, setTitle] = useState(initialTitle ?? '');
  const [amount, setAmount] = useState('');
  const [day, setDay] = useState(toDay(new Date()));
  const [payer, setPayer] = useState<string>(me);
  // `null` means everyone (including people who join while this screen is open).
  const [sharing, setSharing] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const everyone = members.map((m) => m.id);
  const sharedBy = sharing ?? everyone;
  const minor = parseRupees(amount);
  const shares = minor ? splitEvenly(minor, sharedBy) : [];
  const valid = !!title.trim() && !!minor && sharedBy.length > 0 && !!payer;

  function toggle(id: string) {
    const cur = sharing ?? everyone;
    setSharing(cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  }

  async function save() {
    if (!minor) return;
    setSaving(true);
    setError(null);
    try {
      await createExpense(group.id, me, {
        title: title.trim(),
        amount_minor: minor,
        paid_by: payer,
        spent_on: day,
        shares,
      });
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
      <Input label="What was it for?" placeholder="Dinner at Bandra" value={title} onChangeText={setTitle} maxLength={120} />
      <View style={styles.chips}>
        {SUGGESTIONS.map((x) => (
          <Chip key={x} label={x} tone="track" selected={title === x} onPress={() => setTitle(x)} />
        ))}
      </View>
      <Input label="Amount (₹)" placeholder="1200" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" maxLength={12} />
      <DateField label="Date" value={day} onChange={setDay} />

      <ThemedText type="smallBold" themeColor="textMuted">
        Who paid?
      </ThemedText>
      <View style={styles.chips}>
        {members.map((m) => (
          <Chip key={m.id} label={m.id === me ? 'You' : m.name} tone="track" selected={payer === m.id} onPress={() => setPayer(m.id)} />
        ))}
      </View>

      <ThemedText type="smallBold" themeColor="textMuted">
        Split between
      </ThemedText>
      <View style={styles.chips}>
        {members.map((m) => (
          <Chip
            key={m.id}
            label={m.id === me ? 'You' : m.name}
            tone="track"
            selected={sharedBy.includes(m.id)}
            onPress={() => toggle(m.id)}
          />
        ))}
      </View>

      {minor && sharedBy.length > 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {rupees(minor)} between {sharedBy.length} {sharedBy.length === 1 ? 'person' : 'people'}:{' '}
          {shares.map((s) => `${s.user_id === me ? 'You' : (members.find((m) => m.id === s.user_id)?.name ?? '?')} ${rupees(s.share_minor)}`).join(', ')}
        </ThemedText>
      ) : null}

      <ErrorText>{error}</ErrorText>
      <Button title="Save expense" onPress={save} loading={saving} disabled={!valid} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.four, gap: Spacing.three, paddingBottom: Spacing.six },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
