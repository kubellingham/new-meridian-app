import type { CharacterId } from '@/src/content/characters';
import { cassidyIntake } from './cassidy';
import { marcusIntake } from './marcus';
import { noaIntake } from './noa';
import { priyaIntake } from './priya';
import { renataIntake } from './renata';
import type { TrainerIntakeScript } from './types';

export type {
  IntakeAnswers,
  IntakeChallenge,
  IntakeOption,
  IntakeStep,
  TrainerIntakeScript,
} from './types';

/** Intake scripts by trainer — the five weight-loss coaches. */
export const INTAKE_SCRIPTS: Partial<Record<CharacterId, TrainerIntakeScript>> = {
  cassidy: cassidyIntake,
  renata: renataIntake,
  marcus: marcusIntake,
  priya: priyaIntake,
  noa: noaIntake,
};

/** Resolves a trainer's intake script; undefined for dormant trainers. */
export function getIntakeScript(trainerId: CharacterId): TrainerIntakeScript | undefined {
  return INTAKE_SCRIPTS[trainerId];
}
