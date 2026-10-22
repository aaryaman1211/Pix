import { router } from 'expo-router';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useGroups } from '@/lib/groups';

// Top of every tab: big title, active group (tap to switch), optional action.
export function TabHeader({ title, action }: { title: string; action?: ReactNode }) {
  const theme = useTheme();
  const { active } = useGroups();
  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: theme.background }}>
      <View style={styles.tabHeader}>
        <View style={{ flex: 1 }}>
          <Pressable onPress={() => router.push('/groups')} hitSlop={8}>
            <ThemedText type="smallBold" themeColor="accent">
              {active?.name ?? 'No group'} ▾
            </ThemedText>
          </Pressable>
          <ThemedText style={styles.tabTitle}>{title}</ThemedText>
        </View>
        {action}
      </View>
    </SafeAreaView>
  );
}

type ButtonProps = Omit<PressableProps, 'style'> & {
  title: string;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({ title, variant = 'primary', loading, small, disabled, style, ...rest }: ButtonProps) {
  const theme = useTheme();
  const background = variant === 'primary' ? theme.accent : theme.backgroundElement;
  const color = variant === 'primary' ? theme.onAccent : variant === 'danger' ? theme.accent : theme.text;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: background, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
        style,
      ]}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={color} />
      ) : (
        <ThemedText type={small ? 'smallBold' : 'default'} style={{ color, fontWeight: '600' }}>
          {title}
        </ThemedText>
      )}
    </Pressable>
  );
}

export function AddButton({ onPress, label = 'Add' }: { onPress: () => void; label?: string }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.addButton, { backgroundColor: theme.accent, opacity: pressed ? 0.8 : 1 }]}>
      <ThemedText style={{ color: theme.onAccent, fontSize: 24, lineHeight: 28, fontWeight: '600' }}>+</ThemedText>
    </Pressable>
  );
}

export function Input({ label, style, ...rest }: TextInputProps & { label?: string }) {
  const theme = useTheme();
  return (
    <View style={{ gap: Spacing.one }}>
      {label && (
        <ThemedText type="smallBold" themeColor="textSecondary">
          {label}
        </ThemedText>
      )}
      <TextInput
        placeholderTextColor={theme.textSecondary}
        style={[
          styles.input,
          { backgroundColor: theme.backgroundElement, color: theme.text, borderColor: theme.border },
          rest.multiline && { minHeight: 96, textAlignVertical: 'top' },
          style,
        ]}
        {...rest}
      />
    </View>
  );
}

export function Card({
  children,
  onPress,
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const cardStyle = [styles.card, { backgroundColor: theme.backgroundElement }, style];
  if (!onPress) return <View style={cardStyle}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [cardStyle, { opacity: pressed ? 0.85 : 1 }]}>
      {children}
    </Pressable>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: theme.backgroundElement }]}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            style={[styles.segment, selected && { backgroundColor: theme.background }]}>
            <ThemedText type="smallBold" themeColor={selected ? 'text' : 'textSecondary'}>
              {o.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityState={{ selected }}
      style={[styles.chip, { backgroundColor: selected ? theme.accent : theme.backgroundElement }]}>
      <ThemedText type="small" style={{ color: selected ? theme.onAccent : theme.text }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

export function Stars({ value, onChange, size = 28 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: Spacing.one }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={n}
          disabled={!onChange}
          onPress={() => onChange?.(n)}
          accessibilityLabel={`${n} star${n > 1 ? 's' : ''}`}
          hitSlop={4}>
          <ThemedText style={{ fontSize: size, lineHeight: size + 4, color: n <= value ? theme.star : theme.border }}>
            ★
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

export function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <ThemedText type="smallBold" style={{ fontSize: 18 }}>
        {title}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
        {body}
      </ThemedText>
      {action}
    </View>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <ThemedText type="small" themeColor="accent">
      {children}
    </ThemedText>
  );
}

export function Loading() {
  return (
    <View style={styles.empty}>
      <ActivityIndicator />
    </View>
  );
}

const styles = StyleSheet.create({
  tabHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  tabTitle: { fontSize: 32, lineHeight: 40, fontWeight: '700' },
  button: {
    minHeight: 50,
    borderRadius: 14,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSmall: { minHeight: 36, borderRadius: 10, paddingHorizontal: Spacing.three },
  addButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    fontSize: 16,
  },
  card: { borderRadius: 16, padding: Spacing.three, gap: Spacing.one },
  segmented: { flexDirection: 'row', borderRadius: 12, padding: 3 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: Spacing.two, borderRadius: 10 },
  chip: { paddingHorizontal: Spacing.three, paddingVertical: 6, borderRadius: 999 },
  empty: { alignItems: 'center', justifyContent: 'center', padding: Spacing.five, gap: Spacing.two },
});
