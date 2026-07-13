import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/src/components/ui';
import { entryCalories } from '@/src/services/food-log';
import { colors, spacing } from '@/src/theme/theme';
import type { LoggedFood } from '@/src/types/user-data';

type FoodEntryRowProps = {
  entry: LoggedFood;
  /** Opens the edit affordance for this entry. */
  onPress: () => void;
};

/** One logged food inside a meal section — name, servings, calories. */
export function FoodEntryRow({ entry, onPress }: FoodEntryRowProps) {
  const servingsLabel =
    entry.servings !== 1
      ? `${entry.servings} × ${entry.item.servingDescription ?? 'serving'}`
      : (entry.item.servingDescription ?? '');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={styles.row}
      testID={`food-entry-${entry.id}`}
    >
      <View style={styles.text}>
        <AppText variant="body">{entry.item.name}</AppText>
        {(servingsLabel || entry.item.brand) && (
          <AppText variant="caption" color={colors.muted}>
            {[entry.item.brand, servingsLabel].filter(Boolean).join(' · ')}
          </AppText>
        )}
      </View>
      <AppText variant="label" color={colors.muted}>
        {Math.round(entryCalories(entry))} kcal
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  text: {
    flex: 1,
    gap: 2,
  },
});
