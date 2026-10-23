import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Font, Palette, Radius, Spacing } from '@/constants/theme';
import { dayLabel, parseDay, toDay } from '@/lib/format';

// value and onChange use YYYY-MM-DD strings, matching the `date` columns.
export function DateField({ label, value, onChange }: { label: string; value: string; onChange: (day: string) => void }) {
  return (
    <View style={styles.row}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={{ flex: 1 }}>
        {label}
      </ThemedText>
      {Platform.OS === 'web' ? (
        <TextInput
          defaultValue={value}
          onChangeText={(t) => /^\d{4}-\d{2}-\d{2}$/.test(t) && onChange(t)}
          placeholder="YYYY-MM-DD"
          style={[styles.pill, { fontFamily: Font.semibold, color: Palette.ink }]}
        />
      ) : Platform.OS === 'ios' ? (
        <DateTimePicker
          value={parseDay(value)}
          mode="date"
          display="compact"
          accentColor={Palette.ink}
          themeVariant="light"
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
          style={styles.pill}>
          <ThemedText type="smallBold">{dayLabel(value)}</ThemedText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 60,
    backgroundColor: Palette.white,
    borderWidth: 1,
    borderColor: Palette.line,
    borderRadius: Radius.field,
    paddingHorizontal: Spacing.three + 2,
    paddingVertical: Spacing.two,
  },
  pill: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    backgroundColor: Palette.track,
  },
});
