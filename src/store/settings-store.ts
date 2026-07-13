import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * App-wide preferences. Voice is the first: the brief's communication
 * model wants audio to be optional and one-tap muteable, with text always
 * remaining. Persisted so the choice survives restarts.
 */
interface SettingsState {
  /** When true, character replies are spoken aloud. Default on. */
  voiceEnabled: boolean;
  toggleVoice: () => void;
  setVoiceEnabled: (value: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      voiceEnabled: true,
      toggleVoice: () => set((state) => ({ voiceEnabled: !state.voiceEnabled })),
      setVoiceEnabled: (value) => set({ voiceEnabled: value }),
    }),
    {
      name: 'meridian-settings',
      storage: createJSONStorage(() => AsyncStorage),
      // Persistence contract: any breaking schema change MUST bump
      // `version` and extend `migrate` to carry old data forward —
      // zustand otherwise drops persisted state silently, which would
      // wipe a tester's history on an OTA update. Version 1 is the
      // tester-round baseline (all fields optional; 0 -> 1 is identity).
      version: 1,
      migrate: (persisted) => persisted as never,
    },
  ),
);
