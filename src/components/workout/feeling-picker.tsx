import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/src/components/ui';
import { colors, fonts, fontSizes, radius, spacing } from '@/src/theme/theme';
import type { WorkoutSession } from '@/src/types/user-data';

type Feeling = NonNullable<WorkoutSession['sessionFeeling']>;

const OPTIONS: readonly Feeling[] = ['strong', 'okay', 'flat', 'rough'];

type FeelingPickerProps = {
  value: Feeling | undefined;
  onChange: (value: Feeling) => void;
};

/**
 * Four-button post-session rating. Not a slider, not a five-point scale —
 * a small set of honest labels the user can pick fast.
 */
export function FeelingPicker({ value, onChange }: FeelingPickerProps) {
  return (
    <View style={styles.row}>
      {OPTIONS.map((option) => {
        const active = value === option;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            accessibilityRole="button"
            accessibilityLabel={`Felt ${option}`}
            style={[styles.button, active && styles.buttonActive]}
            testID={`feeling-${option}`}
          >
            <AppText style={[styles.label, active && styles.labelActive]}>{option}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  button: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  buttonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.panel,
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.label,
    color: colors.muted,
  },
  labelActive: {
    color: colors.text,
  },
});
