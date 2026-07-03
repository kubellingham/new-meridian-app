import { ActivityIndicator, Pressable, StyleSheet, type PressableProps } from 'react-native';

import { colors, fonts, fontSizes, radius, spacing } from '@/src/theme/theme';
import { AppText } from './app-text';

type ButtonProps = Omit<PressableProps, 'children'> & {
  label: string;
  /**
   * - `primary`: cyan fill — the one accent CTA on a screen.
   * - `secondary`: panel fill — supporting actions.
   * - `ghost`: borderless — tertiary / inline actions.
   */
  variant?: 'primary' | 'secondary' | 'ghost';
  /** Shows a spinner and disables presses while true. */
  loading?: boolean;
};

/**
 * Standard Meridian button. Primary buttons use the cyan accent; keep to
 * one primary button per screen (restrained-accent rule from the brief).
 */
export function Button({ label, variant = 'primary', loading, disabled, style, ...rest }: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        (pressed || isDisabled) && styles.dimmed,
        typeof style === 'function' ? undefined : style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.base : colors.text} />
      ) : (
        <AppText
          style={[styles.label, variant === 'primary' ? styles.labelOnPrimary : styles.labelOnDark]}
        >
          {label}
        </AppText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md - 2,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    minHeight: 48,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.panel,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  dimmed: {
    opacity: 0.6,
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.body,
  },
  labelOnPrimary: {
    // Dark text on the cyan fill for contrast.
    color: colors.base,
  },
  labelOnDark: {
    color: colors.text,
  },
});
