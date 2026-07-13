import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';

import { AppText } from '@/src/components/ui';
import { colors, fonts, fontSizes, radius, spacing } from '@/src/theme/theme';
import type { SetLog } from '@/src/types/user-data';
import type { InputMode } from './exercise-mode';

/** Values a row can hand back — only the fields its mode collects are set. */
export type LoggedSetValues = {
  weight?: number;
  reps?: number;
  durationSeconds?: number;
};

type SetLogRowProps = {
  setNumber: number;
  /** Chooses which inputs show: weight+reps / reps-only / seconds. */
  mode: InputMode;
  /** True once the set has been logged — inputs freeze, ✓ becomes solid. */
  logged: boolean;
  /** True when this row is the next one to log. Locks earlier / later rows. */
  active: boolean;
  /** Existing logged values, if any (used after logging). */
  logged_values?: SetLog;
  /** Called with the parsed values when the user taps ✓ to log. */
  onLog: (values: LoggedSetValues) => void;
  /** Un-logs / deletes this set — tapping a logged ✓, or swiping it away. */
  onRemove: () => void;
};

/** Parses a numeric text field to a positive number, or undefined. */
function toNumber(text: string): number | undefined {
  const trimmed = text.trim();
  if (trimmed === '') return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : undefined;
}

/** Reads the logged values back into a short summary line, per mode. */
function loggedSummary(mode: InputMode, values: SetLog | undefined): string {
  if (!values) return 'Logged';
  if (mode === 'timed') {
    return values.durationSeconds !== undefined ? `${values.durationSeconds}s` : 'Done';
  }
  if (mode === 'bodyweight') {
    return values.reps !== undefined ? `${values.reps} reps` : 'Done';
  }
  const weight = values.weight !== undefined ? `${values.weight} kg` : '—';
  const reps = values.reps !== undefined ? `${values.reps}` : '—';
  return `${weight} × ${reps}`;
}

/**
 * One row inside the workout runner. Inputs adapt to the exercise:
 * weight+reps for loaded lifts, reps only for bodyweight, seconds for
 * timed holds. Logged rows can be un-ticked (tap the ✓) or swiped away
 * (right-to-left). Nothing is mandatory — the user logs what they did.
 */
export function SetLogRow({
  setNumber,
  mode,
  logged,
  active,
  logged_values,
  onLog,
  onRemove,
}: SetLogRowProps) {
  const [weight, setWeight] = useState(
    logged_values?.weight !== undefined ? String(logged_values.weight) : '',
  );
  const [reps, setReps] = useState(
    logged_values?.reps !== undefined ? String(logged_values.reps) : '',
  );
  const [seconds, setSeconds] = useState(
    logged_values?.durationSeconds !== undefined
      ? String(logged_values.durationSeconds)
      : '',
  );

  const editable = !logged && active;

  function handleTick() {
    if (logged) {
      // Tapping a logged tick un-logs the set.
      onRemove();
      return;
    }
    if (!active) return;
    if (mode === 'timed') {
      onLog({ durationSeconds: toNumber(seconds) });
    } else if (mode === 'bodyweight') {
      onLog({ reps: toNumber(reps) });
    } else {
      onLog({ weight: toNumber(weight), reps: toNumber(reps) });
    }
  }

  /** The row body — shared between the plain and swipeable renderings. */
  const body = (
    <View style={[styles.row, !editable && !logged && styles.rowInactive]}>
      <AppText variant="caption" color={colors.muted} style={styles.setNumber}>
        Set {setNumber}
      </AppText>

      {logged ? (
        <AppText variant="body" style={styles.loggedSummary}>
          {loggedSummary(mode, logged_values)}
        </AppText>
      ) : (
        <SetInputs
          mode={mode}
          editable={editable}
          weight={weight}
          reps={reps}
          seconds={seconds}
          setWeight={setWeight}
          setReps={setReps}
          setSeconds={setSeconds}
          setNumber={setNumber}
        />
      )}

      <Pressable
        onPress={handleTick}
        disabled={!logged && !active}
        accessibilityRole="button"
        accessibilityLabel={logged ? `Undo set ${setNumber}` : `Log set ${setNumber}`}
        style={styles.logButton}
        testID={`set-${setNumber}-log`}
      >
        <Ionicons
          name={logged ? 'checkmark-circle' : 'checkmark'}
          size={22}
          color={logged ? colors.success : active ? colors.primary : colors.muted}
        />
      </Pressable>
    </View>
  );

  // Only logged rows are swipeable — there's nothing to delete otherwise.
  if (!logged) return body;

  return (
    <ReanimatedSwipeable
      renderRightActions={() => (
        <View style={styles.deleteAction}>
          <Ionicons name="trash-outline" size={20} color={colors.text} />
        </View>
      )}
      onSwipeableOpen={(direction) => {
        if (direction === 'right') onRemove();
      }}
      overshootRight={false}
      rightThreshold={40}
      testID={`set-${setNumber}-swipe`}
    >
      {body}
    </ReanimatedSwipeable>
  );
}

/** The editable inputs for an unlogged, active row — varies by mode. */
function SetInputs(props: {
  mode: InputMode;
  editable: boolean;
  weight: string;
  reps: string;
  seconds: string;
  setWeight: (v: string) => void;
  setReps: (v: string) => void;
  setSeconds: (v: string) => void;
  setNumber: number;
}) {
  const { mode, editable, weight, reps, seconds, setWeight, setReps, setSeconds, setNumber } =
    props;

  if (mode === 'timed') {
    return (
      <TextInput
        value={seconds}
        onChangeText={setSeconds}
        placeholder="seconds"
        placeholderTextColor={colors.muted}
        style={[styles.input, !editable && styles.inputDisabled]}
        keyboardType="numeric"
        editable={editable}
        testID={`set-${setNumber}-seconds`}
      />
    );
  }

  if (mode === 'bodyweight') {
    return (
      <>
        <View style={styles.bodyweightTag}>
          <AppText variant="caption" color={colors.muted}>
            Bodyweight
          </AppText>
        </View>
        <TextInput
          value={reps}
          onChangeText={setReps}
          placeholder="reps"
          placeholderTextColor={colors.muted}
          style={[styles.input, !editable && styles.inputDisabled]}
          keyboardType="numeric"
          editable={editable}
          testID={`set-${setNumber}-reps`}
        />
      </>
    );
  }

  return (
    <>
      <TextInput
        value={weight}
        onChangeText={setWeight}
        placeholder="kg"
        placeholderTextColor={colors.muted}
        style={[styles.input, !editable && styles.inputDisabled]}
        keyboardType="numeric"
        editable={editable}
        testID={`set-${setNumber}-weight`}
      />
      <TextInput
        value={reps}
        onChangeText={setReps}
        placeholder="reps"
        placeholderTextColor={colors.muted}
        style={[styles.input, !editable && styles.inputDisabled]}
        keyboardType="numeric"
        editable={editable}
        testID={`set-${setNumber}-reps`}
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.base,
  },
  rowInactive: {
    opacity: 0.5,
  },
  setNumber: {
    width: 52,
  },
  loggedSummary: {
    flex: 1,
    fontFamily: fonts.medium,
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
  bodyweightTag: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteAction: {
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    width: 64,
    borderRadius: radius.md,
    marginVertical: spacing.xs,
  },
});
