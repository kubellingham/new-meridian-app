/**
 * exerciseInputMode picks how a set is logged from what the trainer
 * prescribed — so push-ups don't demand a kg value and planks log time.
 */

import { exerciseInputMode } from '../exercise-mode';
import type { ExerciseCategory } from '@/src/types/user-data';

function ex(
  targetReps: string,
  targetLoad: string | undefined,
  category: ExerciseCategory = 'strength',
) {
  return { targetReps, targetLoad, category };
}

describe('exerciseInputMode', () => {
  it('weighted when a real load is prescribed', () => {
    expect(exerciseInputMode(ex('8-10', '60 kg'))).toBe('weighted');
    expect(exerciseInputMode(ex('5', '100 kg', 'strength'))).toBe('weighted');
  });

  it('bodyweight when the load says so', () => {
    expect(exerciseInputMode(ex('12', 'Bodyweight'))).toBe('bodyweight');
    expect(exerciseInputMode(ex('15', 'body weight'))).toBe('bodyweight');
    expect(exerciseInputMode(ex('20', 'BW'))).toBe('bodyweight');
    expect(exerciseInputMode(ex('10', 'none'))).toBe('bodyweight');
  });

  it('bodyweight when no load and the category is unweighted', () => {
    expect(exerciseInputMode(ex('20', undefined, 'conditioning'))).toBe('bodyweight');
    expect(exerciseInputMode(ex('10', undefined, 'mobility'))).toBe('bodyweight');
    expect(exerciseInputMode(ex('8', undefined, 'warm-up'))).toBe('bodyweight');
  });

  it('weighted when no load but the category is strength (barbell assumed)', () => {
    expect(exerciseInputMode(ex('8', undefined, 'strength'))).toBe('weighted');
  });

  it('timed when the reps read as a duration', () => {
    expect(exerciseInputMode(ex('45s', 'Bodyweight'))).toBe('timed');
    expect(exerciseInputMode(ex('30 sec', undefined, 'mobility'))).toBe('timed');
    expect(exerciseInputMode(ex('1 min', 'Bodyweight'))).toBe('timed');
    expect(exerciseInputMode(ex('60 seconds', undefined, 'cool-down'))).toBe('timed');
  });

  it('timed takes priority over load — a weighted carry for time is timed', () => {
    expect(exerciseInputMode(ex('40s', '20 kg', 'conditioning'))).toBe('timed');
  });

  it('plain numeric reps are not mistaken for time', () => {
    expect(exerciseInputMode(ex('12', '40 kg'))).toBe('weighted');
    expect(exerciseInputMode(ex('8-10 each side', 'Bodyweight'))).toBe('bodyweight');
  });
});
