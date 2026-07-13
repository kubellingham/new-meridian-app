/**
 * Targets math — Mifflin–St Jeor with a weight-loss deficit. Pure.
 */

import { computeTargets } from '../nutrition-targets';
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
