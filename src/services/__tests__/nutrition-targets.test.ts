/**
 * Targets math — Mifflin–St Jeor with a goal-dependent adjustment. Pure.
 */

import { bmiCategory, computeEnergy, computeTargets } from '../nutrition-targets';
import type { UserProfile } from '@/src/types/user-data';

/** A profile with everything the formula wants. */
const FULL_PROFILE: UserProfile = {
  primaryGoal: 'weight-loss',
  birthday: '1996-01-15', // ~30 years old at test time
  gender: 'male',
  height: 178,
  startingWeight: 92,
  activityLevel: 'moderate',
};

describe('computeTargets', () => {
  it('computes a plausible weight-loss target for a full profile', () => {
    const t = computeTargets(FULL_PROFILE);
    expect(t).not.toBeNull();
    // BMR ≈ 10*92 + 6.25*178 - 5*30 + 5 = 1887.5 → TDEE ≈ 2925 → -20% ≈ 2340
    expect(t!.calorieTarget).toBeGreaterThan(2200);
    expect(t!.calorieTarget).toBeLessThan(2500);
    // Protein ≈ 1.8 * 92 = 166
    expect(t!.macroTargets!.proteinG).toBe(166);
    // Everything rounded and positive.
    expect(t!.macroTargets!.fatsG).toBeGreaterThan(0);
    expect(t!.macroTargets!.carbsG).toBeGreaterThan(0);
  });

  it('prefers the passed current weight over starting weight', () => {
    const withCurrent = computeTargets(FULL_PROFILE, 80)!;
    const withStarting = computeTargets(FULL_PROFILE)!;
    expect(withCurrent.calorieTarget).toBeLessThan(withStarting.calorieTarget!);
    expect(withCurrent.macroTargets!.proteinG).toBe(144); // 1.8 * 80
  });

  it('returns null when weight or height is missing', () => {
    expect(computeTargets({ height: 178 })).toBeNull();
    expect(computeTargets({ startingWeight: 92 })).toBeNull();
    expect(computeTargets({})).toBeNull();
  });

  it('handles a missing gender with the neutral constant', () => {
    const neutral = computeTargets({ ...FULL_PROFILE, gender: undefined })!;
    const male = computeTargets(FULL_PROFILE)!;
    const female = computeTargets({ ...FULL_PROFILE, gender: 'female' })!;
    // Neutral sits between male and female.
    expect(neutral.calorieTarget!).toBeLessThan(male.calorieTarget!);
    expect(neutral.calorieTarget!).toBeGreaterThan(female.calorieTarget!);
  });

  it('defaults age and activity when absent instead of failing', () => {
    const t = computeTargets({
      height: 178,
      startingWeight: 92,
    });
    expect(t).not.toBeNull();
    expect(t!.calorieTarget).toBeGreaterThan(1300);
  });

  it('floors the target at the safe minimum', () => {
    // Small, light, older, sedentary profile → raw math dips below floor.
    const t = computeTargets({
      birthday: '1946-01-01',
      gender: 'female',
      height: 150,
      startingWeight: 45,
      activityLevel: 'sedentary',
    })!;
    expect(t.calorieTarget).toBe(1300);
  });

  it('macro calories roughly add back to the calorie target', () => {
    const t = computeTargets(FULL_PROFILE)!;
    const macroCalories =
      t.macroTargets!.proteinG! * 4 + t.macroTargets!.carbsG! * 4 + t.macroTargets!.fatsG! * 9;
    expect(Math.abs(macroCalories - t.calorieTarget!)).toBeLessThan(20);
  });
});

describe('computeTargets per goal', () => {
  const loss = computeTargets({ ...FULL_PROFILE, primaryGoal: 'weight-loss' })!;
  const muscle = computeTargets({ ...FULL_PROFILE, primaryGoal: 'build-muscle' })!;
  const general = computeTargets({ ...FULL_PROFILE, primaryGoal: 'general-fitness' })!;
  const tdee = computeEnergy(FULL_PROFILE)!.tdee;

  it('orders calories: deficit < maintenance < surplus', () => {
    expect(loss.calorieTarget!).toBeLessThan(general.calorieTarget!);
    expect(general.calorieTarget!).toBeLessThan(muscle.calorieTarget!);
  });

  it('general fitness eats at maintenance (≈ TDEE)', () => {
    expect(Math.abs(general.calorieTarget! - tdee)).toBeLessThanOrEqual(10); // rounding only
  });

  it('build muscle runs a ~10% surplus with 2.0 g/kg protein', () => {
    expect(muscle.calorieTarget!).toBeGreaterThan(tdee);
    expect(muscle.macroTargets!.proteinG).toBe(Math.round(92 * 2.0));
  });

  it('general fitness uses 1.6 g/kg protein', () => {
    expect(general.macroTargets!.proteinG).toBe(Math.round(92 * 1.6));
  });

  it('defaults to the weight-loss preset when no goal is set', () => {
    const t = computeTargets({ ...FULL_PROFILE, primaryGoal: undefined })!;
    expect(t.calorieTarget).toBe(loss.calorieTarget);
  });
});

describe('computeEnergy', () => {
  it('reports BMR, TDEE, multiplier, and BMI', () => {
    const e = computeEnergy(FULL_PROFILE)!;
    // BMR ≈ 10*92 + 6.25*178 - 5*30 + 5 = 1887.5 (age from birthday ≈ 30)
    expect(e.bmr).toBeGreaterThan(1850);
    expect(e.bmr).toBeLessThan(1930);
    expect(e.activityMultiplier).toBe(1.55);
    expect(e.tdee).toBe(Math.round(e.bmr * 1.55));
    // BMI = 92 / 1.78² ≈ 29.0
    expect(e.bmi).toBeCloseTo(29.0, 0);
  });

  it('returns null without weight or height', () => {
    expect(computeEnergy({ height: 178 })).toBeNull();
    expect(computeEnergy({ startingWeight: 92 })).toBeNull();
  });
});

describe('bmiCategory', () => {
  it('maps the WHO bands to neutral phrasing', () => {
    expect(bmiCategory(17)).toBe('below the typical range');
    expect(bmiCategory(22)).toBe('in the typical range');
    expect(bmiCategory(27)).toBe('above the typical range');
    expect(bmiCategory(33)).toBe('well above the typical range');
  });
});
