import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText, Button, Card } from '@/src/components/ui';
import { MEAL_SLOTS } from '@/src/services/food-log';
import type { ParsedFood } from '@/src/services/food-logging';
import { colors, fonts, fontSizes, radius, spacing } from '@/src/theme/theme';
import type { MealSlot } from '@/src/types/user-data';

type FoodConfirmListProps = {
  /** The foods as parsed/estimated — the user gets the last word. */
  foods: ParsedFood[];
  /** Default meal slot for items the parser didn't assign. */
  defaultMeal: MealSlot;
  /** Called with the reviewed foods when the user confirms. */
  onConfirm: (foods: ParsedFood[]) => void;
  confirmLabel?: string;
};

/** Editable working copy of one parsed food. */
type DraftFood = {
  name: string;
  calories: string;
  /** Servings — or grams eaten, when the item is a per-100g database row. */
  quantity: string;
  meal: MealSlot;
  base: ParsedFood;
};

/**
 * Database items without label serving data are per-100g; nobody thinks
 * in "1.5 servings of 100 g", so those rows ask for grams eaten instead
 * (stored as servings = grams / 100 — the schema stays unchanged).
 */
function isPer100g(food: ParsedFood): boolean {
  return food.item.servingDescription === '100 g';
}

/**
 * Review-before-log list used by the photo, barcode, and search flows.
 * AI and database estimates are drafts; the user can rename, fix
 * calories/servings, switch the meal, or drop an item entirely before
 * anything hits the log.
 */
export function FoodConfirmList({
  foods,
  defaultMeal,
  onConfirm,
  confirmLabel = 'Log it',
}: FoodConfirmListProps) {
  const [drafts, setDrafts] = useState<DraftFood[]>([]);

  useEffect(() => {
    setDrafts(
      foods.map((f) => ({
        name: f.item.name,
        calories: String(Math.round(f.item.caloriesPerServing)),
        quantity: isPer100g(f) ? String(Math.round(f.servings * 100)) : String(f.servings),
        meal: f.meal ?? defaultMeal,
        base: f,
      })),
    );
  }, [foods, defaultMeal]);

  function patch(index: number, part: Partial<DraftFood>) {
    setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, ...part } : d)));
  }

  function removeAt(index: number) {
    setDrafts((prev) => prev.filter((_, i) => i !== index));
  }

  function handleConfirm() {
    const reviewed: ParsedFood[] = [];
    for (const d of drafts) {
      const calories = Number(d.calories);
      const quantity = Number(d.quantity);
      if (!d.name.trim() || !Number.isFinite(calories) || calories <= 0) continue;
      const quantityValid = Number.isFinite(quantity) && quantity > 0;
      const servings = isPer100g(d.base)
        ? (quantityValid ? quantity : 100) / 100 // grams → multiples of 100 g
        : quantityValid
          ? quantity
          : 1;
      reviewed.push({
        item: {
          ...d.base.item,
          name: d.name.trim(),
          caloriesPerServing: calories,
        },
        servings,
        meal: d.meal,
      });
    }
    if (reviewed.length > 0) onConfirm(reviewed);
  }

  if (drafts.length === 0) return null;

  return (
    <View style={styles.container}>
      {drafts.map((draft, i) => (
        <Card key={`${draft.base.item.name}-${i}`} style={styles.card}>
          <View style={styles.nameRow}>
            <TextInput
              value={draft.name}
              onChangeText={(v) => patch(i, { name: v })}
              style={[styles.input, styles.nameInput]}
              testID={`confirm-name-${i}`}
            />
            <Pressable
              onPress={() => removeAt(i)}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${draft.name}`}
              style={styles.remove}
              testID={`confirm-remove-${i}`}
            >
              <Ionicons name="close" size={18} color={colors.muted} />
            </Pressable>
          </View>

          <View style={styles.numbersRow}>
            <View style={styles.numberField}>
              <AppText variant="caption" color={colors.muted}>
                {isPer100g(draft.base) ? 'kcal / 100 g' : 'kcal / serving'}
              </AppText>
              <TextInput
                value={draft.calories}
                onChangeText={(v) => patch(i, { calories: v })}
                style={styles.input}
                keyboardType="numeric"
                testID={`confirm-calories-${i}`}
              />
            </View>
            <View style={styles.numberField}>
              <AppText variant="caption" color={colors.muted}>
                {isPer100g(draft.base) ? 'grams eaten' : 'servings'}
              </AppText>
              <TextInput
                value={draft.quantity}
                onChangeText={(v) => patch(i, { quantity: v })}
                style={styles.input}
                keyboardType="numeric"
                testID={`confirm-quantity-${i}`}
              />
            </View>
          </View>
          {draft.base.item.servingDescription &&
            !isPer100g(draft.base) && (
              <AppText variant="caption" color={colors.muted}>
                1 serving = {draft.base.item.servingDescription}
              </AppText>
            )}

          <View style={styles.mealRow}>
            {MEAL_SLOTS.map((slot) => (
              <Pressable
                key={slot}
                onPress={() => patch(i, { meal: slot })}
                style={[styles.mealChip, draft.meal === slot && styles.mealChipActive]}
                testID={`confirm-meal-${slot}-${i}`}
              >
                <AppText
                  variant="caption"
                  color={draft.meal === slot ? colors.text : colors.muted}
                >
                  {slot}
                </AppText>
              </Pressable>
            ))}
          </View>
        </Card>
      ))}

      <Button label={confirmLabel} onPress={handleConfirm} testID="confirm-log" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  card: {
    gap: spacing.sm,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  nameInput: {
    flex: 1,
  },
  remove: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numbersRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  numberField: {
    flex: 1,
    gap: spacing.xs,
  },
  input: {
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: fontSizes.body,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  mealRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  mealChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  mealChipActive: {
    borderColor: colors.primary,
  },
});
