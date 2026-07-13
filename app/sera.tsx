import { CharacterChat } from '@/src/components/chat/character-chat';

/**
 * Sera's conversation surface — the behavioral consultant (brief §2).
 * Reached from Home; pushed over the tabs, so it shows the back control.
 */
export default function SeraScreen() {
  return (
    <CharacterChat
      characterId="sera"
      subtitle="Behavioral Consultant · Meridian"
      greeting="I'm Sera. Whatever today's actually been like — that's what I'm here for. What's on your mind?"
      returnGreeting="Hey, you. Good to see you back — what's here right now?"
      placeholder="What's on your mind?"
      showBack
      starterPrompts={[
        "I'm struggling with motivation",
        'Help me build a habit that sticks',
        'This week was rough',
      ]}
    />
  );
}
