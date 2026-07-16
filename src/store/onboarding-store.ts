import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * In-flight onboarding progress — the current beat and every committed
 * answer, persisted as the user advances so backgrounding or process
 * death never restarts the flow. app/onboarding.tsx reads and writes
 * this as its single source of truth for progress; finish() (and the
 * Profile reset action) clear it. Typed-but-unsubmitted input is
 * deliberately NOT stored — resume lands at the same beat with all
 * committed answers intact.
 */
interface OnboardingProgressState {
  /** Index into buildOnboardingFlow(goal) — the beat being shown. */
  stepIndex: number;
  /**
   * Every committed answer keyed by field (name, goal, trainer, …).
   * answers.goal reconstructs the same flow on resume, and the flow's
   * pre-goal prefix is index-stable by design, so a saved stepIndex
   * stays valid.
   */
  answers: Record<string, string>;
  /** True once AsyncStorage rehydration has finished. */
  hasHydrated: boolean;
  setStepIndex: (stepIndex: number) => void;
  mergeAnswers: (patch: Record<string, string>) => void;
  /** Wipes progress — called when onboarding finishes or is reset. */
  reset: () => void;
  setHasHydrated: (value: boolean) => void;
}

export const useOnboardingStore = create<OnboardingProgressState>()(
  persist(
    (set) => ({
      stepIndex: 0,
      answers: {},
      hasHydrated: false,
      setStepIndex: (stepIndex) => set({ stepIndex }),
      mergeAnswers: (patch) => set((s) => ({ answers: { ...s.answers, ...patch } })),
      reset: () => set({ stepIndex: 0, answers: {} }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: 'meridian-onboarding',
      storage: createJSONStorage(() => AsyncStorage),
      // Persistence contract: any breaking schema change MUST bump
      // `version` and extend `migrate` to carry old data forward —
      // zustand otherwise drops persisted state silently, which would
      // restart a tester's onboarding on an OTA update.
      version: 1,
      migrate: (persisted) => persisted as never,
      // Allowlist: progress only. hasHydrated is runtime-only state.
      partialize: ({ stepIndex, answers }) => ({ stepIndex, answers }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
