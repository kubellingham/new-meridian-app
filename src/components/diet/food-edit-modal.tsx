import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText, Button } from '@/src/components/ui';
import { MEAL_SLOTS } from '@/src/services/food-log';
import { colors, fonts, fontSizes, radius, spacing } from '@/src/theme/theme';
import type { LoggedFood, MealSlot } from '@/src/types/user-data';

type FoodEditModalProps = {
  /** The entry being edited; null hides the modal. */
  entry: LoggedFood | null;
  onClose: () => void;
  onSave: (id: string, patch: Partial<LoggedFood>) => void;
  onDelete: (id: string) => void;
};

/**
 * Edit one logged food: servings, meal slot, or remove it entirely.
 * Nutrition facts aren't editable here — fix those by deleting and
 * re-logging (keeps the item's identity trustworthy).
 */
export function FoodEditModal({ entry, onClose, onSave, onDelete }: FoodEditModalProps) {
  const [servings, setServings] = useState('1');
  const [meal, setMeal] = useState<MealSlot>('lunch');

  useEffect(() => {
    if (entry) {
      setServings(String(entry.servings));
      setMeal(entry.meal);
    }
  }, [entry]);

  if (!entry) return null;

  function handleSave() {
    if (!entry) return;
    const parsed = Number(servings);
    onSave(entry.id, {
      servings: Number.isFinite(parsed) && parsed > 0 ? parsed : entry.servings,
      meal,
    });
    onClose();
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.panel} onPress={() => undefined}>
          <AppText variant="subtitle">{entry.item.name}</AppText>
          <AppText variant="caption" color={colors.muted} style={styles.subtitle}>
            {Math.round(entry.item.caloriesPerServing)} kcal per{' '}
            {entry.item.servingDescription ?? 'serving'}
          </AppText>

          <AppText variant="label" style={styles.fieldLabel}>
            Servings
          </AppText>
          <TextInput
            value={servings}
            onChangeText={setServings}
            keyboardType="numeric"
            style={styles.input}
            testID="food-edit-servings"
          />

          <AppText variant="label" style={styles.fieldLabel}>
            Meal
          </AppText>
          <View style={styles.mealRow}>
            {MEAL_SLOTS.map((slot) => (
              <Pressable
                key={slot}
                onPress={() => setMeal(slot)}
                style={[styles.mealChip, meal === slot && styles.mealChipActive]}
                testID={`food-edit-meal-${slot}`}
              >
                <AppText
                  variant="caption"
                  color={meal === slot ? colors.text : colors.muted}
                >
                  {slot}
                </AppText>
              </Pressable>
            ))}
          </View>

          <Button label="Save" onPress={handleSave} style={styles.save} testID="food-edit-save" />
          <Button
            label="Remove entry"
            variant="ghost"
            onPress={() => {
              onDelete(entry.id);
              onClose();
            }}
            testID="food-edit-delete"
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  subtitle: {
    marginTop: spacing.xs,
  },
  fieldLabel: {
    marginTop: spacing.md,
    marginBottom: spacing.xs,
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
  save: {
    marginTop: spacing.lg,
  },
});
