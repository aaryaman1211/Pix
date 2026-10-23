import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';

import { DateField } from '@/components/date-field';
import { ThemedText } from '@/components/themed-text';
import { Button, Chip, ErrorText, Input } from '@/components/ui';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { toDay } from '@/lib/format';
import { useActiveGroup } from '@/lib/groups';
import { syncReminders } from '@/lib/reminders';
import { supabase } from '@/lib/supabase';

const SUGGESTIONS = ['Anniversary', 'Birthday', 'First date', 'The day we met'];

export default function NewDateScreen() {
  const group = useActiveGroup();
  const [title, setTitle] = useState('');
  const [day, setDay] = useState(toDay(new Date()));
  const [repeats, setRepeats] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const { error } = await supabase
      .from('important_dates')
      .insert({ group_id: group.id, title: title.trim(), date: day, repeats_yearly: repeats });
    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }
    syncReminders().catch(console.warn);
    router.back();
  }

  return (
    <ScrollView style={{ backgroundColor: Palette.canvas }} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Input label="What is it?" placeholder="Anniversary" value={title} onChangeText={setTitle} maxLength={80} />
      <View style={styles.chips}>
        {SUGGESTIONS.map((s) => (
          <Chip key={s} label={s} color={Palette.track} selected={title === s} onPress={() => setTitle(s)} />
        ))}
      </View>
      <DateField label="Date" value={day} onChange={setDay} />
      <View style={styles.row}>
        <ThemedText type="smallBold" themeColor="textSecondary" style={{ flex: 1 }}>
          Every year
        </ThemedText>
        <Switch value={repeats} onValueChange={setRepeats} trackColor={{ true: Palette.ink }} />
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        Everyone in {group.name} gets a reminder the day before and on the day.
      </ThemedText>
      <ErrorText>{error}</ErrorText>
      <Button title="Save date" onPress={save} loading={saving} disabled={!title.trim()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.four, gap: Spacing.three, paddingBottom: Spacing.six },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 60,
    backgroundColor: Palette.white,
    borderWidth: 1,
    borderColor: Palette.line,
    borderRadius: Radius.field,
    paddingHorizontal: Spacing.three + 2,
  },
});
