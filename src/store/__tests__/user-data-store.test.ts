/**
 * Workout lifecycle rules on useUserDataStore. Session state moves
 * plan → in-progress → completed/abandoned → recentSessions (capped).
 */

// AsyncStorage's native module isn't linked in jest-expo — mock it so
// zustand's persist middleware can construct without exploding.
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

import { useUserDataStore } from '../user-data-store';
import type { WorkoutPlan, WorkoutSession } from '@/src/types/user-data';

function makePlan(overrides: Partial<WorkoutPlan> = {}): WorkoutPlan {
  return {
    id: overrides.id ?? 'plan-1',
    createdAt: overrides.createdAt ?? 1,
    forDate: overrides.forDate ?? '2026-07-12',
    createdBy: overrides.createdBy ?? 'cassidy',
    focusArea: overrides.focusArea ?? 'Lower body',
    estimatedMinutes: overrides.estimatedMinutes ?? 40,
    intent: overrides.intent ?? 'Steady, no fireworks.',
    exercises: overrides.exercises ?? [
      {
        id: 'ex-1',
        name: 'Back squat',
        category: 'strength',
        targetSets: 3,
        targetReps: '8',
      },
      {
        id: 'ex-2',
        name: 'RDL',
        category: 'strength',
        targetSets: 3,
        targetReps: '10',
      },
    ],
  };
}

function makeSession(plan: WorkoutPlan): WorkoutSession {
  return {
    id: 'sess-1',
    planId: plan.id,
    startedAt: 100,
    status: 'in-progress',
    logs: plan.exercises.map((ex) => ({
      plannedExerciseId: ex.id,
      name: ex.name,
      status: 'pending',
      sets: [],
    })),
  };
}

/** Reset store between tests so no state leaks. */
beforeEach(() => {
  useUserDataStore.getState().reset();
});

describe('workout session lifecycle', () => {
  it('setCurrentPlan stores the plan without touching the session', () => {
    const plan = makePlan();
    useUserDataStore.getState().setCurrentPlan(plan);
    const state = useUserDataStore.getState();
    expect(state.programmeState.currentPlan?.id).toBe('plan-1');
    expect(state.programmeState.currentSession).toBeUndefined();
  });

  it('startSession seeds an in-progress session with pending exercise logs', () => {
    const plan = makePlan();
    useUserDataStore.getState().setCurrentPlan(plan);
    useUserDataStore.getState().startSession(makeSession(plan));
    const session = useUserDataStore.getState().programmeState.currentSession;
    expect(session?.status).toBe('in-progress');
    expect(session?.logs).toHaveLength(2);
    expect(session?.logs.every((l) => l.status === 'pending' && l.sets.length === 0)).toBe(
      true,
    );
  });

  it('logSet appends and marks the exercise in-progress', () => {
    const plan = makePlan();
    const store = useUserDataStore.getState();
    store.setCurrentPlan(plan);
    store.startSession(makeSession(plan));
    store.logSet('ex-1', { setNumber: 1, weight: 60, reps: 8 });
    const log = useUserDataStore
      .getState()
      .programmeState.currentSession?.logs.find((l) => l.plannedExerciseId === 'ex-1');
    expect(log?.sets).toEqual([{ setNumber: 1, weight: 60, reps: 8 }]);
    expect(log?.status).toBe('in-progress');
  });

  it('updateExerciseLog marks completed / skipped', () => {
    const plan = makePlan();
    const store = useUserDataStore.getState();
    store.setCurrentPlan(plan);
    store.startSession(makeSession(plan));
    store.updateExerciseLog('ex-2', { status: 'skipped' });
    const log = useUserDataStore
      .getState()
      .programmeState.currentSession?.logs.find((l) => l.plannedExerciseId === 'ex-2');
    expect(log?.status).toBe('skipped');
  });

  it('completeSession rolls into recentSessions, clears plan+session, flips daily flag', () => {
    const plan = makePlan();
    const store = useUserDataStore.getState();
    store.setCurrentPlan(plan);
    store.startSession(makeSession(plan));
    store.completeSession('okay', 'legs felt heavy');
    const s = useUserDataStore.getState();
    expect(s.programmeState.currentPlan).toBeUndefined();
    expect(s.programmeState.currentSession).toBeUndefined();
    expect(s.programmeState.recentSessions).toHaveLength(1);
    expect(s.programmeState.recentSessions?.[0].status).toBe('completed');
    expect(s.programmeState.recentSessions?.[0].sessionFeeling).toBe('okay');
    expect(s.programmeState.recentSessions?.[0].sessionNote).toBe('legs felt heavy');
    expect(s.dailySignals.workoutCompletedToday).toBe(true);
  });

  it('abandonSession marks abandoned + clears without flipping daily flag', () => {
    const plan = makePlan();
    const store = useUserDataStore.getState();
    store.setCurrentPlan(plan);
    store.startSession(makeSession(plan));
    store.abandonSession();
    const s = useUserDataStore.getState();
    expect(s.programmeState.currentPlan).toBeUndefined();
    expect(s.programmeState.currentSession).toBeUndefined();
    expect(s.programmeState.recentSessions?.[0].status).toBe('abandoned');
    expect(s.dailySignals.workoutCompletedToday).toBeUndefined();
  });

  it('recentSessions caps at 10 sessions, oldest drops out', () => {
    const store = useUserDataStore.getState();
    for (let i = 0; i < 12; i++) {
      const plan = makePlan({ id: `plan-${i}` });
      store.setCurrentPlan(plan);
      const session = { ...makeSession(plan), id: `sess-${i}` };
      store.startSession(session);
      store.completeSession('okay');
    }
    const recent = useUserDataStore.getState().programmeState.recentSessions ?? [];
    expect(recent).toHaveLength(10);
    // Newest first: sess-11 at index 0.
    expect(recent[0].id).toBe('sess-11');
    // Oldest two (sess-0, sess-1) dropped out.
    expect(recent.find((s) => s.id === 'sess-0')).toBeUndefined();
    expect(recent.find((s) => s.id === 'sess-1')).toBeUndefined();
  });

  it('removeSet deletes a set and renumbers the rest contiguously', () => {
    const plan = makePlan();
    const store = useUserDataStore.getState();
    store.setCurrentPlan(plan);
    store.startSession(makeSession(plan));
    store.logSet('ex-1', { setNumber: 1, weight: 50, reps: 8 });
    store.logSet('ex-1', { setNumber: 2, weight: 55, reps: 6 });
    store.logSet('ex-1', { setNumber: 3, weight: 60, reps: 4 });

    // Remove the middle set — remaining should renumber to 1,2.
    store.removeSet('ex-1', 2);
    const log = useUserDataStore
      .getState()
      .programmeState.currentSession?.logs.find((l) => l.plannedExerciseId === 'ex-1');
    expect(log?.sets.map((s) => s.setNumber)).toEqual([1, 2]);
    // The 55 kg set (originally #2) is gone; 50 and 60 remain.
    expect(log?.sets.map((s) => s.weight)).toEqual([50, 60]);
    expect(log?.status).toBe('in-progress');
  });

  it('removeSet drops the exercise back to pending when the last set goes', () => {
    const plan = makePlan();
    const store = useUserDataStore.getState();
    store.setCurrentPlan(plan);
    store.startSession(makeSession(plan));
    store.logSet('ex-1', { setNumber: 1, weight: 50, reps: 8 });
    store.updateExerciseLog('ex-1', { status: 'completed' });
    store.removeSet('ex-1', 1);
    const log = useUserDataStore
      .getState()
      .programmeState.currentSession?.logs.find((l) => l.plannedExerciseId === 'ex-1');
    expect(log?.sets).toEqual([]);
    expect(log?.status).toBe('pending');
  });

  it('removeSet is a no-op when no currentSession is active', () => {
    useUserDataStore.getState().removeSet('ex-1', 1);
    expect(useUserDataStore.getState().programmeState.currentSession).toBeUndefined();
  });

  it('logSet is a no-op when no currentSession is active', () => {
    // Deliberately no plan / session set.
    useUserDataStore.getState().logSet('ex-1', { setNumber: 1, weight: 60, reps: 8 });
    expect(useUserDataStore.getState().programmeState.currentSession).toBeUndefined();
  });

  it('completeSession is a no-op when no currentSession is active', () => {
    useUserDataStore.getState().completeSession('okay');
    const s = useUserDataStore.getState();
    expect(s.programmeState.recentSessions ?? []).toEqual([]);
    expect(s.dailySignals.workoutCompletedToday).toBeUndefined();
  });
});

describe('food log actions', () => {
  const food = (id: string, forDate = '2026-07-13') => ({
    id,
    loggedAt: Date.now(),
    forDate,
    meal: 'lunch' as const,
    source: 'manual' as const,
    servings: 1,
    item: { name: 'Jollof rice', caloriesPerServing: 400 },
  });

  it('logFood appends and bumps mealsLoggedToday for that date', () => {
    const store = useUserDataStore.getState();
    store.logFood(food('a'));
    store.logFood(food('b'));
    const s = useUserDataStore.getState();
    expect(s.foodLog.map((e) => e.id)).toEqual(['a', 'b']);
    expect(s.dailySignals.mealsLoggedToday).toBe(2);
  });

  it('updateFood patches one entry', () => {
    const store = useUserDataStore.getState();
    store.logFood(food('a'));
    store.updateFood('a', { servings: 2, meal: 'dinner' });
    const e = useUserDataStore.getState().foodLog.find((x) => x.id === 'a')!;
    expect(e.servings).toBe(2);
    expect(e.meal).toBe('dinner');
  });

  it('removeFood deletes and recounts the day', () => {
    const store = useUserDataStore.getState();
    store.logFood(food('a'));
    store.logFood(food('b'));
    store.removeFood('a');
    const s = useUserDataStore.getState();
    expect(s.foodLog.map((e) => e.id)).toEqual(['b']);
    expect(s.dailySignals.mealsLoggedToday).toBe(1);
  });

  it('reset clears the food log', () => {
    const store = useUserDataStore.getState();
    store.logFood(food('a'));
    store.reset();
    expect(useUserDataStore.getState().foodLog).toEqual([]);
  });
});
