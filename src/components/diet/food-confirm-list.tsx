import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText, Button, Card, Select } from '@/src/components/ui';
import { MEAL_SLOTS } from '@/src/services/food-log';
import type { ParsedFood } from '@/src/services/food-logging';
import {
  caloriesLabel,
  defaultMode,
  defaultValue,
  quantityModes,
  toServings,
  type QuantityMode,
} from '@/src/services/food-quantity';
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
  /** How the amount below is expressed — servings, g/ml, whole pack. */
  mode: QuantityMode;
  quantity: string;
  meal: MealSlot;
  base: ParsedFood;
};

/**
 * Review-before-log list used by the photo, barcode, and search flows.
 * AI and database estimates are drafts; the user can rename, fix
 * calories, set the amount in whatever measure the item's data honestly
 * supports (label servings, g/ml, the whole package), switch the meal,
 * or drop an item entirely before anything hits the log.
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
      foods.map((f) => {
        const mode = defaultMode(f.item);
        return {
          name: f.item.name,
          calories: String(Math.round(f.item.caloriesPerServing)),
          mode,
          quantity: String(defaultValue(mode, f.servings, f.item)),
          meal: f.meal ?? defaultMeal,
          base: f,
        };
      }),
    );
  }, [foods, defaultMeal]);

  function patch(index: number, part: Partial<DraftFood>) {
    setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, ...part } : d)));
  }

  /** Mode switch — carries the current amount over into the new measure. */
  function switchMode(index: number, mode: QuantityMode) {
    setDrafts((prev) =>
      prev.map((d, i) => {
        if (i !== index || d.mode === mode) return d;
        const servings = toServings(d.mode, Number(d.quantity), d.base.item) ?? d.base.servings;
        return { ...d, mode, quantity: String(defaultValue(mode, servings, d.base.item)) };
      }),
    );
  }

  function removeAt(index: number) {
    setDrafts((prev) => prev.filter((_, i) => i !== index));
  }

  function handleConfirm() {
    const reviewed: ParsedFood[] = [];
    for (const d of drafts) {
      const calories = Number(d.calories);
      if (!d.name.trim() || !Number.isFinite(calories) || calories <= 0) continue;
      const servings = toServings(d.mode, Number(d.quantity), d.base.item) ?? d.base.servings;
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
      {drafts.map((draft, i) => {
        const options = quantityModes(draft.base.item);
        const option = options.find((o) => o.mode === draft.mode) ?? options[0];
        return (
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
                  {caloriesLabel(draft.base.item)}
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
                  {option.fieldLabel}
                </AppText>
                {option.needsValue ? (
                  <TextInput
                    value={draft.quantity}
                    onChangeText={(v) => patch(i, { quantity: v })}
                    style={styles.input}
                    keyboardType="numeric"
                    testID={`confirm-quantity-${i}`}
                  />
                ) : (
                  <View style={[styles.input, styles.fixedAmount]}>
                    <AppText variant="body" testID={`confirm-fixed-${i}`}>
                      {draft.base.item.packageQuantity}
                    </AppText>
                  </View>
                )}
              </View>
            </View>

            {options.length > 1 ? (
              <Select
                options={options.map((o) => ({ value: o.mode, label: o.label }))}
                value={draft.mode}
                onChange={(mode) => switchMode(i, mode)}
                label="Measure"
                testID={`confirm-mode-${i}`}
              />
            ) : (
              draft.base.item.servingDescription &&
              draft.mode === 'servings' && (
                <AppText variant="caption" color={colors.muted}>
                  1 serving = {draft.base.item.servingDescription}
                </AppText>
              )
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
        );
      })}

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
  fixedAmount: {
    justifyContent: 'center',
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
