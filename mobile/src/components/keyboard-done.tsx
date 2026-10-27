import { InputAccessoryView, Keyboard, Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useColors } from '@/hooks/use-theme';

// Every text field points its keyboard at this bar, so there's always a "Done" that closes the
// keyboard and keeps what was typed (multi-line fields have no other way out on iOS).
export const KEYBOARD_DONE_ID = 'pix-keyboard-done';

// Mounted once in the root layout. iOS only: Android has the system back button for this.
export function KeyboardDoneBar() {
  const c = useColors();
  if (Platform.OS !== 'ios') return null;
  return (
    <InputAccessoryView nativeID={KEYBOARD_DONE_ID}>
      <View style={[styles.bar, { backgroundColor: c.surface, borderTopColor: c.line }]}>
        <Pressable onPress={() => Keyboard.dismiss()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close keyboard">
          <ThemedText style={{ fontWeight: '700', fontSize: 16 }}>Done</ThemedText>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two + 2,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
