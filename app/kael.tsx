import { CharacterChat } from '@/src/components/chat/character-chat';
import { undeliveredBrief } from '@/src/services/morning-brief';
import { useUserDataStore } from '@/src/store/user-data-store';

/**
 * Kael's conversation surface — the operations consultant (brief §2).
 * The hub of the routing system: schedule, data, progress, and anything
 * that doesn't clearly belong to a specialist. Reached from Home; pushed
 * over the tabs, so it shows the back control.
 *
 * If Kael has an undelivered morning brief, it seeds this visit as his
 * opening message (in place of the scripted greeting) and is marked
 * delivered once shown.
 */
export default function KaelScreen() {
  const events = useUserDataStore((s) => s.events);
  const markEventDelivered = useUserDataStore((s) => s.markEventDelivered);

  const brief = undeliveredBrief(events);
  const pendingOpening = brief ? { id: brief.id, text: brief.summary } : undefined;

  return (
    <CharacterChat
      characterId="kael"
      subtitle="Operations Consultant · Meridian"
      greeting="Kael. I handle the operational side — schedule, progress, the moving parts. What do you need?"
      returnGreeting="Back. What do you need?"
      placeholder="What do you need?"
      showBack
      pendingOpening={pendingOpening}
      onOpeningDelivered={markEventDelivered}
    />
  );
}
