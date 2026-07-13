/**
 * deriveWorkoutState — the single truth behind the Hub card and Home's
 * training widget. Precedence and the today-matching rules.
 */

import { deriveWorkoutState } from '../workout-state';
import type { ProgrammeState, WorkoutPlan, WorkoutSession } from '@/src/types/user-data';

const TODAY = '2026-07-13';

function plan(overrides: Partial<WorkoutPlan> = {}): WorkoutPlan {
  return {
    id: 'p1',
    createdAt: 0,
    forDate: TODAY,
    createdBy: 'cassidy',
    focusArea: 'Lower body',
    estimatedMinutes: 40,
    intent: 'Build the base.',
    exercises: [
      {
        id: 'e1',
        name: 'Goblet squat',
        category: 'strength',
        targetSets: 3,
        targetReps: '8-10',
      },
    ],
    ...overrides,
  };
}

function session(overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: 's1',
    planId: 'p1',
    startedAt: new Date(2026, 6, 13, 8).getTime(),
    status: 'in-progress',
    logs: [],
    ...overrides,
  };
}

describe('deriveWorkoutState', () => {
  it('returns no-plan on an empty programme', () => {
    expect(deriveWorkoutState({}, false, TODAY).kind).toBe('no-plan');
  });

  it("treats yesterday's plan as no plan for today", () => {
    const programme: ProgrammeState = { currentPlan: plan({ forDate: '2026-07-12' }) };
    expect(deriveWorkoutState(programme, false, TODAY).kind).toBe('no-plan');
  });

  it('is ready when a plan for today has exercises', () => {
    const state = deriveWorkoutState({ currentPlan: plan() }, false, TODAY);
    expect(state.kind).toBe('ready');
  });

  it('is a rest day when the plan has no exercises', () => {
    const programme: ProgrammeState = { currentPlan: plan({ exercises: [] }) };
    expect(deriveWorkoutState(programme, false, TODAY).kind).toBe('rest-day');
  });

  it("is in-progress while a session runs against today's plan", () => {
    const programme: ProgrammeState = { currentPlan: plan(), currentSession: session() };
    expect(deriveWorkoutState(programme, false, TODAY).kind).toBe('in-progress');
  });

  it('generating wins over ready', () => {
    expect(deriveWorkoutState({ currentPlan: plan() }, true, TODAY).kind).toBe('generating');
  });

  it('completed wins over everything, matched by plan id', () => {
    const programme: ProgrammeState = {
      currentPlan: plan(),
      recentSessions: [session({ status: 'completed', completedAt: 1 })],
    };
    expect(deriveWorkoutState(programme, true, TODAY).kind).toBe('completed');
  });

  it('finds a completion by date when the plan was already cleared', () => {
    const programme: ProgrammeState = {
      recentSessions: [
        session({
          planId: 'gone',
          status: 'completed',
          completedAt: new Date(2026, 6, 13, 9).getTime(),
        }),
      ],
    };
    expect(deriveWorkoutState(programme, false, TODAY).kind).toBe('completed');
  });

  it("ignores completions from other days", () => {
    const programme: ProgrammeState = {
      recentSessions: [
        session({
          planId: 'gone',
          status: 'completed',
          completedAt: new Date(2026, 6, 11, 9).getTime(),
        }),
      ],
    };
    expect(deriveWorkoutState(programme, false, TODAY).kind).toBe('no-plan');
  });
});
