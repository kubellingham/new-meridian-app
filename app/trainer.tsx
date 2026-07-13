import { CharacterChat } from '@/src/components/chat/character-chat';
import { AppText, Screen } from '@/src/components/ui';
import { useUserStore } from '@/src/store/user-store';

/**
 * The trainer's conversation surface. Was the Training tab's whole
 * content until the Training Hub landed; now lives as a pushed screen
 * accessed via the Hub's "Talk to {trainer}" button, mirroring how Kael
 * and Sera are accessed from Home.
 */

const TRAINER_SCRIPTS = {
  cassidy: {
    greeting:
      "Cassidy. I lost forty kilos the slow way — that's the pace we work at. What are we starting with?",
    returnGreeting: 'Back. What are we working on?',
    placeholder: 'What do you want to work on?',
    subtitle: 'Chicago, USA · Weight-Loss Trainer',
  },
  tobias: {
    greeting:
      "Tobias. I care more about the week around the workout than the workout itself — that's usually where the weight actually moves. Tell me what's going on.",
    returnGreeting: 'Back. What are we looking at?',
    placeholder: "What's on your mind?",
    subtitle: 'Berlin, Germany · Weight-Loss Trainer',
  },
  marco: {
    greeting:
      "Marco. Good to meet you. We build something you'll actually want to keep doing — that's the whole trick. Tell me where you're at.",
    returnGreeting: 'Ah, back. Ready to move?',
    placeholder: "Tell me what you're up to…",
    subtitle: 'São Paulo, Brazil · Weight-Loss Trainer',
  },
  ananya: {
    greeting:
      "Ananya. Muscle is built in the quiet weeks — my job is keeping you loading the bar through them. Tell me where you're starting from.",
    returnGreeting: 'Accha, back. Where were we?',
    placeholder: 'Ask about training…',
    subtitle: 'Mumbai, India · Muscle-Building Trainer',
  },
  dmitri: {
    greeting: 'Dmitri. Heavy, simple, repeated — that is the whole method. Tell me what you can lift with.',
    returnGreeting: 'Back. Good. What do you need?',
    placeholder: 'Ask about the work…',
    subtitle: 'Prague, Czech Republic · Muscle-Building Trainer',
  },
  kofi: {
    greeting:
      "Kofi! Strong is a skill, and we train it like one. Tell me what you're working with and we start building.",
    returnGreeting: 'Ah, back! Ready to work?',
    placeholder: 'Tell me where you are…',
    subtitle: 'Accra, Ghana · Muscle-Building Trainer',
  },
  amara: {
    greeting:
      "Amara. I train people for the life outside the gym — the stairs, the shopping, the years ahead. Tell me about your days.",
    returnGreeting: 'Sawa, back again. How is the body today?',
    placeholder: "What's on your mind?",
    subtitle: 'Nairobi, Kenya · General-Fitness Trainer',
  },
  ingrid: {
    greeting:
      'Ingrid. Mostly outside, mostly easy, never zero — that is how the engine gets built. Tell me about your week.',
    returnGreeting: 'Back. The plan waited for you.',
    placeholder: 'Ask about training…',
    subtitle: 'Oslo, Norway · General-Fitness Trainer',
  },
  sam: {
    greeting:
      "Sam. My whole thing is workouts that fit your actual Tuesday. So — what does your week really look like?",
    returnGreeting: 'Hey, back. How was the week?',
    placeholder: 'Tell me about your week…',
    subtitle: 'Vancouver, Canada · General-Fitness Trainer',
  },
} as const;

type TrainerId = keyof typeof TRAINER_SCRIPTS;

function isTrainerId(id: string | null): id is TrainerId {
  return id !== null && id in TRAINER_SCRIPTS;
}

export default function TrainerScreen() {
  const trainerId = useUserStore((s) => s.trainerId);

  if (!isTrainerId(trainerId)) {
    return (
      <Screen>
        <AppText variant="subtitle">No trainer yet</AppText>
        <AppText variant="caption">
          Pick a trainer from Profile when you&apos;re ready.
        </AppText>
      </Screen>
    );
  }

  const scripts = TRAINER_SCRIPTS[trainerId];

  return (
    <CharacterChat
      characterId={trainerId}
      subtitle={scripts.subtitle}
      greeting={scripts.greeting}
      returnGreeting={scripts.returnGreeting}
      placeholder={scripts.placeholder}
      showBack
    />
  );
}
