import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Card, Screen } from '@/src/components/ui';
import {
  bmiCategory,
  computeEnergy,
  computeTargets,
} from '@/src/services/nutrition-targets';
import { useUserDataStore } from '@/src/store/user-data-store';
import { colors, spacing } from '@/src/theme/theme';
import type { PrimaryGoal } from '@/src/types/user-data';

/** How the daily target relates to TDEE, per goal — the explainer line. */
const TARGET_EXPLAINERS: Record<PrimaryGoal, string> = {
  'weight-loss':
    'Set 20% below your TDEE — a steady deficit your body can sustain, never below 1,300 kcal.',
  'build-muscle':
    'Set 10% above your TDEE — a modest surplus that feeds muscle without piling on the rest.',
  'general-fitness':
    'Set right at your TDEE — maintenance fuel for training, recovery, and everyday life.',
};

/** Protein logic per goal, in plain words. */
const PROTEIN_EXPLAINERS: Record<PrimaryGoal, string> = {
  'weight-loss': '1.8 g per kg of bodyweight — high enough to protect muscle while losing fat.',
  'build-muscle': '2.0 g per kg of bodyweight — the building material the surplus is for.',
  'general-fitness': '1.6 g per kg of bodyweight — solid support for training and recovery.',
};

/**
 * Insights — the numbers behind the plan, explained. BMR, TDEE, the
 * daily target with its goal adjustment, BMI, and macro targets, all
 * computed from the profile via the same math the Diet Corner uses
 * (src/services/nutrition-targets.ts). Charts and trends join this tab
 * in a later session once history accumulates.
 */
export default function InsightsScreen() {
  const userProfile = useUserDataStore((s) => s.userProfile);
  const currentWeight = useUserDataStore((s) => s.dailySignals.currentWeight);

  const energy = computeEnergy(userProfile, currentWeight);
  const targets = computeTargets(userProfile, currentWeight);
  const goal = userProfile.primaryGoal ?? 'weight-loss';
  const weight = currentWeight ?? userProfile.startingWeight;

  if (!energy || !targets) {
    return (
      <Screen>
        <AppText variant="title">Insights</AppText>
        <Card style={styles.card}>
          <AppText variant="subtitle">Your numbers start with a weigh-in</AppText>
          <AppText variant="caption" style={styles.cardBody}>
            Once your height and weight are in — from onboarding, or a quick weight log in
            the Diet tab — this space shows your BMR, TDEE, BMI, and how your daily target
            is built.
          </AppText>
        </Card>
      </Screen>
    );
  }

  const activityLabel = userProfile.activityLevel ?? 'light';

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <AppText variant="title">Insights</AppText>
        <AppText variant="label" style={styles.subheading}>
          Your numbers, and where they come from
        </AppText>

        {/* BMR */}
        <Card style={styles.card} testID="insights-bmr">
          <AppText variant="label">BMR — resting burn</AppText>
          <View style={styles.heroRow}>
            <AppText variant="hero" testID="insights-bmr-value">
              {energy.bmr.toLocaleString()}
            </AppText>
            <AppText variant="label" style={styles.heroSuffix}>
              kcal/day
            </AppText>
          </View>
          <AppText variant="caption">
            What your body burns at complete rest, from your weight, height, age, and sex
            (Mifflin–St Jeor). Breathing, thinking, staying warm — the baseline bill.
          </AppText>
        </Card>

        {/* TDEE */}
        <Card style={styles.card} testID="insights-tdee">
          <AppText variant="label">TDEE — daily burn</AppText>
          <View style={styles.heroRow}>
            <AppText variant="hero" testID="insights-tdee-value">
              {energy.tdee.toLocaleString()}
            </AppText>
            <AppText variant="label" style={styles.heroSuffix}>
              kcal/day
            </AppText>
          </View>
          <AppText variant="caption">
            BMR × {energy.activityMultiplier} for a {activityLabel} day-to-day. Roughly what
            you burn in a normal day, planned workouts aside.
          </AppText>
        </Card>

        {/* Daily target */}
        <Card tone="panel" style={styles.card} testID="insights-target">
          <AppText variant="label" color={colors.primary}>
            Your daily target
          </AppText>
          <View style={styles.heroRow}>
            <AppText variant="hero" testID="insights-target-value">
              {targets.calorieTarget?.toLocaleString()}
            </AppText>
            <AppText variant="label" style={styles.heroSuffix}>
              kcal/day
            </AppText>
          </View>
          <AppText variant="caption">{TARGET_EXPLAINERS[goal]}</AppText>
        </Card>

        {/* BMI */}
        <Card style={styles.card} testID="insights-bmi">
          <AppText variant="label">BMI</AppText>
          <View style={styles.heroRow}>
            <AppText variant="hero" testID="insights-bmi-value">
              {energy.bmi}
            </AppText>
            <AppText variant="label" style={styles.heroSuffix}>
              {bmiCategory(energy.bmi)}
            </AppText>
          </View>
          <AppText variant="caption">
            Weight against height squared — a blunt population measure, not a verdict. It
            reads high on muscular builds and misses body composition entirely; your team
            reads it alongside everything else, never alone.
          </AppText>
        </Card>

        {/* Macro targets */}
        <Card style={styles.card} testID="insights-macros">
          <AppText variant="label">Macro targets</AppText>
          <View style={styles.macroRow}>
            <View style={styles.macroCell}>
              <AppText variant="subtitle">{targets.macroTargets?.proteinG}g</AppText>
              <AppText variant="caption">protein</AppText>
            </View>
            <View style={styles.macroCell}>
              <AppText variant="subtitle">{targets.macroTargets?.carbsG}g</AppText>
              <AppText variant="caption">carbs</AppText>
            </View>
            <View style={styles.macroCell}>
              <AppText variant="subtitle">{targets.macroTargets?.fatsG}g</AppText>
              <AppText variant="caption">fats</AppText>
            </View>
          </View>
          <AppText variant="caption">
            Protein: {PROTEIN_EXPLAINERS[goal]} Fats hold about 27% of calories; carbs fill
            the rest as training fuel.
          </AppText>
        </Card>

        <AppText variant="caption" color={colors.muted} style={styles.footnote}>
          Computed from {weight} kg · {userProfile.height} cm · age {energy.age}. Log a new
          weight and every number follows. Trends and charts join this tab soon.
        </AppText>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xxl,
  },
  subheading: {
    marginTop: spacing.xs,
  },
  card: {
    marginTop: spacing.md,
  },
  cardBody: {
    marginTop: spacing.xs,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    marginVertical: spacing.xs,
  },
  heroSuffix: {
    marginBottom: 6,
  },
  macroRow: {
    flexDirection: 'row',
    marginVertical: spacing.sm,
  },
  macroCell: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  footnote: {
    marginTop: spacing.lg,
    textAlign: 'center',
  },
});
