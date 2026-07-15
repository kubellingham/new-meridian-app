/**
 * Character registry — the single entry point for character content.
 * Screens and services import from here, never from individual files.
 */

import { amara } from './amara';
import { ananya } from './ananya';
import { cassidy } from './cassidy';
import { dmitri } from './dmitri';
import { elena } from './elena';
import { haruki } from './haruki';
import { ingrid } from './ingrid';
import { jordan } from './jordan';
import { kael } from './kael';
import { kavya } from './kavya';
import { kofi } from './kofi';
import { marco } from './marco';
import { marcus } from './marcus';
import { meiLin } from './mei-lin';
import { nneka } from './nneka';
import { noa } from './noa';
import { priya } from './priya';
import { renata } from './renata';
import { sam } from './sam';
import { sera } from './sera';
import { sofia } from './sofia';
import { tobias } from './tobias';
import { yasmin } from './yasmin';
import type { Character, CharacterId, CharacterRole, TrainerGoal } from './types';

export { buildSystemPrompt, NS_ROLE_BLOCK, SHARED_INSTRUCTION_BLOCK, TEAM_CROSS_REFERENCE_BLOCK } from './shared';
export type { Character, CharacterId, CharacterRole, TrainerGoal } from './types';

/**
 * Every character, in presentation order: consultants, trainers
 * (weight loss, then muscle, then general fitness), NS. Retired
 * characters stay registered — persisted plans/threads/events reference
 * their ids forever — but are excluded from rosters and pickers.
 */
export const CHARACTERS: readonly Character[] = [
  kael,
  sera,
  cassidy,
  renata,
  marcus,
  priya,
  noa,
  tobias,
  marco,
  ananya,
  dmitri,
  kofi,
  amara,
  ingrid,
  sam,
  nneka,
  kavya,
  haruki,
  sofia,
  yasmin,
  elena,
  jordan,
  meiLin,
];

/**
 * Looks up a character by id. Resolves retired characters too —
 * historical plans, threads, and events must keep rendering. Throws on
 * unknown ids — a content bug.
 */
export function getCharacter(id: CharacterId): Character {
  const found = CHARACTERS.find((c) => c.id === id);
  if (!found) {
    throw new Error(`Unknown character id: ${id}`);
  }
  return found;
}

/**
 * Returns active (non-retired) characters with the given role, in
 * registry order. Rosters and pickers never offer retired characters.
 */
export function getCharactersByRole(role: CharacterRole): Character[] {
  return CHARACTERS.filter((c) => c.role === role && !c.retired);
}

/** The two consultants — both on every user's team (brief §2). */
export const CONSULTANTS = getCharactersByRole('consultant');

/** All active trainers across the three goal paths. */
export const TRAINERS = getCharactersByRole('trainer');

/** The trainers recommended for a goal — the onboarding roster. */
export function getTrainersForGoal(goal: TrainerGoal): Character[] {
  return TRAINERS.filter((t) => t.goalSpecialty === goal);
}

/** The eight nutrition specialists, by cultural tradition. */
export const NUTRITION_SPECIALISTS = getCharactersByRole('nutrition-specialist');
