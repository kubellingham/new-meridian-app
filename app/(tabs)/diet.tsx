import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import {
  CalorieSummary,
  FoodEditModal,
  LogMethodSheet,
  MacroBars,
  MealSection,
  WaterCard,
  WeightCard,
  type LogMethod,
} from '@/src/components/diet';
import { AppText, Button, Card, Screen } from '@/src/components/ui';
import { getCharacter } from '@/src/content/characters';
import {
  dailyTotals,
  entriesForDate,
  groupByMeal,
  MEAL_SLOTS,
  todayLocalISODate,
} from '@/src/services/food-log';
import { computeTargets } from '@/src/services/nutrition-targets';
import { useUserDataStore } from '@/src/store/user-data-store';
import { useUserStore } from '@/src/store/user-store';
import { colors, spacing } from '@/src/theme/theme';
import type { LoggedFood, MealSlot } from '@/src/types/user-data';

/**
 * Diet Corner — the NS's territory, now a food-tracking dashboard
 * (MyFitnessPal/YAZIO pattern): calories and macros against the target,
 * today's meals, and five ways to log. The NS conversation lives on a
 * pushed screen (app/diet-chat.tsx), mirroring the Training Hub split.
 */
export default function DietScreen() {
  const nsId = useUserStore((s) => s.nsId);
  const foodLog = useUserDataStore((s) => s.foodLog);
  const nutritionState = useUserDataStore((s) => s.nutritionState);
  const userProfile = useUserDataStore((s) => s.userProfile);
  const currentWeight = useUserDataStore((s) => s.dailySignals.currentWeight);
  const waterMl = useUserDataStore((s) => s.dailySignals.waterMl);
  const hasHydrated = useUserDataStore((s) => s.hasHydrated);
  const updateNutritionState = useUserDataStore((s) => s.updateNutritionState);
  const updateDailySignals = useUserDataStore((s) => s.updateDailySignals);
  const addWater = useUserDataStore((s) => s.addWater);
  const updateFood = useUserDataStore((s) => s.updateFood);
  const removeFood = useUserDataStore((s) => s.removeFood);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMeal, setSheetMeal] = useState<MealSlot | null>(null);
  const [editing, setEditing] = useState<LoggedFood | null>(null);

  const ns = nsId ? getCharacter(nsId) : null;

  // Day-one targets: once hydrated, if no calorie target exists but the
  // About-you stats do, compute one so the dashboard means something
  // immediately. The NS refines it later; the user can update stats any
  // time on Profile.
  useEffect(() => {
    if (!hasHydrated || nutritionState.calorieTarget !== undefined) return;
    const computed = computeTargets(userProfile, currentWeight);
    if (computed) updateNutritionState(computed);
    // Run once post-hydration; inputs are read fresh at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasHydrated]);

  if (!ns || !nsId) {
    return (
      <Screen>
        <AppText variant="body">Meet your nutrition specialist in onboarding first.</AppText>
      </Screen>
    );
  }

  const today = todayLocalISODate();
  const todaysEntries = entriesForDate(foodLog ?? [], today);
  const totals = dailyTotals(todaysEntries);
  const byMeal = groupByMeal(todaysEntries);
  const hasTarget = nutritionState.calorieTarget !== undefined;

  /** Routes the picked method to its logging surface. */
  function handlePickMethod(method: LogMethod) {
    setSheetOpen(false);
    const meal = sheetMeal ?? undefined;
    const params = meal ? { meal } : undefined;
    switch (method) {
      case 'photo':
        router.push({ pathname: '/food/photo', params });
        break;
      case 'barcode':
        router.push({ pathname: '/food/scan', params });
        break;
      case 'database':
        router.push({ pathname: '/food/search', params });
        break;
      case 'manual':
        router.push({ pathname: '/food/manual', params });
        break;
      case 'chat':
        router.push('/diet-chat');
        break;
    }
  }

  /** Opens the method sheet, optionally pre-targeted at a meal slot. */
  function openSheet(meal: MealSlot | null) {
    setSheetMeal(meal);
    setSheetOpen(true);
  }

  /**
   * Logs a new weight and silently recomputes the auto targets around it —
   * the deficit tracks the body it's for. (A manually-tuned target would
   * also be replaced here; NS-owned target setting arrives later.)
   */
  function handleLogWeight(weightKg: number) {
    updateDailySignals({ currentWeight: weightKg });
    const computed = computeTargets(userProfile, weightKg);
    if (computed) updateNutritionState(computed);
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <AppText variant="title">Diet Corner</AppText>
        <AppText variant="label" style={styles.subheading}>
          with {ns.name}
        </AppText>

        <CalorieSummary consumed={totals.calories} target={nutritionState.calorieTarget} />

        {!hasTarget && (
          <Card style={styles.prompt}>
            <AppText variant="label" color={colors.warning}>
              No target yet
            </AppText>
            <AppText variant="caption" style={styles.promptBody}>
              Log your current weight below and Meridian sets a daily target to aim at.
            </AppText>
          </Card>
        )}

        <MacroBars totals={totals} targets={nutritionState.macroTargets} />

        <WaterCard
          waterMl={waterMl ?? 0}
          goalMl={nutritionState.hydrationBaselineMl ?? 2000}
          onAdd={addWater}
        />

        <WeightCard
          currentWeight={currentWeight}
          goalWeight={userProfile.goalWeight}
          onLog={handleLogWeight}
        />

        <Button label="Log food" onPress={() => openSheet(null)} testID="diet-log-food" />

        {MEAL_SLOTS.map((meal) => (
          <MealSection
            key={meal}
            meal={meal}
            entries={byMeal[meal]}
            onAdd={() => openSheet(meal)}
            onEntryPress={setEditing}
          />
        ))}

        <Button
          label={`Talk to ${ns.name}`}
          variant="secondary"
          onPress={() => router.push('/diet-chat')}
          style={styles.talkButton}
          testID="diet-talk"
        />
      </ScrollView>

      <LogMethodSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onPick={handlePickMethod}
      />
      <FoodEditModal
        entry={editing}
        onClose={() => setEditing(null)}
        onSave={updateFood}
        onDelete={removeFood}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  subheading: {
    marginTop: -spacing.sm,
  },
  prompt: {
    borderColor: colors.warning,
    gap: spacing.sm,
  },
  promptBody: {
    marginBottom: spacing.xs,
  },
  talkButton: {
    marginTop: spacing.xs,
  },
});
