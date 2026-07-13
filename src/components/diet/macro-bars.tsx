import { StyleSheet, View } from 'react-native';

import { AppText, Card } from '@/src/components/ui';
import type { DailyTotals } from '@/src/services/food-log';
import { colors, radius, spacing } from '@/src/theme/theme';
import type { NutritionState } from '@/src/types/user-data';

type MacroBarsProps = {
  totals: DailyTotals;
  targets: NutritionState['macroTargets'];
};

/**
 * Protein / carbs / fat progress against the macro targets. Hidden
 * entirely when no targets exist (the calorie prompt covers that case).
 */
export function MacroBars({ totals, targets }: MacroBarsProps) {
  if (!targets) return null;
  const rows: Array<{ label: string; eaten: number; target?: number }> = [
    { label: 'Protein', eaten: totals.proteinG, target: targets.proteinG },
    { label: 'Carbs', eaten: totals.carbsG, target: targets.carbsG },
    { label: 'Fat', eaten: totals.fatsG, target: targets.fatsG },
  ];

  return (
    <Card style={styles.card}>
      {rows.map(({ label, eaten, target }) => {
        const hasTarget = target !== undefined && target > 0;
        const pct = hasTarget ? Math.min(1, eaten / target) : 0;
        return (
          <View key={label} style={styles.row}>
            <View style={styles.labels}>
              <AppText variant="label">{label}</AppText>
              <AppText variant="caption" color={colors.muted}>
                {eaten}
                {hasTarget ? ` / ${target}` : ''} g
              </AppText>
            </View>
            {hasTarget && (
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${pct * 100}%` }]} />
              </View>
            )}
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  row: {
    gap: spacing.xs,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  track: {
    height: 4,
    backgroundColor: colors.panel,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.secondary,
  },
});
