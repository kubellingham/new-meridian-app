import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { CharacterId } from '@/src/content/characters';
import { todayLocalISODate } from '@/src/services/food-log';
import {
  EMPTY_SHARED_USER_DATA,
  type DailySignals,
  type ExerciseLog,
  type FoodItem,
  type LoggedFood,
  type NutritionState,
  type PatternFlag,
  type ProgrammeState,
  type SessionFeedback,
  type SetLog,
  type SharedUserData,
  type TeamEvent,
  type UserProfile,
  type WeightEntry,
  type WorkoutPlan,
  type WorkoutSession,
} from '@/src/types/user-data';

/** Cap on how many past sessions we keep in memory (older ones drop out). */
const RECENT_SESSIONS_MAX = 10;

/** Rolling food-log window — whichever cap hits first, oldest entries go. */
const FOOD_LOG_MAX_ENTRIES = 300;
const FOOD_LOG_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // ~30 days

/** Weigh-in history cap — one entry per day, so ~13 months of daily logs. */
const WEIGHT_LOG_MAX = 400;

/** Remembered product-fix cap — oldest saves fall out first. */
const FOOD_CORRECTIONS_MAX = 200;

/** How many entries count toward the given local date. */
function countForDate(log: LoggedFood[], forDate: string): number {
  return log.filter((e) => e.forDate === forDate).length;
}

/** Drops entries beyond the rolling window, keeping newest-last order. */
function pruneFoodLog(log: LoggedFood[]): LoggedFood[] {
  const cutoff = Date.now() - FOOD_LOG_MAX_AGE_MS;
  const recent = log.filter((e) => e.loggedAt >= cutoff);
  return recent.length > FOOD_LOG_MAX_ENTRIES
    ? recent.slice(recent.length - FOOD_LOG_MAX_ENTRIES)
    : recent;
}

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
  /** Marks a user-facing event (e.g. a morning brief) as opened by the user. */
  markEventDelivered: (eventId: string) => void;
  /**
   * Trainer-owned workout actions. All operate on programmeState.
   * setCurrentPlan replaces the day's plan; the session-lifecycle actions
   * mutate currentSession; complete/abandon roll it into recentSessions.
   */
  setCurrentPlan: (plan: WorkoutPlan) => void;
  startSession: (session: WorkoutSession) => void;
  /** Appends a set to the log for one exercise inside currentSession. */
  logSet: (plannedExerciseId: string, set: SetLog) => void;
  /**
   * Removes one logged set (by its setNumber) and renumbers the rest so
   * they stay contiguous. Drops the exercise back to pending when the
   * last set is removed. Powers both swipe-to-delete and un-ticking.
   */
  removeSet: (plannedExerciseId: string, setNumber: number) => void;
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
  /**
   * NS-owned food-log actions. Append an eaten entry (log is pruned to a
   * rolling window), edit one (servings/meal/note fixes), or remove one.
   * Also bumps dailySignals.mealsLoggedToday so the ambient counter the
   * consultants already read stays truthful.
   */
  logFood: (entry: LoggedFood) => void;
  updateFood: (id: string, patch: Partial<LoggedFood>) => void;
  removeFood: (id: string) => void;
  /**
   * Remembers the user's fix to a scanned product (keyed by its
   * barcode) so future scans surface their values instead of the
   * database's. No-op for items without a barcode.
   */
  saveFoodCorrection: (item: FoodItem) => void;
  /** Adjusts today's water by ±ml, clamped at zero. */
  addWater: (ml: number) => void;
  /**
   * Records a weigh-in: appends to weightLog (a repeat log on the same
   * local day replaces that day's entry) and keeps
   * dailySignals.currentWeight in sync so every existing reader stays
   * truthful. Rounded to 0.1 kg, log capped at WEIGHT_LOG_MAX.
   */
  logWeight: (kg: number) => void;
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
      markEventDelivered: (eventId) =>
        set((state) => ({
          events: state.events.map((e) =>
            e.id === eventId && e.deliveredAt === undefined
              ? { ...e, deliveredAt: Date.now() }
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
      removeSet: (plannedExerciseId, setNumber) =>
        set((state) => {
          const current = state.programmeState.currentSession;
          if (!current) return state;
          const logs = current.logs.map((log) => {
            if (log.plannedExerciseId !== plannedExerciseId) return log;
            const remaining = log.sets
              .filter((s) => s.setNumber !== setNumber)
              // Renumber so set numbers stay 1..N contiguous after a delete.
              .map((s, i) => ({ ...s, setNumber: i + 1 }));
            return {
              ...log,
              sets: remaining,
              status: remaining.length === 0 ? ('pending' as const) : ('in-progress' as const),
            };
          });
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
      logFood: (entry) =>
        set((state) => {
          const foodLog = pruneFoodLog([...(state.foodLog ?? []), entry]);
          return {
            foodLog,
            dailySignals: {
              ...state.dailySignals,
              mealsLoggedToday: countForDate(foodLog, entry.forDate),
            },
          };
        }),
      updateFood: (id, patch) =>
        set((state) => ({
          foodLog: (state.foodLog ?? []).map((e) => (e.id === id ? { ...e, ...patch } : e)),
        })),
      removeFood: (id) =>
        set((state) => {
          const removed = (state.foodLog ?? []).find((e) => e.id === id);
          const foodLog = (state.foodLog ?? []).filter((e) => e.id !== id);
          return {
            foodLog,
            dailySignals: removed
              ? {
                  ...state.dailySignals,
                  mealsLoggedToday: countForDate(foodLog, removed.forDate),
                }
              : state.dailySignals,
          };
        }),
      saveFoodCorrection: (item) =>
        set((state) => {
          if (!item.barcode) return state;
          const corrections = {
            ...(state.foodCorrections ?? {}),
            [item.barcode]: { item, savedAt: Date.now() },
          };
          const keys = Object.keys(corrections);
          if (keys.length > FOOD_CORRECTIONS_MAX) {
            keys
              .sort((a, b) => corrections[a].savedAt - corrections[b].savedAt)
              .slice(0, keys.length - FOOD_CORRECTIONS_MAX)
              .forEach((k) => delete corrections[k]);
          }
          return { foodCorrections: corrections };
        }),
      addWater: (ml) =>
        set((state) => ({
          dailySignals: {
            ...state.dailySignals,
            waterMl: Math.max(0, (state.dailySignals.waterMl ?? 0) + ml),
          },
        })),
      logWeight: (kg) =>
        set((state) => {
          const rounded = Math.round(kg * 10) / 10;
          const forDate = todayLocalISODate();
          const entry: WeightEntry = { at: Date.now(), forDate, kg: rounded };
          const log = [
            ...(state.weightLog ?? []).filter((e) => e.forDate !== forDate),
            entry,
          ].slice(-WEIGHT_LOG_MAX);
          return {
            weightLog: log,
            dailySignals: { ...state.dailySignals, currentWeight: rounded },
          };
        }),
      reset: () => set({ ...EMPTY_SHARED_USER_DATA }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: 'meridian-user-data',
      storage: createJSONStorage(() => AsyncStorage),
      // Persistence contract: any breaking schema change MUST bump
      // `version` and extend `migrate` to carry old data forward —
      // zustand otherwise drops persisted state silently, which would
      // wipe a tester's history on an OTA update. Version 1 is the
      // tester-round baseline; version 2 adds weightLog, seeded from the
      // last known currentWeight (flagged `seeded` — it marks "first
      // known weight as of this update", not a real weigh-in moment).
      version: 2,
      migrate: (persisted, version) => {
        if (version < 2) {
          const state = persisted as Partial<SharedUserData>;
          const kg = state.dailySignals?.currentWeight;
          return {
            ...state,
            weightLog:
              typeof kg === 'number'
                ? [{ at: Date.now(), forDate: todayLocalISODate(), kg, seeded: true }]
                : [],
          } as never;
        }
        return persisted as never;
      },
      partialize: ({ hasHydrated, ...rest }) => rest,
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
