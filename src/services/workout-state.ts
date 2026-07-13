/**
 * Today's workout state, derived from the programme — the one truth the
 * Training Hub card and the Home training widget both render. Pure.
 */

import { todayLocalISODate } from '@/src/services/food-log';
import type { ProgrammeState, WorkoutPlan, WorkoutSession } from '@/src/types/user-data';

/** The faces a workout surface can show for today. */
export type WorkoutCardState =
  | { kind: 'no-plan' }
  | { kind: 'generating' }
  | { kind: 'ready'; plan: WorkoutPlan }
  | { kind: 'in-progress'; plan: WorkoutPlan; session: WorkoutSession }
  | { kind: 'rest-day'; plan: WorkoutPlan }
  | { kind: 'completed'; session: WorkoutSession };

/** Local YYYY-MM-DD from epoch ms. */
function isoDateFromEpoch(ms: number): string {
  const d = new Date(ms);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Derives today's state with the precedence the Hub always used:
 * completed > generating > in-progress > rest-day > ready > no-plan.
 * A completed session counts if it matches today's plan OR finished
 * today (the plan may already be cleared post-completion).
 */
export function deriveWorkoutState(
  programme: ProgrammeState,
  generating = false,
  today: string = todayLocalISODate(),
): WorkoutCardState {
  const plan = programme.currentPlan?.forDate === today ? programme.currentPlan : undefined;
  const session = programme.currentSession;

  const doneToday = programme.recentSessions?.find((s) => {
    if (s.status !== 'completed') return false;
    if (programme.currentPlan && s.planId === programme.currentPlan.id) return true;
    return s.completedAt !== undefined && isoDateFromEpoch(s.completedAt) === today;
  });

  if (doneToday) return { kind: 'completed', session: doneToday };
  if (generating) return { kind: 'generating' };
  if (plan && session && session.status === 'in-progress') {
    return { kind: 'in-progress', plan, session };
  }
  if (plan && plan.exercises.length === 0) return { kind: 'rest-day', plan };
  if (plan) return { kind: 'ready', plan };
  return { kind: 'no-plan' };
}
