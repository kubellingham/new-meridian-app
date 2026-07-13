import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card } from '@/src/components/ui';
import { colors, spacing } from '@/src/theme/theme';
import type { WorkoutPlan, WorkoutSession } from '@/src/types/user-data';
import { ExercisePreviewList } from './exercise-preview-list';

type CardState =
  | { kind: 'no-plan' }
  | { kind: 'generating' }
  | { kind: 'ready'; plan: WorkoutPlan }
  | { kind: 'in-progress'; plan: WorkoutPlan; session: WorkoutSession }
  | { kind: 'rest-day'; plan: WorkoutPlan }
  | { kind: 'completed'; session: WorkoutSession };

type WorkoutStateCardProps = {
  state: CardState;
  trainerName: string;
  onGenerate: () => void;
  onStart: () => void;
  onResume: () => void;
};

/**
 * The one card at the top of Training Hub. Renders whichever face the
 * current state calls for — nothing else. Parent decides state; card
 * decides layout.
 */
export function WorkoutStateCard(props: WorkoutStateCardProps) {
  const { state, trainerName, onGenerate, onStart, onResume } = props;

  switch (state.kind) {
    case 'no-plan':
      return (
        <Card tone="panel" style={styles.card}>
          <AppText variant="label" color={colors.primary}>
            Today with {trainerName}
          </AppText>
          <AppText variant="subtitle" style={styles.title}>
            Ready to get today&apos;s session?
          </AppText>
          <AppText variant="caption" style={styles.body}>
            {trainerName} will pull one together based on where you&apos;re at right now.
          </AppText>
          <Button
            label="Get today's workout"
            onPress={onGenerate}
            testID="training-generate"
          />
        </Card>
      );

    case 'generating':
      return (
        <Card tone="panel" style={styles.card}>
          <AppText variant="label" color={colors.primary}>
            {trainerName}
          </AppText>
          <AppText variant="subtitle" style={styles.title}>
            Putting today&apos;s session together…
          </AppText>
          <AppText variant="caption" style={styles.body}>
            A few seconds. {trainerName} is choosing what fits.
          </AppText>
          <Button label="Working…" loading disabled onPress={() => undefined} />
        </Card>
      );

    case 'ready': {
      const { plan } = state;
      return (
        <Card tone="panel" style={styles.card}>
          <AppText variant="label" color={colors.primary}>
            Today · {plan.focusArea}
          </AppText>
          <AppText variant="subtitle" style={styles.title}>
            {plan.focusArea}
          </AppText>
          <AppText variant="body" style={styles.intent}>
            &ldquo;{plan.intent}&rdquo;
          </AppText>
          <AppText variant="caption" style={styles.meta}>
            {plan.exercises.length} exercise{plan.exercises.length === 1 ? '' : 's'} · ~
            {plan.estimatedMinutes} min
          </AppText>
          <ExercisePreviewList exercises={plan.exercises} />
          <Button
            label="Start session"
            onPress={onStart}
            style={styles.primaryAction}
            testID="training-start"
          />
        </Card>
      );
    }

    case 'in-progress': {
      const { plan, session } = state;
      const done = session.logs.filter((l) => l.status === 'completed').length;
      const total = plan.exercises.length;
      return (
        <Card tone="panel" style={styles.card}>
          <AppText variant="label" color={colors.primary}>
            In progress · {plan.focusArea}
          </AppText>
          <AppText variant="subtitle" style={styles.title}>
            Pick up where you left off
          </AppText>
          <AppText variant="caption" style={styles.body}>
            {done} of {total} exercise{total === 1 ? '' : 's'} done.
          </AppText>
          <Button
            label="Resume"
            onPress={onResume}
            style={styles.primaryAction}
            testID="training-resume"
          />
        </Card>
      );
    }

    case 'rest-day': {
      const { plan } = state;
      return (
        <Card tone="panel" style={styles.card}>
          <AppText variant="label" color={colors.primary}>
            Rest day
          </AppText>
          <AppText variant="body" style={styles.intent}>
            &ldquo;{plan.intent}&rdquo;
          </AppText>
          <AppText variant="caption" style={styles.body}>
            No session today.
          </AppText>
        </Card>
      );
    }

    case 'completed': {
      const { session } = state;
      const focus = session.logs[0]?.name ? guessFocus(session.logs[0].name) : 'session';
      const durationMinutes =
        session.completedAt && session.startedAt
          ? Math.max(1, Math.round((session.completedAt - session.startedAt) / 60000))
          : undefined;
      return (
        <Card tone="panel" style={styles.card}>
          <AppText variant="label" color={colors.success}>
            Done today
          </AppText>
          <AppText variant="subtitle" style={styles.title}>
            {focus}
            {durationMinutes ? ` · ${durationMinutes} min` : ''}
          </AppText>
          {session.sessionFeeling ? (
            <AppText variant="caption" style={styles.body}>
              Felt {session.sessionFeeling}.
            </AppText>
          ) : null}
          <View style={styles.smallRow}>
            <AppText variant="caption" color={colors.muted}>
              Come back tomorrow for the next one.
            </AppText>
          </View>
        </Card>
      );
    }
  }
}

function guessFocus(firstExerciseName: string): string {
  // Denormalized exercise name is our only signal without the plan around.
  return firstExerciseName;
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.md,
  },
  title: {
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  intent: {
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    fontStyle: 'italic',
  },
  meta: {
    marginBottom: spacing.sm,
  },
  body: {
    marginBottom: spacing.md,
  },
  smallRow: {
    marginTop: spacing.xs,
  },
  primaryAction: {
    marginTop: spacing.md,
  },
});
