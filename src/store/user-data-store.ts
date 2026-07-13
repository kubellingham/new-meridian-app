import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { CharacterId } from '@/src/content/characters';
import {
  EMPTY_SHARED_USER_DATA,
  type DailySignals,
  type ExerciseLog,
  type NutritionState,
  type PatternFlag,
  type ProgrammeState,
  type SessionFeedback,
  type SetLog,
  type SharedUserData,
  type TeamEvent,
  type UserProfile,
  type WorkoutPlan,
  type WorkoutSession,
} from '@/src/types/user-data';

/** Cap on how many past sessions we keep in memory (older ones drop out). */
const RECENT_SESSIONS_MAX = 10;

/**
 * The shared user database — Collaboration Model §2 in code form. Every
 * specialist reads from this store; different subsystems write to
 * different categories. Persisted to AsyncStorage so facts survive
 * restarts (they're the team's memory).
 *
 * Kept separate from `useUserStore` (name/nsId/trainerId, the setup gate)
 * for now — refactoring that is risky and not the point of this session.
 * Team context reads both stores and merges when it composes the block.
 */
interface UserDataState extends SharedUserData {
  /** True once AsyncStorage rehydration has finished. */
  hasHydrated: boolean;
  /** Shallow-merges into the existing user profile category. */
  updateUserProfile: (patch: Partial<UserProfile>) => void;
  updateProgrammeState: (patch: Partial<ProgrammeState>) => void;
  updateNutritionState: (patch: Partial<NutritionState>) => void;
  updateDailySignals: (patch: Partial<DailySignals>) => void;
  updateSessionFeedback: (patch: Partial<SessionFeedback>) => void;
  /** Adds a single flag to the array. */
  addPatternFlag: (flag: PatternFlag) => void;
  /**
   * Fires a domain-changing decision into the shared log (Collaboration
   * Model §3.2). Affected specialists pick it up via team-context on
   * their next turn, and it drops out of the pending view once every
   * character in `to` has acknowledged it.
   */
  emitEvent: (event: TeamEvent) => void;
  /**
   * Marks one event as processed by `characterId` — used after the
   * character has replied to the user, since their reply is the point
   * at which they had a chance to weave the event's context in.
   */
  markEventSeen: (eventId: string, characterId: CharacterId) => void;
  /**
   * Trainer-owned workout actions. All operate on programmeState.
   * setCurrentPlan replaces the day's plan; the session-lifecycle actions
   * mutate currentSession; complete/abandon roll it into recentSessions.
   */
  setCurrentPlan: (plan: WorkoutPlan) => void;
  startSession: (session: WorkoutSession) => void;
  /** Appends a set to the log for one exercise inside currentSession. */
  logSet: (plannedExerciseId: string, set: SetLog) => void;
  /** Shallow-merges into the ExerciseLog for one exercise. */
  updateExerciseLog: (plannedExerciseId: string, patch: Partial<ExerciseLog>) => void;
  /**
   * Marks currentSession completed, rolls it into recentSessions,
   * flips workoutCompletedToday, and clears currentPlan + currentSession.
   */
  completeSession: (feeling?: WorkoutSession['sessionFeeling'], note?: string) => void;
  /**
   * Marks currentSession abandoned, rolls it into recentSessions,
   * clears currentPlan + currentSession. Does not flip
   * workoutCompletedToday (an abandoned session is not a completion).
   */
  abandonSession: () => void;
  /** Wipes everything — dev/reset action. */
  reset: () => void;
  setHasHydrated: (value: boolean) => void;
}

export const useUserDataStore = create<UserDataState>()(
  persist(
    (set) => ({
      ...EMPTY_SHARED_USER_DATA,
      hasHydrated: false,
      updateUserProfile: (patch) =>
        set((state) => ({ userProfile: { ...state.userProfile, ...patch } })),
      updateProgrammeState: (patch) =>
        set((state) => ({ programmeState: { ...state.programmeState, ...patch } })),
      updateNutritionState: (patch) =>
        set((state) => ({ nutritionState: { ...state.nutritionState, ...patch } })),
      updateDailySignals: (patch) =>
        set((state) => ({ dailySignals: { ...state.dailySignals, ...patch } })),
      updateSessionFeedback: (patch) =>
        set((state) => ({ sessionFeedback: { ...state.sessionFeedback, ...patch } })),
      addPatternFlag: (flag) =>
        set((state) => ({ patternFlags: [...state.patternFlags, flag] })),
      emitEvent: (event) => set((state) => ({ events: [...state.events, event] })),
      markEventSeen: (eventId, characterId) =>
        set((state) => ({
          events: state.events.map((e) =>
            e.id === eventId && !e.seenBy.includes(characterId)
              ? { ...e, seenBy: [...e.seenBy, characterId] }
              : e,
          ),
        })),
      setCurrentPlan: (plan) =>
        set((state) => ({
          programmeState: { ...state.programmeState, currentPlan: plan },
        })),
      startSession: (session) =>
        set((state) => ({
          programmeState: { ...state.programmeState, currentSession: session },
        })),
      logSet: (plannedExerciseId, setLog) =>
        set((state) => {
          const current = state.programmeState.currentSession;
          if (!current) return state;
          const logs = current.logs.map((log) =>
            log.plannedExerciseId === plannedExerciseId
              ? { ...log, sets: [...log.sets, setLog], status: 'in-progress' as const }
              : log,
          );
          return {
            programmeState: {
              ...state.programmeState,
              currentSession: { ...current, logs },
            },
          };
        }),
      updateExerciseLog: (plannedExerciseId, patch) =>
        set((state) => {
          const current = state.programmeState.currentSession;
          if (!current) return state;
          const logs = current.logs.map((log) =>
            log.plannedExerciseId === plannedExerciseId ? { ...log, ...patch } : log,
          );
          return {
            programmeState: {
              ...state.programmeState,
              currentSession: { ...current, logs },
            },
          };
        }),
      completeSession: (feeling, note) =>
        set((state) => {
          const current = state.programmeState.currentSession;
          if (!current) return state;
          const completed: WorkoutSession = {
            ...current,
            status: 'completed',
            completedAt: Date.now(),
            sessionFeeling: feeling,
            sessionNote: note,
          };
          const recent = [completed, ...(state.programmeState.recentSessions ?? [])].slice(
            0,
            RECENT_SESSIONS_MAX,
          );
          return {
            programmeState: {
              ...state.programmeState,
              currentPlan: undefined,
              currentSession: undefined,
              recentSessions: recent,
            },
            dailySignals: { ...state.dailySignals, workoutCompletedToday: true },
          };
        }),
      abandonSession: () =>
        set((state) => {
          const current = state.programmeState.currentSession;
          if (!current) return state;
          const abandoned: WorkoutSession = {
            ...current,
            status: 'abandoned',
            abandonedAt: Date.now(),
          };
          const recent = [abandoned, ...(state.programmeState.recentSessions ?? [])].slice(
            0,
            RECENT_SESSIONS_MAX,
          );
          return {
            programmeState: {
              ...state.programmeState,
              currentPlan: undefined,
              currentSession: undefined,
              recentSessions: recent,
            },
          };
        }),
      reset: () => set({ ...EMPTY_SHARED_USER_DATA }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: 'meridian-user-data',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ hasHydrated, ...rest }) => rest,
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
