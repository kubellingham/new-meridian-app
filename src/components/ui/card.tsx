import { StyleSheet, View, type ViewProps } from 'react-native';

import { colors, radius, spacing } from '@/src/theme/theme';

type CardProps = ViewProps & {
  /** `surface` (default) for standard cards, `panel` for elevated ones. */
  tone?: 'surface' | 'panel';
  /**
   * Top-edge accent color — the design system's character-hue hairline
   * (speech cards carry the speaker's hue). Never a full-card tint.
   */
  hairline?: string;
};

/**
 * Plain warm-ink card (The Practice design system) — hairline border,
 * no gradients, no blur.
 */
export function Card({ tone = 'surface', hairline, style, ...rest }: CardProps) {
  return (
    <View
      style={[
        styles.base,
        tone === 'panel' ? styles.panel : styles.surface,
        hairline ? { borderTopWidth: 1, borderTopColor: hairline } : undefined,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
  },
  surface: {
    backgroundColor: colors.surface,
  },
  panel: {
    backgroundColor: colors.panel,
  },
});
