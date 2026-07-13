import { StyleSheet, View } from 'react-native';

import { AppText } from '@/src/components/ui';
import { colors, spacing } from '@/src/theme/theme';
import type { PlannedExercise } from '@/src/types/user-data';

type ExercisePreviewListProps = {
  exercises: PlannedExercise[];
};

/**
 * Compact peek at what's coming — used on the Training Hub card so the
 * user can see the shape of the session before they tap Start. Never
 * scrolls (Hub is short); each item is one line.
 */
export function ExercisePreviewList({ exercises }: ExercisePreviewListProps) {
  if (exercises.length === 0) return null;
  return (
    <View style={styles.container}>
      {exercises.map((ex, i) => (
        <View key={ex.id} style={styles.row}>
          <AppText variant="caption" color={colors.muted} style={styles.index}>
            {i + 1}.
          </AppText>
          <AppText variant="body" style={styles.name}>
            {ex.name}
          </AppText>
          <AppText variant="caption" color={colors.muted}>
            {ex.targetSets} × {ex.targetReps}
          </AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingVertical: spacing.xs,
    gap: spacing.sm,
  },
  index: {
    width: 22,
  },
  name: {
    flex: 1,
  },
});
