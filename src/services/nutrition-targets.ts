/**
 * Auto-computed calorie/macro targets — the day-one default the NS can
 * refine later. Mifflin–St Jeor BMR → activity multiplier → TDEE → a
 * goal-dependent adjustment (deficit, surplus, or maintenance), floored
 * at a safe minimum. Deliberately simple and legible; anything fancier
 * belongs to the NS in conversation once target-setting tools exist.
 *
 * The intermediate numbers (BMR, TDEE, BMI) are exported via
 * `computeEnergy` so the Insights tab can show the math, not just the
 * answer.
 */

import type { NutritionState, PrimaryGoal, UserProfile } from '@/src/types/user-data';

/** Computed targets, or null when the profile lacks weight or height. */
export type ComputedTargets = Pick<NutritionState, 'calorieTarget' | 'macroTargets'>;

/** The energy math behind the targets — what Insights displays. */
export interface EnergyBreakdown {
  /** Age used in the formula (defaulted to 30 when birthday is missing). */
  age: number;
  /** Basal metabolic rate — kcal/day at complete rest (Mifflin–St Jeor). */
  bmr: number;
  /** Total daily energy expenditure — BMR × activity multiplier. */
  tdee: number;
  /** The activity multiplier that was applied. */
  activityMultiplier: number;
  /** Body mass index — kg / m². */
  bmi: number;
}

/** Nothing below this — aggressive deficits are not Meridian's coaching. */
const MIN_CALORIE_TARGET = 1300;
/** Share of calories from fat (all goals). */
const FAT_CALORIE_SHARE = 0.27;

/**
 * Per-goal energy adjustment and protein dose. Weight loss runs a 20%
 * deficit with muscle-sparing protein; building muscle runs a modest 10%
 * surplus with higher protein; general fitness eats at maintenance.
 */
const GOAL_PRESETS: Record<
  PrimaryGoal,
  { calorieFactor: number; proteinGPerKg: number }
> = {
  'weight-loss': { calorieFactor: 0.8, proteinGPerKg: 1.8 },
  'build-muscle': { calorieFactor: 1.1, proteinGPerKg: 2.0 },
  'general-fitness': { calorieFactor: 1.0, proteinGPerKg: 1.6 },
};

const ACTIVITY_MULTIPLIERS: Record<NonNullable<UserProfile['activityLevel']>, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
};

/** Whole years between an ISO birthday and now; null if unparseable. */
function ageFromBirthday(birthday: string | undefined): number | null {
  if (!birthday) return null;
  const parsed = new Date(birthday);
  if (Number.isNaN(parsed.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - parsed.getFullYear();
  const hadBirthdayThisYear =
    now.getMonth() > parsed.getMonth() ||
    (now.getMonth() === parsed.getMonth() && now.getDate() >= parsed.getDate());
  if (!hadBirthdayThisYear) age -= 1;
  return age > 0 && age < 120 ? age : null;
}

/** The Mifflin–St Jeor sex constant: +5 male, −161 female, −78 neutral. */
function sexConstant(gender: string | undefined): number {
  if (!gender) return -78;
  const g = gender.trim().toLowerCase();
  if (g.startsWith('m')) return 5;
  if (g.startsWith('f') || g.startsWith('w')) return -161;
  return -78;
}

/**
 * Computes the energy picture (age, BMR, TDEE, BMI) from the profile, or
 * null when weight or height is missing.
 *
 * @param profile the shared user profile
 * @param currentWeight most recent logged weight, preferred over starting
 */
export function computeEnergy(
  profile: UserProfile,
  currentWeight?: number,
): EnergyBreakdown | null {
  const weight = currentWeight ?? profile.startingWeight;
  const height = profile.height;
  if (!weight || !height) return null;

  const age = ageFromBirthday(profile.birthday) ?? 30; // sensible default
  const bmr = 10 * weight + 6.25 * height - 5 * age + sexConstant(profile.gender);
  const activityMultiplier = ACTIVITY_MULTIPLIERS[profile.activityLevel ?? 'light'];
  const tdee = bmr * activityMultiplier;
  const heightM = height / 100;
  const bmi = weight / (heightM * heightM);

  return {
    age,
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    activityMultiplier,
    bmi: Math.round(bmi * 10) / 10,
  };
}

/**
 * Computes goal-appropriate targets from the profile, or returns null
 * when weight or height is missing (the dashboard then prompts for a
 * weigh-in instead of showing made-up numbers). Defaults to the
 * weight-loss preset when no goal is set — the conservative choice.
 *
 * @param profile the shared user profile
 * @param currentWeight most recent logged weight, preferred over starting
 */
export function computeTargets(
  profile: UserProfile,
  currentWeight?: number,
): ComputedTargets | null {
  const energy = computeEnergy(profile, currentWeight);
  if (!energy) return null;
  const weight = currentWeight ?? profile.startingWeight!;

  const preset = GOAL_PRESETS[profile.primaryGoal ?? 'weight-loss'];
  const calorieTarget = Math.max(
    MIN_CALORIE_TARGET,
    Math.round((energy.tdee * preset.calorieFactor) / 10) * 10,
  );

  const proteinG = Math.round(weight * preset.proteinGPerKg);
  const fatsG = Math.round((calorieTarget * FAT_CALORIE_SHARE) / 9);
  const carbsG = Math.max(
    0,
    Math.round((calorieTarget - proteinG * 4 - fatsG * 9) / 4),
  );

  return {
    calorieTarget,
    macroTargets: { proteinG, carbsG, fatsG },
  };
}

/** Plain-language WHO BMI category, framed neutrally. */
export function bmiCategory(bmi: number): string {
  if (bmi < 18.5) return 'below the typical range';
  if (bmi < 25) return 'in the typical range';
  if (bmi < 30) return 'above the typical range';
  return 'well above the typical range';
}
