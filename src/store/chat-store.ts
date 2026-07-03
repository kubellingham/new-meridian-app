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
 * Conversation threads, keyed per character so each relationship keeps
 * its own history (and survives app restarts via AsyncStorage).
 */
interface ChatState {
  threads: Partial<Record<CharacterId, ChatMessage[]>>;
  append: (characterId: CharacterId, message: ChatMessage) => void;
  /** Removes a single message — used to retry after an error. */
  remove: (characterId: CharacterId, messageId: string) => void;
  clearThread: (characterId: CharacterId) => void;
  clearAll: () => void;
}

/** Builds a unique-enough id for a locally created message. */
export function makeMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      threads: {},
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
      clearThread: (characterId) =>
        set((state) => {
          const next = { ...state.threads };
          delete next[characterId];
          return { threads: next };
        }),
      clearAll: () => set({ threads: {} }),
    }),
    {
      name: 'meridian-chats',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
