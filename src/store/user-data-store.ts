import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  EMPTY_SHARED_USER_DATA,
  type DailySignals,
  type NutritionState,
  type PatternFlag,
  type ProgrammeState,
  type SessionFeedback,
  type SharedUserData,
  type UserProfile,
} from '@/src/types/user-data';

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
