import { StyleSheet } from 'react-native';

import { AppText, Card, Screen } from '@/src/components/ui';
import { getCharacter } from '@/src/content/characters';
import { useUserStore } from '@/src/store/user-store';
import { colors, spacing } from '@/src/theme/theme';

/**
 * Training Hub — the trainer's territory (brief §9). The full hub (Today /
 * Plan / Library / Stats, trainer intake, workout logging, Coach Mode)
 * arrives in later sessions; this is a branded placeholder that names the
 * user's trainer so the space already feels owned.
 */
export default function TrainingScreen() {
  const trainerId = useUserStore((s) => s.trainerId);
  const trainer = trainerId ? getCharacter(trainerId) : null;

  return (
    <Screen>
      <AppText variant="title">Training Hub</AppText>

      <Card style={styles.card} tone="panel">
        {trainer ? (
          <>
            <AppText variant="label" color={colors.primary}>
              {trainer.name}
            </AppText>
            <AppText variant="body" style={styles.body}>
              “{trainer.philosophy}”
            </AppText>
            <AppText variant="caption">
              {trainer.name} runs your intake here in an upcoming session — experience,
              schedule, equipment — and then builds your first programme.
            </AppText>
          </>
        ) : (
          <>
            <AppText variant="subtitle">No trainer yet</AppText>
            <AppText variant="caption" style={styles.body}>
              Pick a trainer from Profile when you&apos;re ready. Cassidy, Tobias, and Marco
              each bring a different approach to weight loss.
            </AppText>
          </>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.lg,
  },
  body: {
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
});
