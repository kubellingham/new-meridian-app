import { CharacterChat } from '@/src/components/chat/character-chat';

/**
 * Kael's conversation surface — the operations consultant (brief §2).
 * The hub of the routing system: schedule, data, progress, and anything
 * that doesn't clearly belong to a specialist. Reached from Home; pushed
 * over the tabs, so it shows the back control.
 */
export default function KaelScreen() {
  return (
    <CharacterChat
      characterId="kael"
      subtitle="Operations Consultant · Meridian"
      greeting="Kael. I handle the operational side — schedule, progress, the moving parts. What do you need?"
      returnGreeting="Back. What do you need?"
      placeholder="What do you need?"
      showBack
    />
  );
}
