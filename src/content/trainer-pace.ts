import { getCharacter, type CharacterId } from '@/src/content/characters';

/**
 * The Insights pace card's view of a trainer, DERIVED from the
 * character's projectionProfile — the single source of rate data lives
 * on the Character (src/content/characters/*.ts), never here.
 *
 * The numeric band is exposed only for trainers whose band is a
 * position rather than a default: Cassidy prescribes her percentage
 * (the rate is the method) and Noa's block has stated expected ranges.
 * Renata, Marcus, and Priya carry honest default bands for future
 * projection work, but their own notes say the rate isn't the thing
 * they coach — rendering "inside the band" against a default would
 * contradict them, so no comparison is surfaced.
 */
export interface TrainerPace {
  /** The trainer's own words about pace — shown verbatim. */
  line: string;
  /** Prescribed loss band, % of bodyweight per week (positive numbers). */
  minPctPerWeek?: number;
  maxPctPerWeek?: number;
}

/** Trainers whose rate band is a coached position, not a default. */
const BAND_IS_THE_POSITION: readonly CharacterId[] = ['cassidy', 'noa'];

const WEIGHT_LOSS_TRAINERS: readonly CharacterId[] = [
  'cassidy',
  'renata',
  'marcus',
  'priya',
  'noa',
];

export const TRAINER_PACE: Partial<Record<CharacterId, TrainerPace>> =
  Object.fromEntries(
    WEIGHT_LOSS_TRAINERS.flatMap((id) => {
      const profile = getCharacter(id).projectionProfile;
      if (!profile) return [];
      const pace: TrainerPace = BAND_IS_THE_POSITION.includes(id)
        ? {
            line: profile.ratePhilosophyNote,
            minPctPerWeek: profile.expectedRateMin,
            maxPctPerWeek: profile.expectedRateMax,
          }
        : { line: profile.ratePhilosophyNote };
      return [[id, pace]];
    }),
  );
