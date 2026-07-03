import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { CharacterId } from '@/src/content/characters';

/**
 * Local user profile. Populated today by the temporary setup screen;
 * the scripted onboarding (separate doc, later session) will replace
 * that surface but write into this same store.
 */
interface UserState {
  /** The user's first name, as they want to be addressed. */
  name: string;
  /** Chosen nutrition specialist. Null until setup completes. */
  nsId: CharacterId | null;
  /** Chosen trainer. Optional in the temporary setup. */
  trainerId: CharacterId | null;
  /** True once the (temporary) setup has been completed. */
  setupComplete: boolean;
  /** True once AsyncStorage rehydration has finished. */
  hasHydrated: boolean;
  completeSetup: (data: { name: string; nsId: CharacterId; trainerId?: CharacterId }) => void;
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
        set({ name, nsId, trainerId: trainerId ?? null, setupComplete: true }),
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
