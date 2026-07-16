import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Card, Screen } from '@/src/components/ui';
import { getCharacter } from '@/src/content/characters';
import { TRAINER_PACE } from '@/src/content/trainer-pace';
import { todayLocalISODate } from '@/src/services/food-log';
import {
  bmiCategory,
  computeEnergy,
  computeTargets,
} from '@/src/services/nutrition-targets';
import {
  computeWeightTrend,
  projectGoalDate,
  type GoalProjection,
  type WeightTrend,
} from '@/src/services/weight-trend';
import { useUserDataStore } from '@/src/store/user-data-store';
import { useUserStore } from '@/src/store/user-store';
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

/** Signed kg formatter — "−0.6 kg" / "+0.4 kg" / "0 kg". */
function fmtKg(delta: number): string {
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta} kg`;
}

/** The projection line, honest per case. */
function projectionCopy(projection: GoalProjection, goalKg?: number): string | null {
  switch (projection.kind) {
    case 'no-data':
    case 'no-goal':
      return null;
    case 'flat':
      return 'Your weight is holding steady right now, so there’s no honest date to project.';
    case 'wrong-direction':
      return 'The trend is pointing away from your goal at the moment — the projection waits until it turns.';
    case 'too-far':
      return 'At the current pace the goal is more than two years out — too far for an honest date.';
    case 'date': {
      const label = projection.date.toLocaleDateString('en-GB', {
        month: 'long',
        year: 'numeric',
      });
      return `At this rate you’d reach ${goalKg} kg around ${label} — about ${projection.weeks} weeks.`;
    }
  }
}

/**
 * The trainer's read on pace: their line, plus — only where the coach
 * honestly prescribes a numeric band (Cassidy, Noa) — the actual rate
 * against that band, converted to kg for this user. Neutral wording,
 * no verdicts.
 */
function paceComparison(
  trend: WeightTrend,
  minPct?: number,
  maxPct?: number,
): string | null {
  if (
    minPct === undefined ||
    maxPct === undefined ||
    trend.weeklyRateKg === undefined ||
    trend.latestKg === undefined ||
    trend.weeklyRateKg >= 0 // only meaningful while actually losing
  ) {
    return null;
  }
  const lossPerWeek = Math.abs(trend.weeklyRateKg);
  const minKg = Math.round(((minPct / 100) * trend.latestKg) * 100) / 100;
  const maxKg = Math.round(((maxPct / 100) * trend.latestKg) * 100) / 100;
  const band = `${minKg.toFixed(1)}–${maxKg.toFixed(1)} kg/week for you`;
  if (lossPerWeek < minKg) return `You’re losing slower than the band (${band}).`;
  if (lossPerWeek > maxKg) return `You’re losing faster than the band (${band}).`;
  return `You’re inside the band (${band}).`;
}

/**
 * Insights — weight first (the pivot's headline), then the numbers
 * behind the plan: BMR, TDEE, the daily target with its goal
 * adjustment, BMI, and macro targets, all computed from the profile via
 * the same math the Diet Corner uses (src/services/nutrition-targets.ts).
 */
export default function InsightsScreen() {
  const userProfile = useUserDataStore((s) => s.userProfile);
  const currentWeight = useUserDataStore((s) => s.dailySignals.currentWeight);
  const weightLog = useUserDataStore((s) => s.weightLog);
  const trainerId = useUserStore((s) => s.trainerId);

  const energy = computeEnergy(userProfile, currentWeight);
  const targets = computeTargets(userProfile, currentWeight);
  const goal = userProfile.primaryGoal ?? 'weight-loss';
  const weight = currentWeight ?? userProfile.startingWeight;

  const trend = computeWeightTrend(weightLog, todayLocalISODate());
  const projection = projectGoalDate(trend, userProfile.goalWeight);
  const trainer = trainerId ? getCharacter(trainerId) : null;
  const pace = trainerId ? TRAINER_PACE[trainerId] : undefined;
  const paceLine = paceComparison(trend, pace?.minPctPerWeek, pace?.maxPctPerWeek);
  const projLine = projectionCopy(projection, userProfile.goalWeight);

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
          Weight
        </AppText>

        {/* Weight — current vs starting, the pivot's headline number. */}
        <Card tone="panel" style={styles.card} testID="insights-weight">
          <AppText variant="label" color={colors.primary}>
            Where you are
          </AppText>
          <View style={styles.heroRow}>
            <AppText variant="hero" testID="insights-weight-value">
              {trend.latestKg ?? weight}
            </AppText>
            <AppText variant="label" style={styles.heroSuffix}>
              kg
            </AppText>
          </View>
          <AppText variant="caption">
            {trend.entryCount >= 2 && trend.totalChangeKg !== undefined
              ? `${fmtKg(trend.totalChangeKg)} since your first weigh-in (${trend.firstKg} kg).`
              : userProfile.goalWeight !== undefined
                ? `Heading for ${userProfile.goalWeight} kg. Each weigh-in builds the picture.`
                : 'Each weigh-in builds the picture.'}
          </AppText>
        </Card>

        {/* Trend — 7/30-day change and the weekly rate. */}
        <Card style={styles.card} testID="insights-weight-trend">
          <AppText variant="label">The trend</AppText>
          {trend.weeklyRateKg !== undefined ? (
            <>
              <View style={styles.macroRow}>
                <View style={styles.macroCell}>
                  <AppText variant="subtitle">
                    {trend.delta7 !== undefined ? fmtKg(trend.delta7) : '—'}
                  </AppText>
                  <AppText variant="caption">7 days</AppText>
                </View>
                <View style={styles.macroCell}>
                  <AppText variant="subtitle">
                    {trend.delta30 !== undefined ? fmtKg(trend.delta30) : '—'}
                  </AppText>
                  <AppText variant="caption">30 days</AppText>
                </View>
                <View style={styles.macroCell}>
                  <AppText variant="subtitle">{fmtKg(trend.weeklyRateKg)}</AppText>
                  <AppText variant="caption">per week</AppText>
                </View>
              </View>
              {projLine && <AppText variant="caption">{projLine}</AppText>}
            </>
          ) : (
            <AppText variant="caption" style={styles.cardBody}>
              Your weigh-ins build the trend — a few more days of logging and it appears
              here, with your weekly rate and an honest read on where it&apos;s heading.
            </AppText>
          )}
        </Card>

        {/* The trainer's read on pace — their words, their band if they have one. */}
        {trainer && pace && (
          <Card style={styles.card} testID="insights-trainer-pace">
            <AppText variant="label">{trainer.name} on pace</AppText>
            <AppText variant="body" style={styles.cardBody}>
              “{pace.line}”
            </AppText>
            {paceLine && (
              <AppText variant="caption" style={styles.cardBody}>
                {paceLine}
              </AppText>
            )}
          </Card>
        )}

        <AppText variant="label" style={styles.sectionBreak}>
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
  sectionBreak: {
    marginTop: spacing.xl,
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
