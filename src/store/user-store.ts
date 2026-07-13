import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { CharacterId } from '@/src/content/characters';

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
   * completed setup before this became required.
   */
  trainerId: CharacterId | null;
  /** True once onboarding has assembled the team. */
  setupComplete: boolean;
  /** True once AsyncStorage rehydration has finished. */
  hasHydrated: boolean;
  completeSetup: (data: { name: string; nsId: CharacterId; trainerId: CharacterId }) => void;
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
      setupComplete: false,
      hasHydrated: false,
      completeSetup: ({ name, nsId, trainerId }) =>
        set({ name, nsId, trainerId, setupComplete: true }),
      reset: () => set({ name: '', nsId: null, trainerId: null, setupComplete: false }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: 'meridian-user',
      storage: createJSONStorage(() => AsyncStorage),
      // hasHydrated is runtime-only state; don't persist it.
      partialize: ({ hasHydrated, ...rest }) => rest,
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
