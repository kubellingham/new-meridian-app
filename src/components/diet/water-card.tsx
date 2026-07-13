import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Card } from '@/src/components/ui';
import { colors, radius, spacing } from '@/src/theme/theme';

/** One tap of the + button. */
const GLASS_ML = 250;

type WaterCardProps = {
  /** Millilitres logged today. */
  waterMl: number;
  /** Daily goal in ml. */
  goalMl: number;
  /** Called with ±ml. */
  onAdd: (ml: number) => void;
};

/** Litres with one decimal, no trailing ".0". */
function litres(ml: number): string {
  const l = Math.round(ml / 100) / 10;
  return Number.isInteger(l) ? String(l) : l.toFixed(1);
}

/**
 * Water tracking — one glass per tap. Progress toward the hydration
 * goal, a minus to undo a mis-tap. Deliberately the lightest interaction
 * on the dashboard: hydration dies the moment it takes more than a tap.
 */
export function WaterCard({ waterMl, goalMl, onAdd }: WaterCardProps) {
  const pct = goalMl > 0 ? Math.min(1, waterMl / goalMl) : 0;
  return (
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <AppText variant="label">Water</AppText>
        <AppText variant="caption" color={colors.muted} testID="water-count">
          {litres(waterMl)} of {litres(goalMl)} L
        </AppText>
      </View>
      <View style={styles.row}>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${pct * 100}%` }]} />
        </View>
        <Pressable
          onPress={() => onAdd(-GLASS_ML)}
          accessibilityRole="button"
          accessibilityLabel="Remove a glass of water"
          style={styles.button}
          testID="water-minus"
        >
          <Ionicons name="remove" size={18} color={colors.muted} />
        </Pressable>
        <Pressable
          onPress={() => onAdd(GLASS_ML)}
          accessibilityRole="button"
          accessibilityLabel="Add a glass of water"
          style={[styles.button, styles.buttonPrimary]}
          testID="water-plus"
        >
          <Ionicons name="add" size={18} color={colors.base} />
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  track: {
    flex: 1,
    height: 4,
    backgroundColor: colors.panel,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.secondary,
  },
  button: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.panel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: {
    backgroundColor: colors.primary,
  },
});
