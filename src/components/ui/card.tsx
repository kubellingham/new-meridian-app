import { StyleSheet, View, type ViewProps } from 'react-native';

import { colors, radius, spacing } from '@/src/theme/theme';

type CardProps = ViewProps & {
  /** `surface` (default) for standard cards, `panel` for elevated ones. */
  tone?: 'surface' | 'panel';
};

/**
 * Plain dark card. Functional design per the brief — subtle border,
 * no gradients, no blur.
 */
export function Card({ tone = 'surface', style, ...rest }: CardProps) {
  return (
    <View
      style={[styles.base, tone === 'panel' ? styles.panel : styles.surface, style]}
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
