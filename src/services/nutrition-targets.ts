/**
 * Auto-computed calorie/macro targets — the day-one default the NS can
 * refine later. Mifflin–St Jeor BMR → activity multiplier → TDEE → a
 * 20% weight-loss deficit, floored at a safe minimum. Deliberately
 * simple and legible; anything fancier belongs to the NS in
 * conversation once target-setting tools exist.
 */

import type { NutritionState, UserProfile } from '@/src/types/user-data';

/** Computed targets, or null when the profile lacks weight or height. */
export type ComputedTargets = Pick<NutritionState, 'calorieTarget' | 'macroTargets'>;

/** Nothing below this — aggressive deficits are not Meridian's coaching. */
const MIN_CALORIE_TARGET = 1300;
/** Weight-loss deficit applied to TDEE. */
const DEFICIT = 0.2;
/** Protein per kg of bodyweight (weight-loss preset, muscle-sparing). */
const PROTEIN_G_PER_KG = 1.8;
/** Share of calories from fat. */
const FAT_CALORIE_SHARE = 0.27;

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
 * Computes weight-loss targets from the profile, or returns null when
 * weight or height is missing (the dashboard then prompts for the
 * About-you form instead of showing made-up numbers).
 *
 * @param profile the shared user profile
 * @param currentWeight most recent logged weight, preferred over starting
 */
export function computeTargets(
  profile: UserProfile,
  currentWeight?: number,
): ComputedTargets | null {
  const weight = currentWeight ?? profile.startingWeight;
  const height = profile.height;
  if (!weight || !height) return null;

  const age = ageFromBirthday(profile.birthday) ?? 30; // sensible default
  const bmr = 10 * weight + 6.25 * height - 5 * age + sexConstant(profile.gender);
  const multiplier = ACTIVITY_MULTIPLIERS[profile.activityLevel ?? 'light'];
  const tdee = bmr * multiplier;
  const calorieTarget = Math.max(
    MIN_CALORIE_TARGET,
    Math.round((tdee * (1 - DEFICIT)) / 10) * 10,
  );

  const proteinG = Math.round(weight * PROTEIN_G_PER_KG);
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
