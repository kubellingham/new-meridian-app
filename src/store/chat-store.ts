import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { CharacterId } from '@/src/content/characters';

/** One message in a conversation thread with a specialist. */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  /** Unix ms timestamp. */
  at: number;
  /** True for messages that failed to send/receive — rendered as errors. */
  error?: boolean;
}

/**
 * Conversation threads, keyed per character so each relationship keeps its
 * own full history (and survives app restarts via AsyncStorage). The full
 * history is the specialist's memory — every API call includes it — even
 * though each visit only *shows* the current exchange.
 */
interface ChatState {
  threads: Partial<Record<CharacterId, ChatMessage[]>>;
  /** When the user last entered each character's space (unix ms). Drives
   * the fresh-vs-return greeting decision. */
  lastVisitAt: Partial<Record<CharacterId, number>>;
  /** True once AsyncStorage rehydration has finished. */
  hasHydrated: boolean;
  append: (characterId: CharacterId, message: ChatMessage) => void;
  /** Removes a single message — used to retry after an error. */
  remove: (characterId: CharacterId, messageId: string) => void;
  /** Records that the user just entered this character's space. */
  setLastVisit: (characterId: CharacterId, at: number) => void;
  clearThread: (characterId: CharacterId) => void;
  clearAll: () => void;
  setHasHydrated: (value: boolean) => void;
}

/** Builds a unique-enough id for a locally created message. */
export function makeMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      threads: {},
      lastVisitAt: {},
      hasHydrated: false,
      append: (characterId, message) =>
        set((state) => ({
          threads: {
            ...state.threads,
            [characterId]: [...(state.threads[characterId] ?? []), message],
          },
        })),
      remove: (characterId, messageId) =>
        set((state) => ({
          threads: {
            ...state.threads,
            [characterId]: (state.threads[characterId] ?? []).filter(
              (m) => m.id !== messageId,
            ),
          },
        })),
      setLastVisit: (characterId, at) =>
        set((state) => ({
          lastVisitAt: { ...state.lastVisitAt, [characterId]: at },
        })),
      clearThread: (characterId) =>
        set((state) => {
          const next = { ...state.threads };
          delete next[characterId];
          return { threads: next };
        }),
      clearAll: () => set({ threads: {}, lastVisitAt: {} }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: 'meridian-chats',
      storage: createJSONStorage(() => AsyncStorage),
      // Persistence contract: any breaking schema change MUST bump
      // `version` and extend `migrate` to carry old data forward —
      // zustand otherwise drops persisted state silently, which would
      // wipe a tester's history on an OTA update. Version 1 is the
      // tester-round baseline (all fields optional; 0 -> 1 is identity).
      version: 1,
      migrate: (persisted) => persisted as never,
      // hasHydrated is runtime-only; persist threads and visit times.
      partialize: ({ hasHydrated, ...rest }) => rest,
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
