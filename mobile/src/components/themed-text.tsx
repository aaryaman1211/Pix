import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { Font, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'subtitle' | 'small' | 'smallBold' | 'label' | 'link';
  themeColor?: ThemeColor;
};

// Custom fonts ship one file per weight, so map fontWeight onto the matching DM Sans family.
function familyFor(weight: TextStyle['fontWeight']): string {
  switch (String(weight ?? '500')) {
    case '100':
    case '200':
    case '300':
    case '400':
    case 'normal':
      return Font.regular;
    case '600':
      return Font.semibold;
    case '700':
    case 'bold':
      return Font.bold;
    case '800':
    case '900':
      return Font.heavy;
    default:
      return Font.medium;
  }
}

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  const { fontWeight, ...flat } = StyleSheet.flatten([styles[type], style]) ?? {};
  return (
    <Text
      style={[{ color: theme[themeColor ?? 'text'] }, flat, { fontFamily: familyFor(fontWeight) }]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: { fontSize: 16, lineHeight: 22, fontWeight: '500' },
  small: { fontSize: 14, lineHeight: 19, fontWeight: '500' },
  smallBold: { fontSize: 14, lineHeight: 19, fontWeight: '700' },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  title: { fontSize: 34, lineHeight: 40, fontWeight: '700', letterSpacing: -0.8 },
  subtitle: { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: -0.4 },
  link: { fontSize: 14, lineHeight: 19, fontWeight: '700', textDecorationLine: 'underline' },
});
