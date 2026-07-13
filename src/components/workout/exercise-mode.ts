import type { ExerciseCategory } from '@/src/types/user-data';

/**
 * How a set should be logged for a given exercise:
 * - weighted: a load (kg) and reps — barbell / dumbbell work.
 * - bodyweight: reps only — push-ups, marching, air squats.
 * - timed: a duration in seconds — planks, holds, timed carries.
 *
 * Derived from what the trainer prescribed so the logging inputs match
 * the movement instead of forcing "kg" onto a push-up.
 */
export type InputMode = 'weighted' | 'bodyweight' | 'timed';

/** True when the target reps read as a duration ("45s", "30 sec", "1 min"). */
function isTimedReps(targetReps: string): boolean {
  return /\d\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes)\b/i.test(
    targetReps.trim(),
  );
}

/** True when the prescribed load reads as bodyweight (or there's none). */
function isBodyweightLoad(
  targetLoad: string | undefined,
  category: ExerciseCategory,
): boolean {
  if (targetLoad && targetLoad.trim().length > 0) {
    return /body\s*-?\s*weight|\bbw\b|\bnone\b|n\/?a/i.test(targetLoad);
  }
  // No load given: these categories are unweighted by default.
  return (
    category === 'mobility' ||
    category === 'warm-up' ||
    category === 'cool-down' ||
    category === 'conditioning'
  );
}

/** Chooses the logging mode for an exercise from its prescription. */
export function exerciseInputMode(exercise: {
  targetReps: string;
  targetLoad?: string;
  category: ExerciseCategory;
}): InputMode {
  if (isTimedReps(exercise.targetReps)) return 'timed';
  if (isBodyweightLoad(exercise.targetLoad, exercise.category)) return 'bodyweight';
  return 'weighted';
}
