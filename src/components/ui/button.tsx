import { ActivityIndicator, Pressable, StyleSheet, type PressableProps } from 'react-native';

import { colors, fonts, fontSizes, radius, spacing } from '@/src/theme/theme';
import { AppText } from './app-text';

type ButtonProps = Omit<PressableProps, 'children'> & {
  label: string;
  /**
   * - `primary`: brass fill — the one accent CTA on a screen.
   * - `secondary`: outlined, transparent — supporting actions.
   * - `ghost`: borderless, muted — tertiary / inline actions.
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
        <ActivityIndicator color={variant === 'primary' ? colors.onPrimary : colors.text} />
      ) : (
        <AppText
          style={[
            styles.label,
            variant === 'primary'
              ? styles.labelOnPrimary
              : variant === 'ghost'
                ? styles.labelGhost
                : styles.labelOnDark,
          ]}
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
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.borderStrong,
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
    // Dark ink on the brass fill.
    color: colors.onPrimary,
  },
  labelOnDark: {
    color: colors.text,
  },
  labelGhost: {
    color: colors.muted,
  },
});
