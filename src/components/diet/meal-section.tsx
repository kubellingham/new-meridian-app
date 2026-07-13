import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Card } from '@/src/components/ui';
import { dailyTotals } from '@/src/services/food-log';
import { colors, spacing } from '@/src/theme/theme';
import type { LoggedFood, MealSlot } from '@/src/types/user-data';
import { FoodEntryRow } from './food-entry-row';

const MEAL_LABELS: Record<MealSlot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
};

type MealSectionProps = {
  meal: MealSlot;
  entries: LoggedFood[];
  /** Opens the log-method sheet pre-targeted at this meal. */
  onAdd: () => void;
  /** Opens the edit affordance for one entry. */
  onEntryPress: (entry: LoggedFood) => void;
};

/**
 * One meal's block on the Diet dashboard — heading with the meal's
 * calorie subtotal, its entries, and a quiet add affordance.
 */
export function MealSection({ meal, entries, onAdd, onEntryPress }: MealSectionProps) {
  const subtotal = dailyTotals(entries).calories;

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <AppText variant="label">{MEAL_LABELS[meal]}</AppText>
        <View style={styles.headerRight}>
          {entries.length > 0 && (
            <AppText variant="caption" color={colors.muted}>
              {subtotal} kcal
            </AppText>
          )}
          <Pressable
            onPress={onAdd}
            accessibilityRole="button"
            accessibilityLabel={`Add to ${MEAL_LABELS[meal]}`}
            style={styles.addButton}
            testID={`meal-add-${meal}`}
          >
            <Ionicons name="add" size={20} color={colors.primary} />
          </Pressable>
        </View>
      </View>

      {entries.length === 0 ? (
        <AppText variant="caption" color={colors.muted}>
          Nothing yet.
        </AppText>
      ) : (
        entries.map((entry) => (
          <FoodEntryRow key={entry.id} entry={entry} onPress={() => onEntryPress(entry)} />
        ))
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  addButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
