import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { KEYBOARD_DONE_ID } from '@/components/keyboard-done';
import { ThemedText } from '@/components/themed-text';
import { Font, Radius, Spacing, type Theme } from '@/constants/theme';
import { useColors, useStyles } from '@/hooks/use-theme';
import { dayLabel, parseDay, toDay } from '@/lib/format';

// value and onChange use YYYY-MM-DD strings, matching the `date` columns.
export function DateField({ label, value, onChange }: { label: string; value: string; onChange: (day: string) => void }) {
  const c = useColors();
  const s = useStyles(makeStyles);
  return (
    <View style={s.row}>
      <ThemedText type="smallBold" themeColor="textMuted" style={{ flex: 1 }}>
        {label}
      </ThemedText>
      {Platform.OS === 'web' ? (
        <TextInput
          defaultValue={value}
          onChangeText={(t) => /^\d{4}-\d{2}-\d{2}$/.test(t) && onChange(t)}
          placeholder="YYYY-MM-DD"
          inputAccessoryViewID={KEYBOARD_DONE_ID}
          style={[s.pill, { fontFamily: Font.semibold, color: c.text }]}
        />
      ) : Platform.OS === 'ios' ? (
        <DateTimePicker
          value={parseDay(value)}
          mode="date"
          display="compact"
          accentColor={c.text}
          themeVariant={c.scheme}
          onChange={(_e, date) => date && onChange(toDay(date))}
        />
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            DateTimePickerAndroid.open({
              value: parseDay(value),
              mode: 'date',
              onChange: (e, date) => e.type === 'set' && date && onChange(toDay(date)),
            })
          }
          style={s.pill}>
          <ThemedText type="smallBold">{dayLabel(value)}</ThemedText>
        </Pressable>
      )}
    </View>
  );
}

const makeStyles = (c: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 60,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.line,
      borderRadius: Radius.field,
      paddingHorizontal: Spacing.three + 2,
      paddingVertical: Spacing.two,
    },
    pill: {
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two,
      borderRadius: Radius.pill,
      backgroundColor: c.track,
    },
  });
