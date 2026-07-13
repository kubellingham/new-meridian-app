import { useCallback } from 'react';

import { CharacterChat } from '@/src/components/chat/character-chat';
import { AppText, Screen } from '@/src/components/ui';
import { getCharacter } from '@/src/content/characters';
import { makeFoodLogId, todayLocalISODate } from '@/src/services/food-log';
import { getCharacterReplyWithFoodLog } from '@/src/services/food-logging';
import type { ChatMessage } from '@/src/store/chat-store';
import { useUserDataStore } from '@/src/store/user-data-store';
import { useUserStore } from '@/src/store/user-store';
import type { MealSlot } from '@/src/types/user-data';

/** Rough meal guess from the hour, for when the NS doesn't say. */
function mealFromClock(): MealSlot {
  const hour = new Date().getHours();
  if (hour < 11) return 'breakfast';
  if (hour < 16) return 'lunch';
  if (hour < 21) return 'dinner';
  return 'snack';
}

/**
 * The NS's conversation surface — was the whole Diet tab until the food
 * dashboard landed; now a pushed screen reached from Diet Corner,
 * mirroring how the trainer chat hangs off the Training Hub.
 *
 * Replies come through the food-logging path: when the user describes
 * something they ate, the NS both answers in voice AND records it, so
 * the dashboard's numbers move without leaving the conversation. Chat
 * entries are editable/removable from the dashboard like any other.
 */
export default function DietChatScreen() {
  const nsId = useUserStore((s) => s.nsId);
  const name = useUserStore((s) => s.name);
  const logFood = useUserDataStore((s) => s.logFood);

  const ns = nsId ? getCharacter(nsId) : null;

  const fetchReply = useCallback(
    async (history: ChatMessage[]) => {
      if (!nsId) throw new Error('No nutrition specialist selected');
      const { reply, foods } = await getCharacterReplyWithFoodLog(nsId, history, name);
      for (const parsed of foods) {
        logFood({
          id: makeFoodLogId(),
          loggedAt: Date.now(),
          forDate: todayLocalISODate(),
          meal: parsed.meal ?? mealFromClock(),
          source: 'chat',
          servings: parsed.servings,
          item: parsed.item,
        });
      }
      return reply;
    },
    [nsId, name, logFood],
  );

  if (!ns || !nsId) {
    return (
      <Screen>
        <AppText variant="body">Meet your nutrition specialist in onboarding first.</AppText>
      </Screen>
    );
  }

  return (
    <CharacterChat
      characterId={nsId}
      subtitle={`${ns.origin} · Nutrition Specialist`}
      greeting={`I'm ${ns.name}. When you eat something, just tell me about it the way you'd tell a friend — I'll take it from there.`}
      returnGreeting="You're back. What are we working with today?"
      placeholder="Tell me what you ate…"
      showBack
      fetchReply={fetchReply}
    />
  );
}
