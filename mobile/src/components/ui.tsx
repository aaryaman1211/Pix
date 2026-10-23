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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Font, Palette, Radius, Spacing } from '@/constants/theme';
import { useGroups } from '@/lib/groups';
import { useMembers, type MemberInfo } from '@/lib/members';

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export const TAB_BAR_HEIGHT = 68;

export function tabBarBottom(insetBottom: number) {
  return Math.max(insetBottom, Spacing.three) - 4;
}

// Bottom padding a tab screen needs so content clears the floating tab bar.
export function useTabBarSpace() {
  const insets = useSafeAreaInsets();
  return TAB_BAR_HEIGHT + tabBarBottom(insets.bottom) + Spacing.four;
}

// Group pill + search button, then the big title and subtitle. Used at the top of every tab.
export function TabHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + Spacing.two }]}>
      <View style={styles.headerRow}>
        <GroupPill />
        <IconCircle icon="search" label="Find a place" onPress={() => router.push('/search')} />
      </View>
      <ThemedText type="title" style={{ marginTop: Spacing.four }}>
        {title}
      </ThemedText>
      {subtitle ? (
        <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: 2 }}>
          {subtitle}
        </ThemedText>
      ) : null}
    </View>
  );
}

export function GroupPill() {
  const { active } = useGroups();
  const members = useMembers(active?.id);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Group: ${active?.name ?? 'none'}. Switch group`}
      onPress={() => router.push('/groups')}
      style={({ pressed }) => [styles.groupPill, pressed && styles.pressed]}>
      <AvatarStack members={members} />
      <ThemedText type="smallBold" numberOfLines={1} style={{ maxWidth: 160 }}>
        {active?.name ?? 'No group'}
      </ThemedText>
      <Icon name="chevronDown" size={12} />
    </Pressable>
  );
}

export function Avatar({ member, size = 28, ring = Palette.track }: { member: Pick<MemberInfo, 'initial' | 'color'>; size?: number; ring?: string }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: member.color,
        borderWidth: 2,
        borderColor: ring,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <ThemedText style={{ fontSize: size * 0.42, lineHeight: size * 0.55, fontWeight: '700' }}>{member.initial}</ThemedText>
    </View>
  );
}

export function AvatarStack({ members, size = 28, max = 3 }: { members: MemberInfo[]; size?: number; max?: number }) {
  if (members.length === 0) return null;
  const shown = members.slice(0, max);
  const extra = members.length - shown.length;
  return (
    <View style={{ flexDirection: 'row' }}>
      {shown.map((m, i) => (
        <View key={m.id} style={{ marginLeft: i === 0 ? 0 : -size / 3 }}>
          <Avatar member={m} size={size} />
        </View>
      ))}
      {extra > 0 && (
        <View style={{ marginLeft: -size / 3 }}>
          <Avatar member={{ initial: `+${extra}`, color: Palette.white }} size={size} />
        </View>
      )}
    </View>
  );
}

export function IconCircle({
  icon,
  label,
  onPress,
  color = Palette.track,
  iconColor = Palette.ink,
  size = 44,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  color?: string;
  iconColor?: string;
  size?: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
        styles.center,
        pressed && styles.pressed,
      ]}>
      <Icon name={icon} size={size * 0.42} color={iconColor} />
    </Pressable>
  );
}

// Floating "+" in the bottom-right corner of a tab, above the tab bar.
export function Fab({ color, onPress, label, dark }: { color: string; onPress: () => void; label: string; dark?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.fab,
        { backgroundColor: color, bottom: TAB_BAR_HEIGHT + tabBarBottom(insets.bottom) + Spacing.three },
        pressed && { transform: [{ scale: 0.94 }] },
      ]}>
      <Icon name="plus" size={26} color={dark ? Palette.white : Palette.ink} />
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

type ButtonProps = Omit<PressableProps, 'style'> & {
  title: string;
  variant?: 'primary' | 'secondary' | 'white' | 'danger';
  icon?: IconName;
  loading?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
};

const BUTTON_COLORS = {
  primary: { bg: Palette.ink, fg: Palette.white },
  secondary: { bg: Palette.track, fg: Palette.ink },
  white: { bg: Palette.white, fg: Palette.ink },
  danger: { bg: Palette.track, fg: Palette.danger },
} as const;

export function Button({ title, variant = 'primary', icon, loading, small, disabled, style, ...rest }: ButtonProps) {
  const { bg, fg } = BUTTON_COLORS[variant];
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: bg, opacity: disabled ? 0.4 : 1 },
        pressed && styles.pressed,
        style,
      ]}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Icon name={icon} size={small ? 14 : 16} color={fg} />}
          <ThemedText type={small ? 'smallBold' : 'default'} style={{ color: fg, fontWeight: '700' }}>
            {title}
          </ThemedText>
        </>
      )}
    </Pressable>
  );
}

export function Input({ label, style, ...rest }: TextInputProps & { label?: string }) {
  return (
    <View style={{ gap: Spacing.two }}>
      {label && (
        <ThemedText type="smallBold" themeColor="textSecondary">
          {label}
        </ThemedText>
      )}
      <TextInput
        placeholderTextColor={Palette.muted}
        style={[styles.input, rest.multiline && styles.inputMultiline, style]}
        {...rest}
      />
    </View>
  );
}

export function Card({
  children,
  onPress,
  onLongPress,
  color = Palette.white,
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const cardStyle = [styles.card, { backgroundColor: color }, color === Palette.white && styles.cardOutline, style];
  if (!onPress && !onLongPress) return <View style={cardStyle}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [cardStyle, pressed && { transform: [{ scale: 0.985 }] }]}>
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
  return (
    <View style={styles.segmented}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            style={[styles.segment, selected && { backgroundColor: Palette.ink }]}>
            <ThemedText type="smallBold" style={{ color: selected ? Palette.white : Palette.ink }}>
              {o.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  color = Palette.white,
  icon,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  color?: string;
  icon?: IconName;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityState={{ selected }}
      style={[styles.chip, { backgroundColor: selected ? Palette.ink : color }]}>
      {icon && <Icon name={icon} size={12} color={selected ? Palette.white : Palette.ink} />}
      <ThemedText type="smallBold" style={{ color: selected ? Palette.white : Palette.ink }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

export function Stars({ value, onChange, size = 30 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: Spacing.two }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={n}
          disabled={!onChange}
          onPress={() => onChange?.(n)}
          accessibilityLabel={`${n} star${n > 1 ? 's' : ''}`}
          hitSlop={4}>
          <Icon name="star" size={size} color={n <= value ? Palette.ink : Palette.line} />
        </Pressable>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------

export function Empty({ title, body, action, color = Palette.lavender }: { title: string; body: string; action?: ReactNode; color?: string }) {
  // Decoration dots in two pastels that differ from the card itself.
  const [big, small] = [Palette.yellow, Palette.salmon, Palette.lavender, Palette.mint].filter((c) => c !== color);
  return (
    <View style={[styles.empty, { backgroundColor: color }]}>
      <View style={styles.emptyDots}>
        <View style={[styles.dot, { backgroundColor: big, width: 56, height: 56 }]} />
        <View style={[styles.dot, { backgroundColor: small, width: 32, height: 32, marginLeft: -14 }]} />
      </View>
      <ThemedText type="subtitle">{title}</ThemedText>
      <ThemedText style={{ color: Palette.inkSoft }}>{body}</ThemedText>
      {action && <View style={{ marginTop: Spacing.two, alignSelf: 'flex-start' }}>{action}</View>}
    </View>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <ThemedText type="small" themeColor="danger">
      {children}
    </ThemedText>
  );
}

export function Loading() {
  return (
    <View style={[styles.center, { padding: Spacing.five }]}>
      <ActivityIndicator color={Palette.ink} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.75 },
  header: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.three, backgroundColor: Palette.canvas },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  groupPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: Palette.track,
    borderRadius: Radius.pill,
    paddingLeft: 6,
    paddingRight: 14,
    height: 44,
  },
  fab: {
    position: 'absolute',
    right: Spacing.four,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  button: {
    minHeight: 54,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.four,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  buttonSmall: { minHeight: 40, paddingHorizontal: Spacing.three },
  input: {
    backgroundColor: Palette.white,
    borderWidth: 1,
    borderColor: Palette.line,
    borderRadius: Radius.field,
    paddingHorizontal: Spacing.three + 2,
    paddingVertical: 15,
    fontSize: 16,
    fontFamily: Font.medium,
    color: Palette.ink,
  },
  inputMultiline: { minHeight: 110, textAlignVertical: 'top', paddingTop: 15 },
  card: { borderRadius: Radius.tile, padding: Spacing.four - 4, gap: Spacing.one },
  cardOutline: { borderWidth: 1, borderColor: Palette.line },
  segmented: { flexDirection: 'row', backgroundColor: Palette.track, borderRadius: Radius.pill, padding: 4 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: Radius.pill },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radius.pill,
  },
  empty: { borderRadius: Radius.card, padding: Spacing.four, gap: Spacing.two, overflow: 'hidden' },
  emptyDots: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: Spacing.two },
  dot: { borderRadius: 999 },
});
