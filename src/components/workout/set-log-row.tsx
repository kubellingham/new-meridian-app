import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/src/components/ui';
import { colors, fonts, fontSizes, radius, spacing } from '@/src/theme/theme';
import type { SetLog } from '@/src/types/user-data';

type SetLogRowProps = {
  setNumber: number;
  /** True once the set has been logged — inputs freeze, ✓ becomes solid. */
  logged: boolean;
  /** True when this row is the next one to log. Locks earlier / later rows. */
  active: boolean;
  /** Existing logged values, if any (used after logging). */
  logged_values?: SetLog;
  /** Called with the parsed values when the user taps ✓. */
  onLog: (values: { weight?: number; reps?: number }) => void;
};

/**
 * One row inside the workout runner — weight input, reps input, ✓ button.
 * Rows lock forward: the user logs set 1, which unlocks set 2, and so on.
 * Kept minimal on purpose — everything fancier (units toggle, plate math,
 * timer) is Phase B.
 */
export function SetLogRow({
  setNumber,
  logged,
  active,
  logged_values,
  onLog,
}: SetLogRowProps) {
  const [weight, setWeight] = useState(
    logged_values?.weight !== undefined ? String(logged_values.weight) : '',
  );
  const [reps, setReps] = useState(
    logged_values?.reps !== undefined ? String(logged_values.reps) : '',
  );

  const disabled = logged || !active;

  function handleLog() {
    if (disabled) return;
    const weightNum = weight.trim() === '' ? undefined : Number(weight);
    const repsNum = reps.trim() === '' ? undefined : Number(reps);
    onLog({
      weight: Number.isFinite(weightNum) ? weightNum : undefined,
      reps: Number.isFinite(repsNum) ? repsNum : undefined,
    });
  }

  return (
    <View style={[styles.row, disabled && !logged && styles.rowInactive]}>
      <AppText variant="caption" color={colors.muted} style={styles.setNumber}>
        Set {setNumber}
      </AppText>
      <TextInput
        value={weight}
        onChangeText={setWeight}
        placeholder="kg"
        placeholderTextColor={colors.muted}
        style={[styles.input, disabled && styles.inputDisabled]}
        keyboardType="numeric"
        editable={!disabled}
        testID={`set-${setNumber}-weight`}
      />
      <TextInput
        value={reps}
        onChangeText={setReps}
        placeholder="reps"
        placeholderTextColor={colors.muted}
        style={[styles.input, disabled && styles.inputDisabled]}
        keyboardType="numeric"
        editable={!disabled}
        testID={`set-${setNumber}-reps`}
      />
      <Pressable
        onPress={handleLog}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`Log set ${setNumber}`}
        style={[styles.logButton, logged && styles.logButtonDone]}
        testID={`set-${setNumber}-log`}
      >
        <Ionicons
          name={logged ? 'checkmark-circle' : 'checkmark'}
          size={22}
          color={logged ? colors.success : disabled ? colors.muted : colors.primary}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  rowInactive: {
    opacity: 0.5,
  },
  setNumber: {
    width: 52,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: fontSizes.body,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    textAlign: 'center',
  },
  inputDisabled: {
    opacity: 0.7,
  },
  logButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logButtonDone: {
    opacity: 1,
  },
});
