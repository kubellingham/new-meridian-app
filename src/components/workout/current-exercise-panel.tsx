import { StyleSheet, View } from 'react-native';

import { AppText, Card } from '@/src/components/ui';
import { colors, spacing } from '@/src/theme/theme';
import type { ExerciseLog, PlannedExercise } from '@/src/types/user-data';

type CurrentExercisePanelProps = {
  exercise: PlannedExercise;
  log: ExerciseLog;
  /** Ordinal in the plan — "Exercise 2 of 5". */
  ordinal: number;
  total: number;
};

/**
 * The header block inside the workout runner: what the user is doing
 * right now, how it fits in the session, and the trainer's cue for it.
 * Sits above the set-log rows.
 */
export function CurrentExercisePanel({
  exercise,
  log,
  ordinal,
  total,
}: CurrentExercisePanelProps) {
  const setsDone = log.sets.length;
  const setsTarget = exercise.targetSets;
  return (
    <Card tone="panel" style={styles.card}>
      <AppText variant="caption" color={colors.muted}>
        Exercise {ordinal} of {total}
      </AppText>
      <AppText variant="title" style={styles.name}>
        {exercise.name}
      </AppText>
      <View style={styles.metaRow}>
        <AppText variant="label" color={colors.primary}>
          {setsTarget} × {exercise.targetReps}
          {exercise.targetLoad ? ` · ${exercise.targetLoad}` : ''}
        </AppText>
        {setsDone > 0 && (
          <AppText variant="caption" color={colors.muted}>
            {setsDone} logged
          </AppText>
        )}
      </View>
      {exercise.cue ? (
        <AppText variant="body" style={styles.cue}>
          &ldquo;{exercise.cue}&rdquo;
        </AppText>
      ) : null}
      {exercise.note ? (
        <AppText variant="caption" color={colors.muted} style={styles.note}>
          {exercise.note}
        </AppText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
  },
  name: {
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  cue: {
    fontStyle: 'italic',
    marginBottom: spacing.xs,
  },
  note: {
    marginTop: spacing.xs,
  },
});
