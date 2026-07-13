import { StyleSheet, View } from 'react-native';

import { AppText, Card } from '@/src/components/ui';
import { colors, radius, spacing } from '@/src/theme/theme';

type CalorieSummaryProps = {
  consumed: number;
  /** Undefined = no target set yet (bar hides, prompt shows elsewhere). */
  target?: number;
};

/**
 * The headline card on the Diet dashboard: calories eaten vs. target with
 * a horizontal progress bar. Over-target renders honestly in warning
 * color — informative, never scolding (the NS handles tone; the UI just
 * reports).
 */
export function CalorieSummary({ consumed, target }: CalorieSummaryProps) {
  const hasTarget = target !== undefined && target > 0;
  const remaining = hasTarget ? target - consumed : null;
  const pct = hasTarget ? Math.min(1, consumed / target) : 0;
  const over = remaining !== null && remaining < 0;

  return (
    <Card tone="panel" style={styles.card}>
      <View style={styles.headerRow}>
        <AppText variant="label" color={colors.primary}>
          Calories today
        </AppText>
        {hasTarget && (
          <AppText variant="caption" color={colors.muted}>
            target {target}
          </AppText>
        )}
      </View>

      <View style={styles.heroRow}>
        <AppText variant="hero" testID="calories-consumed">
          {consumed}
        </AppText>
        {remaining !== null && (
          <AppText
            variant="label"
            color={over ? colors.warning : colors.muted}
            style={styles.remainingLabel}
            testID="calories-remaining"
          >
            {over ? `${Math.abs(remaining)} over` : `${remaining} left`}
          </AppText>
        )}
      </View>

      {hasTarget && (
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              { width: `${pct * 100}%` },
              over && styles.fillOver,
            ]}
          />
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    marginVertical: spacing.xs,
  },
  remainingLabel: {
    marginBottom: 6,
  },
  track: {
    height: 6,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    overflow: 'hidden',
    marginTop: spacing.xs,
  },
  fill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  fillOver: {
    backgroundColor: colors.warning,
  },
});
