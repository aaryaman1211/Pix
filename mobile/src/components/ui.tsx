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

import { Bob } from '@/components/floating';
import { Icon, type IconName } from '@/components/icon';
import { PastelScope, PastelView, usePastel } from '@/components/pastel';
import { ThemedText, useTextColor } from '@/components/themed-text';
import { Font, OnPastel, Pastel, Radius, Spacing, type Theme } from '@/constants/theme';
import { useColors, useStyles } from '@/hooks/use-theme';
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

// Top of every tab: the page title leads, with the group as a small "with Girlfriend" line under it
// (tap to switch group). Member avatars and search sit on the right. Scrolls with the page.
export function TabHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const insets = useSafeAreaInsets();
  const c = useColors();
  const { active } = useGroups();
  const members = useMembers(active?.id);
  const openGroups = () => router.push('/groups');
  return (
    <View style={[styles.header, { paddingTop: insets.top + Spacing.three }]}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.title} numberOfLines={1}>
            {title}
          </ThemedText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Group: ${active?.name ?? 'none'}. Switch group`}
            onPress={openGroups}
            hitSlop={8}
            style={({ pressed }) => [styles.groupLine, pressed && styles.pressed]}>
            <ThemedText type="small" themeColor="textMuted">
              with
            </ThemedText>
            <ThemedText type="smallBold" numberOfLines={1} style={{ flexShrink: 1 }}>
              {active?.name ?? 'no group'}
            </ThemedText>
            <Icon name="chevronDown" size={10} color={c.textMuted} />
          </Pressable>
        </View>
        <View style={styles.headerActions}>
          <Pressable accessibilityRole="button" accessibilityLabel="Group members" onPress={openGroups} hitSlop={6}>
            <AvatarStack members={members} size={34} ring={c.canvas} />
          </Pressable>
          <IconCircle
            icon="search"
            label="Find a place"
            size={42}
            color={c.primary}
            iconColor={c.onPrimary}
            onPress={() => router.push('/search')}
          />
        </View>
      </View>
      {subtitle ? (
        <ThemedText type="small" themeColor="textMuted" style={{ marginTop: Spacing.three }}>
          {subtitle}
        </ThemedText>
      ) : null}
    </View>
  );
}

export function Avatar({
  member,
  size = 28,
  ring,
}: {
  member: Pick<MemberInfo, 'initial' | 'color'>;
  size?: number;
  ring?: string;
}) {
  const c = useColors();
  return (
    <PastelScope>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: member.color,
          borderWidth: 2,
          borderColor: ring ?? c.surface,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <ThemedText style={{ fontSize: size * 0.42, lineHeight: size * 0.55, fontWeight: '700' }}>
          {member.initial}
        </ThemedText>
      </View>
    </PastelScope>
  );
}

export function AvatarStack({
  members,
  size = 28,
  max = 3,
  ring,
}: {
  members: MemberInfo[];
  size?: number;
  max?: number;
  ring?: string;
}) {
  if (members.length === 0) return null;
  const shown = members.slice(0, max);
  const extra = members.length - shown.length;
  return (
    <View style={{ flexDirection: 'row' }}>
      {shown.map((m, i) => (
        <View key={m.id} style={{ marginLeft: i === 0 ? 0 : -size / 3 }}>
          <Avatar member={m} size={size} ring={ring} />
        </View>
      ))}
      {extra > 0 && (
        <View style={{ marginLeft: -size / 3 }}>
          <Avatar member={{ initial: `+${extra}`, color: OnPastel.chip }} size={size} ring={ring} />
        </View>
      )}
    </View>
  );
}

export function IconCircle({
  icon,
  label,
  onPress,
  color,
  iconColor,
  size = 44,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  color?: string;
  iconColor?: string;
  size?: number;
}) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color ?? c.track },
        styles.center,
        pressed && styles.pressed,
      ]}>
      <Icon name={icon} size={size * 0.42} color={iconColor} />
    </Pressable>
  );
}

// Floating "+" in the bottom-right corner of a tab, above the tab bar. Pass a pastel, or nothing
// for the theme's primary colour (black in light, white in dark).
export function Fab({ color, onPress, label }: { color?: string; onPress: () => void; label: string }) {
  const insets = useSafeAreaInsets();
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.fab,
        {
          backgroundColor: color ?? c.primary,
          bottom: TAB_BAR_HEIGHT + tabBarBottom(insets.bottom) + Spacing.three,
        },
        pressed && { transform: [{ scale: 0.94 }] },
      ]}>
      <Icon name="plus" size={26} color={color ? OnPastel.text : c.onPrimary} />
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

function useButtonColors(variant: NonNullable<ButtonProps['variant']>) {
  const c = useColors();
  const onPastel = usePastel();
  switch (variant) {
    case 'primary':
      return onPastel ? { bg: OnPastel.button, fg: OnPastel.onButton } : { bg: c.primary, fg: c.onPrimary };
    case 'white':
      return onPastel ? { bg: OnPastel.chip, fg: OnPastel.text } : { bg: c.surface, fg: c.text };
    case 'danger':
      return { bg: c.track, fg: c.danger };
    default:
      return { bg: c.track, fg: c.text };
  }
}

export function Button({ title, variant = 'primary', icon, loading, small, disabled, style, ...rest }: ButtonProps) {
  const { bg, fg } = useButtonColors(variant);
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
  const c = useColors();
  const s = useStyles(makeStyles);
  const onPastel = usePastel();
  return (
    <View style={{ gap: Spacing.two }}>
      {label && (
        <ThemedText type="smallBold" themeColor="textMuted">
          {label}
        </ThemedText>
      )}
      <TextInput
        placeholderTextColor={onPastel ? OnPastel.muted : c.textMuted}
        keyboardAppearance={onPastel ? 'light' : c.scheme}
        style={[
          s.input,
          onPastel && { backgroundColor: OnPastel.chip, color: OnPastel.text, borderColor: 'transparent' },
          rest.multiline && s.inputMultiline,
          style,
        ]}
        {...rest}
      />
    </View>
  );
}

// A plain card (theme surface with an outline), or a pastel card when `color` is given.
export function Card({
  children,
  onPress,
  onLongPress,
  color,
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const s = useStyles(makeStyles);
  const cardStyle = [styles.card, color ? { backgroundColor: color } : s.surfaceCard, style];
  const body =
    !onPress && !onLongPress ? (
      <View style={cardStyle}>{children}</View>
    ) : (
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        style={({ pressed }) => [cardStyle, pressed && { transform: [{ scale: 0.985 }] }]}>
        {children}
      </Pressable>
    );
  return color ? <PastelScope>{body}</PastelScope> : body;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; icon?: IconName }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const c = useColors();
  return (
    <View style={[styles.segmented, { backgroundColor: c.track }]}>
      {options.map((o) => {
        const selected = o.value === value;
        const fg = selected ? c.onPrimary : c.text;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            style={[styles.segment, selected && { backgroundColor: c.primary }]}>
            {o.icon && <Icon name={o.icon} size={14} color={fg} />}
            <ThemedText type="smallBold" style={{ color: fg }}>
              {o.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

// `tone` picks the background when not selected: "surface" (white in light, or on a pastel card)
// or "track" (the soft grey used for options on a plain card).
export function Chip({
  label,
  selected,
  onPress,
  tone = 'surface',
  icon,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  tone?: 'surface' | 'track';
  icon?: IconName;
}) {
  const c = useColors();
  const onPastel = usePastel();
  const bg = selected
    ? onPastel
      ? OnPastel.button
      : c.primary
    : onPastel
      ? OnPastel.chip
      : tone === 'track'
        ? c.track
        : c.surface;
  const fg = selected ? (onPastel ? OnPastel.onButton : c.onPrimary) : onPastel ? OnPastel.text : c.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityState={{ selected }}
      style={[styles.chip, { backgroundColor: bg }]}>
      {icon && <Icon name={icon} size={12} color={fg} />}
      <ThemedText type="smallBold" style={{ color: fg }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

export function Stars({ value, onChange, size = 30 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  const c = useColors();
  const filled = useTextColor();
  return (
    <View style={{ flexDirection: 'row', gap: Spacing.two }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={n}
          disabled={!onChange}
          onPress={() => onChange?.(n)}
          accessibilityLabel={`${n} star${n > 1 ? 's' : ''}`}
          hitSlop={4}>
          <Icon name="star" size={size} color={n <= value ? filled : c.line} />
        </Pressable>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------

export function Empty({
  title,
  body,
  action,
  color = Pastel.lavender,
}: {
  title: string;
  body: string;
  action?: ReactNode;
  color?: string;
}) {
  // Decoration dots in two pastels that differ from the card itself.
  const [big, small] = [Pastel.yellow, Pastel.salmon, Pastel.lavender, Pastel.mint].filter((p) => p !== color);
  return (
    <PastelView color={color} style={styles.empty}>
      <View style={styles.emptyDots}>
        <Bob distance={5} ms={3600}>
          <View style={[styles.dot, { backgroundColor: big, width: 56, height: 56 }]} />
        </Bob>
        <Bob distance={7} ms={2900} delay={400} style={{ marginLeft: -14 }}>
          <View style={[styles.dot, { backgroundColor: small, width: 32, height: 32 }]} />
        </Bob>
      </View>
      <ThemedText type="subtitle">{title}</ThemedText>
      <ThemedText themeColor="textSoft">{body}</ThemedText>
      {action && <View style={{ marginTop: Spacing.two, alignSelf: 'flex-start' }}>{action}</View>}
    </PastelView>
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
  const c = useColors();
  return (
    <View style={[styles.center, { padding: Spacing.five }]}>
      <ActivityIndicator color={c.text} />
    </View>
  );
}

const makeStyles = (c: Theme) =>
  StyleSheet.create({
    input: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.line,
      borderRadius: Radius.field,
      paddingHorizontal: Spacing.three + 2,
      paddingVertical: 15,
      fontSize: 16,
      fontFamily: Font.medium,
      color: c.text,
    },
    inputMultiline: { minHeight: 110, textAlignVertical: 'top', paddingTop: 15 },
    surfaceCard: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.line },
  });

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.75 },
  header: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.three },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  title: { fontSize: 34, lineHeight: 40, fontWeight: '700', letterSpacing: -0.9 },
  groupLine: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2, alignSelf: 'flex-start' },
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
  card: { borderRadius: Radius.tile, padding: Spacing.four - 4, gap: Spacing.one },
  segmented: { flexDirection: 'row', borderRadius: Radius.pill, padding: 4 },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: Radius.pill,
  },
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
