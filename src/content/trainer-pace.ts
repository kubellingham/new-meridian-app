import type { CharacterId } from '@/src/content/characters';

/**
 * How each weight-loss trainer talks about pace, for the Insights weight
 * section — their stated line (in their voice) plus, where a coach
 * honestly prescribes a numeric band, that band as % of bodyweight per
 * week so actual rate can sit next to it without editorializing.
 *
 * Deliberately a separate content map: Character objects and the
 * registry stay untouched, and dormant-goal trainers are simply absent
 * (lookup → undefined → no row rendered).
 */
export interface TrainerPace {
  /** The trainer's own words about pace — shown verbatim. */
  line: string;
  /** Prescribed loss band, % of bodyweight per week (positive numbers). */
  minPctPerWeek?: number;
  maxPctPerWeek?: number;
}

export const TRAINER_PACE: Partial<Record<CharacterId, TrainerPace>> = {
  cassidy: {
    line: 'Half a kilo a week. I know how that sounds. You’re not slow — you’re on schedule.',
    minPctPerWeek: 0.5,
    maxPctPerWeek: 0.75,
  },
  renata: {
    line: 'The scale is your diet’s scoreboard. Mine is whether your squat held while it dropped.',
  },
  marcus: {
    line: 'I don’t chase the scale week to week. Count the rounds — the weight sorts itself out.',
  },
  priya: {
    line: 'Slow and boring is the plan working. The only number I watch is how many weeks you’ve shown up.',
  },
  noa: {
    line: 'You know the expected range — I gave it to you in advance. We check weekly, no drama at the scale.',
    minPctPerWeek: 0.5,
    maxPctPerWeek: 1.0,
  },
};
