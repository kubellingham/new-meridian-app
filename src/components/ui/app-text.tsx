import { StyleSheet, Text, type TextProps } from 'react-native';

import { colors, fonts, fontSizes } from '@/src/theme/theme';

/**
 * Text variants used across the app.
 * - `hero`: Playfair Display, reserved for hero numbers / key data moments.
 * - everything else: DM Sans per the brief's typography rules.
 */
type Variant =
  | 'hero'
  | 'statValue'
  | 'speaker'
  | 'title'
  | 'subtitle'
  | 'body'
  | 'label'
  | 'overline'
  | 'caption';

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
    fontFamily: fonts.heroMedium,
    fontSize: fontSizes.hero,
    color: colors.text,
  },
  // Serif widget value — the 28px middle size from the design system.
  statValue: {
    fontFamily: fonts.heroMedium,
    fontSize: 28,
    color: colors.text,
  },
  // Speech-card speaker name — serif, tinted the character's hue by the
  // caller (see src/theme/character-hues.ts).
  speaker: {
    fontFamily: fonts.heroMedium,
    fontSize: fontSizes.body,
    color: colors.muted,
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
  // 12px uppercase card/widget overline with the design's tracking.
  overline: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.caption,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  caption: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.caption,
    color: colors.muted,
  },
});
