import { StyleSheet, Text, type TextProps } from 'react-native';

import { colors, fonts, fontSizes } from '@/src/theme/theme';

/**
 * Text variants used across the app.
 * - `hero`: Playfair Display, reserved for hero numbers / key data moments.
 * - everything else: DM Sans per the brief's typography rules.
 */
type Variant = 'hero' | 'title' | 'subtitle' | 'body' | 'label' | 'caption';

type AppTextProps = TextProps & {
  variant?: Variant;
  /** Overrides the variant's default colour (e.g. colors.primary). */
  color?: string;
};

/**
 * The single Text component for Meridian. Applies brand fonts and colours
 * so screens never touch raw font family strings.
 */
export function AppText({ variant = 'body', color, style, ...rest }: AppTextProps) {
  return (
    <Text
      style={[styles[variant], color ? { color } : undefined, style]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  hero: {
    fontFamily: fonts.hero,
    fontSize: fontSizes.hero,
    color: colors.text,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.title,
    color: colors.text,
  },
  subtitle: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.subtitle,
    color: colors.text,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.body,
    color: colors.text,
    lineHeight: 22,
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.label,
    color: colors.muted,
  },
  caption: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.caption,
    color: colors.muted,
  },
});
