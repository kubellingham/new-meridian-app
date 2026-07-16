import type { CharacterId } from '@/src/content/characters';

/**
 * Trainer intake scripts — the first-time Training Hub conversation.
 *
 * Master Brief principle: deep intake questions live with the specialist
 * who needs them, asked in their space, in their voice, after the
 * relationship exists. All five trainers collect roughly the same facts,
 * but they do not weight them the same way and must not ask them the
 * same way — the ordering, phrasing, reactions, extra questions, and
 * challenges below are where the philosophy shows up. One engine
 * (src/components/workout/trainer-intake.tsx) renders every script.
 *
 * Structured steps are fully scripted (no API). Free-text steps go
 * through the proxy with the trainer's system prompt so the response
 * reacts to what was actually said; each carries a scripted fallback for
 * offline.
 */

/** Canonical answers — the engine maps these onto the shared schema. */
export interface IntakeAnswers {
  experience?: 'none' | 'returning' | 'some' | 'experienced';
  place?: 'home' | 'gym' | 'outdoors' | 'mix';
  /** Only asked when training at home or mixed. */
  equipment?: 'home-basics' | 'bodyweight';
  days?: number;
  sessionLength?: number;
  timeOfDay?: 'morning' | 'midday' | 'evening' | 'varies';
  /** Free text: injuries, pain, movements to avoid. */
  limitations?: string;
  /** Free text: anything else the trainer should know. */
  notes?: string;
  // Trainer-specific extras (challenge fuel; not written to the profile).
  sleep?: 'short' | 'okay' | 'good';
  lifeLoad?: 'steady' | 'full' | 'rough';
}

export interface IntakeOption {
  value: string | number;
  label: string;
  hint?: string;
  /** The trainer's in-voice reaction once this is picked. */
  reaction: string[];
}

export type IntakeStep =
  | {
      kind: 'choice';
      field: keyof IntakeAnswers;
      prompt: string;
      options: IntakeOption[];
      /** Render only when true (e.g. equipment for home/mix trainees). */
      when?: (answers: IntakeAnswers) => boolean;
    }
  | {
      kind: 'freeText';
      field: 'limitations' | 'notes';
      prompt: string;
      placeholder: string;
      /** Shown when the API is unreachable — in voice, still honest. */
      fallbackAck: string[];
      /** Label for answering with nothing, e.g. "Nothing to flag". */
      skipLabel: string;
    };

/**
 * A challenge: the trainer's method conflicts with an answer, the
 * trainer says so honestly, and the user decides. Never a block, never
 * a silent softening — the outcome is theirs, and Kael hears about it
 * via an intake-concern event either way.
 */
export interface IntakeChallenge {
  id: string;
  /** Evaluated once, right after this field commits. */
  afterField: keyof IntakeAnswers;
  when: (answers: IntakeAnswers) => boolean;
  /** The trainer's piece — plain, in voice, no drama. */
  lines: string[];
  options: {
    label: string;
    /** Answer override when the user takes the trainer's suggestion. */
    apply?: Partial<IntakeAnswers>;
    reaction: string[];
    /** Short outcome line recorded in the event to Kael. */
    outcome: string;
  }[];
}

export interface TrainerIntakeScript {
  trainerId: CharacterId;
  /** Why they're asking — the relationship's first working moment. */
  intro: string[];
  steps: IntakeStep[];
  challenges: IntakeChallenge[];
  /** What happens next, in their voice. */
  outro: string[];
}
