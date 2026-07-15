import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { CharacterId } from '@/src/content/characters';

/** Trainers retired by Roster v1 — persisted picks migrate to a re-pick. */
const RETIRED_TRAINER_IDS: readonly CharacterId[] = ['tobias', 'marco'];

/**
 * Local user profile — name plus the chosen trainer and nutrition
 * specialist. Written by the scripted onboarding (app/onboarding.tsx),
 * which also fills the richer shared-data profile in useUserDataStore.
 */
interface UserState {
  /** The user's first name, as they want to be addressed. */
  name: string;
  /** Chosen nutrition specialist. Null until setup completes. */
  nsId: CharacterId | null;
  /**
   * Chosen trainer. Onboarding requires one so the Training tab has a
   * trainer to talk to. Stays nullable in the type to support users who
   * completed setup before this became required — and users whose
   * trainer retired (see retiredTrainerId).
   */
  trainerId: CharacterId | null;
  /**
   * Set when a roster change retired the user's trainer: who left.
   * Drives Kael's staffing note on Home and the re-pick surface on the
   * Training Hub. Cleared once the user commits to a new trainer.
   */
  retiredTrainerId: CharacterId | null;
  /** True once onboarding has assembled the team. */
  setupComplete: boolean;
  /** True once AsyncStorage rehydration has finished. */
  hasHydrated: boolean;
  completeSetup: (data: { name: string; nsId: CharacterId; trainerId: CharacterId }) => void;
  /** Commits a new trainer (the re-pick flow) and clears the flag. */
  setTrainer: (trainerId: CharacterId) => void;
  /** Wipes the profile — dev/testing action exposed on the Profile tab. */
  reset: () => void;
  setHasHydrated: (value: boolean) => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      name: '',
      nsId: null,
      trainerId: null,
      retiredTrainerId: null,
      setupComplete: false,
      hasHydrated: false,
      completeSetup: ({ name, nsId, trainerId }) =>
        set({ name, nsId, trainerId, setupComplete: true }),
      setTrainer: (trainerId) => set({ trainerId, retiredTrainerId: null }),
      reset: () =>
        set({ name: '', nsId: null, trainerId: null, retiredTrainerId: null, setupComplete: false }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: 'meridian-user',
      storage: createJSONStorage(() => AsyncStorage),
      // Persistence contract: any breaking schema change MUST bump
      // `version` and extend `migrate` to carry old data forward —
      // zustand otherwise drops persisted state silently, which would
      // wipe a tester's history on an OTA update. Version 1 is the
      // tester-round baseline; version 2 retires Tobias and Marco
      // (Roster v1): a retired trainer pick becomes null plus a
      // retiredTrainerId flag, which routes the user to re-pick.
      version: 2,
      migrate: (persisted) => {
        const state = persisted as Partial<UserState>;
        if (state.trainerId && RETIRED_TRAINER_IDS.includes(state.trainerId)) {
          return { ...state, trainerId: null, retiredTrainerId: state.trainerId } as never;
        }
        return state as never;
      },
      // hasHydrated is runtime-only state; don't persist it.
      partialize: ({ hasHydrated, ...rest }) => rest,
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
