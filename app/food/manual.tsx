import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppText, Button, KEYBOARD_BEHAVIOR, Screen } from '@/src/components/ui';
import { makeFoodLogId, MEAL_SLOTS, todayLocalISODate } from '@/src/services/food-log';
import { useUserDataStore } from '@/src/store/user-data-store';
import { colors, fonts, fontSizes, radius, spacing } from '@/src/theme/theme';
import type { MealSlot } from '@/src/types/user-data';

/** Guards an arbitrary param into a MealSlot, defaulting sensibly. */
function asMealSlot(value: string | undefined): MealSlot {
  return (MEAL_SLOTS as readonly string[]).includes(value ?? '')
    ? (value as MealSlot)
    : 'snack';
}

/**
 * Manual food entry — the type-the-numbers path. Name and calories are
 * the only requirements; macros are welcome but optional, matching how
 * real people actually log.
 */
export default function ManualFoodScreen() {
  const { meal: mealParam } = useLocalSearchParams<{ meal?: string }>();
  const logFood = useUserDataStore((s) => s.logFood);

  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fats, setFats] = useState('');
  const [servings, setServings] = useState('1');
  const [meal, setMeal] = useState<MealSlot>(asMealSlot(mealParam));

  const caloriesNum = Number(calories);
  const canSave = name.trim().length > 0 && Number.isFinite(caloriesNum) && caloriesNum > 0;

  /** Parses an optional numeric field: empty → undefined. */
  function optional(text: string): number | undefined {
    const trimmed = text.trim();
    if (trimmed === '') return undefined;
    const n = Number(trimmed);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  }

  function handleSave() {
    if (!canSave) return;
    const servingsNum = Number(servings);
    logFood({
      id: makeFoodLogId(),
      loggedAt: Date.now(),
      forDate: todayLocalISODate(),
      meal,
      source: 'manual',
      servings: Number.isFinite(servingsNum) && servingsNum > 0 ? servingsNum : 1,
      item: {
        name: name.trim(),
        caloriesPerServing: caloriesNum,
        proteinG: optional(protein),
        carbsG: optional(carbs),
        fatsG: optional(fats),
      },
    });
    router.back();
  }

  return (
    <Screen>
      <KeyboardAvoidingView style={styles.flex} behavior={KEYBOARD_BEHAVIOR}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={styles.backButton}
              testID="manual-back"
            >
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </Pressable>
            <AppText variant="title">Add food</AppText>
          </View>

          <AppText variant="label" style={styles.fieldLabel}>
            What is it?
          </AppText>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Jollof rice with chicken"
            placeholderTextColor={colors.muted}
            style={styles.input}
            testID="manual-name"
          />

          <AppText variant="label" style={styles.fieldLabel}>
            Calories (per serving)
          </AppText>
          <TextInput
            value={calories}
            onChangeText={setCalories}
            placeholder="e.g. 550"
            placeholderTextColor={colors.muted}
            style={styles.input}
            keyboardType="numeric"
            testID="manual-calories"
          />

          <View style={styles.macroRow}>
            <View style={styles.macroField}>
              <AppText variant="label" style={styles.fieldLabel}>
                Protein g
              </AppText>
              <TextInput
                value={protein}
                onChangeText={setProtein}
                placeholder="—"
                placeholderTextColor={colors.muted}
                style={styles.input}
                keyboardType="numeric"
                testID="manual-protein"
              />
            </View>
            <View style={styles.macroField}>
              <AppText variant="label" style={styles.fieldLabel}>
                Carbs g
              </AppText>
              <TextInput
                value={carbs}
                onChangeText={setCarbs}
                placeholder="—"
                placeholderTextColor={colors.muted}
                style={styles.input}
                keyboardType="numeric"
                testID="manual-carbs"
              />
            </View>
            <View style={styles.macroField}>
              <AppText variant="label" style={styles.fieldLabel}>
                Fat g
              </AppText>
              <TextInput
                value={fats}
                onChangeText={setFats}
                placeholder="—"
                placeholderTextColor={colors.muted}
                style={styles.input}
                keyboardType="numeric"
                testID="manual-fats"
              />
            </View>
          </View>

          <AppText variant="label" style={styles.fieldLabel}>
            Servings
          </AppText>
          <TextInput
            value={servings}
            onChangeText={setServings}
            placeholder="1"
            placeholderTextColor={colors.muted}
            style={styles.input}
            keyboardType="numeric"
            testID="manual-servings"
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
                testID={`manual-meal-${slot}`}
              >
                <AppText variant="caption" color={meal === slot ? colors.text : colors.muted}>
                  {slot}
                </AppText>
              </Pressable>
            ))}
          </View>

          <Button
            label="Log it"
            onPress={handleSave}
            disabled={!canSave}
            style={styles.save}
            testID="manual-save"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  backButton: {
    padding: spacing.xs,
  },
  fieldLabel: {
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: fontSizes.body,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md - 4,
  },
  macroRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  macroField: {
    flex: 1,
  },
  mealRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  mealChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  mealChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.panel,
  },
  save: {
    marginTop: spacing.xl,
  },
});
