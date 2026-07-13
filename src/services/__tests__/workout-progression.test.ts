/**
 * The per-exercise progression digest the trainer reads at generation.
 * Pure function over recent sessions.
 */

import { buildProgressionDigest } from '../workout-progression';
import type { WorkoutSession } from '@/src/types/user-data';

function session(
  id: string,
  at: number,
  logs: WorkoutSession['logs'],
): WorkoutSession {
  return { id, planId: `p-${id}`, startedAt: at, completedAt: at + 1, status: 'completed', logs };
}

describe('buildProgressionDigest', () => {
  it('returns empty string with no sessions', () => {
    expect(buildProgressionDigest(undefined)).toBe('');
    expect(buildProgressionDigest([])).toBe('');
  });

  it('summarizes a single exercise with its logged sets', () => {
    const digest = buildProgressionDigest([
      session('s1', 100, [
        {
          plannedExerciseId: 'e1',
          name: 'Back squat',
          status: 'completed',
          sets: [
            { setNumber: 1, weight: 50, reps: 8 },
            { setNumber: 2, weight: 50, reps: 7 },
          ],
        },
      ]),
    ]);
    expect(digest).toContain('Back squat');
    expect(digest).toContain('50kg×8, 50kg×7');
  });

  it('shows the trajectory newest-first across sessions', () => {
    const digest = buildProgressionDigest([
      // Newest first (store order).
      session('s2', 200, [
        { plannedExerciseId: 'e1', name: 'Back squat', status: 'completed', sets: [{ setNumber: 1, weight: 55, reps: 8 }] },
      ]),
      session('s1', 100, [
        { plannedExerciseId: 'e1', name: 'Back squat', status: 'completed', sets: [{ setNumber: 1, weight: 50, reps: 8 }] },
      ]),
    ]);
    // "last" is the most recent (55), "before" is the older (50).
    expect(digest).toMatch(/Back squat: last 55kg×8; before: 50kg×8/);
  });

  it('formats bodyweight and timed sets naturally', () => {
    const digest = buildProgressionDigest([
      session('s1', 100, [
        { plannedExerciseId: 'e1', name: 'Push-ups', status: 'completed', sets: [{ setNumber: 1, reps: 12 }] },
        { plannedExerciseId: 'e2', name: 'Plank', status: 'completed', sets: [{ setNumber: 1, durationSeconds: 45 }] },
      ]),
    ]);
    expect(digest).toContain('Push-ups: last 12 reps');
    expect(digest).toContain('Plank: last 45s');
  });

  it('ignores exercises with no logged sets', () => {
    const digest = buildProgressionDigest([
      session('s1', 100, [
        { plannedExerciseId: 'e1', name: 'Skipped move', status: 'skipped', sets: [] },
        { plannedExerciseId: 'e2', name: 'Real move', status: 'completed', sets: [{ setNumber: 1, weight: 20, reps: 10 }] },
      ]),
    ]);
    expect(digest).not.toContain('Skipped move');
    expect(digest).toContain('Real move');
  });
});
