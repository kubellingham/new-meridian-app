import { CharacterChat } from '@/src/components/chat/character-chat';
import { AppText, Screen } from '@/src/components/ui';
import { getCharacter } from '@/src/content/characters';
import { useUserStore } from '@/src/store/user-store';

/**
 * Training Hub — the chosen trainer's territory (brief §9). Today it's the
 * conversation surface; the full hub (Today / Plan / Library / Stats,
 * intake, workout logging, Coach Mode) lands in later sessions. The tab
 * mirrors the Diet Corner pattern: a thin wrapper around CharacterChat
 * with a per-trainer greeting so the voice is right from the first line.
 */

/**
 * Greeting scripts owned by this surface. Each is written to sound like
 * the specific trainer (Golden Test) — first-meeting sets the relationship,
 * short return greeting handles recent revisits, placeholder shapes the
 * input voice.
 */
const TRAINER_SCRIPTS = {
  cassidy: {
    greeting:
      "Cassidy. I lost forty kilos the slow way — that's the pace we work at. What are we starting with?",
    returnGreeting: 'Back. What are we working on?',
    placeholder: 'What do you want to work on?',
  },
  tobias: {
    greeting:
      "Tobias. I care more about the week around the workout than the workout itself — that's usually where the weight actually moves. Tell me what's going on.",
    returnGreeting: 'Back. What are we looking at?',
    placeholder: "What's on your mind?",
  },
  marco: {
    greeting:
      "Marco. Good to meet you. We build something you'll actually want to keep doing — that's the whole trick. Tell me where you're at.",
    returnGreeting: 'Ah, back. Ready to move?',
    placeholder: "Tell me what you're up to…",
  },
} as const;

type TrainerId = keyof typeof TRAINER_SCRIPTS;

/** Type guard so trainerId can be safely indexed into TRAINER_SCRIPTS. */
function isTrainerId(id: string | null): id is TrainerId {
  return id !== null && id in TRAINER_SCRIPTS;
}

export default function TrainingScreen() {
  const trainerId = useUserStore((s) => s.trainerId);

  // Grandfathered users may have completed setup before trainer became
  // required. Fall back to the previous "pick one in Profile" state so the
  // tab still loads instead of crashing on a missing character.
  if (!isTrainerId(trainerId)) {
    return (
      <Screen>
        <AppText variant="subtitle">No trainer yet</AppText>
        <AppText variant="caption">
          Pick a trainer from Profile when you&apos;re ready. Cassidy, Tobias, and Marco each
          bring a different approach.
        </AppText>
      </Screen>
    );
  }

  const trainer = getCharacter(trainerId);
  const scripts = TRAINER_SCRIPTS[trainerId];

  return (
    <CharacterChat
      characterId={trainerId}
      subtitle={`${trainer.origin} · Weight-Loss Trainer`}
      greeting={scripts.greeting}
      returnGreeting={scripts.returnGreeting}
      placeholder={scripts.placeholder}
    />
  );
}
