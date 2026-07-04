import { CharacterChat } from '@/src/components/chat/character-chat';
import { AppText, Screen } from '@/src/components/ui';
import { getCharacter } from '@/src/content/characters';
import { useUserStore } from '@/src/store/user-store';

/**
 * Diet Corner — the chosen NS's territory, and Meridian's first live AI
 * surface (brief §10): conversational meal logging. Thin wrapper around
 * the shared CharacterChat; the greeting and placeholder are this
 * surface's scripted copy.
 */
export default function DietScreen() {
  const nsId = useUserStore((s) => s.nsId);
  const ns = nsId ? getCharacter(nsId) : null;

  if (!ns || !nsId) {
    // The setup gate should make this unreachable; render a safe fallback.
    return (
      <Screen>
        <AppText variant="body">Pick a nutrition specialist in setup first.</AppText>
      </Screen>
    );
  }

  return (
    <CharacterChat
      characterId={nsId}
      subtitle={`${ns.origin} · Nutrition Specialist`}
      greeting={`I'm ${ns.name}. When you eat something, just tell me about it the way you'd tell a friend — I'll take it from there.`}
      placeholder="Tell me what you ate…"
    />
  );
}
