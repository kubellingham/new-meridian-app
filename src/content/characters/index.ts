/**
 * Character registry — the single entry point for character content.
 * Screens and services import from here, never from individual files.
 */

import { cassidy } from './cassidy';
import { elena } from './elena';
import { haruki } from './haruki';
import { jordan } from './jordan';
import { kael } from './kael';
import { kavya } from './kavya';
import { marco } from './marco';
import { meiLin } from './mei-lin';
import { nneka } from './nneka';
import { sera } from './sera';
import { sofia } from './sofia';
import { tobias } from './tobias';
import { yasmin } from './yasmin';
import type { Character, CharacterId, CharacterRole } from './types';

export { buildSystemPrompt, NS_ROLE_BLOCK, SHARED_INSTRUCTION_BLOCK } from './shared';
export type { Character, CharacterId, CharacterRole } from './types';

/** Every V1 character, in presentation order: consultants, trainers, NS. */
export const CHARACTERS: readonly Character[] = [
  kael,
  sera,
  cassidy,
  tobias,
  marco,
  nneka,
  kavya,
  haruki,
  sofia,
  yasmin,
  elena,
  jordan,
  meiLin,
];

/** Looks up a character by id. Throws on unknown ids — a content bug. */
export function getCharacter(id: CharacterId): Character {
  const found = CHARACTERS.find((c) => c.id === id);
  if (!found) {
    throw new Error(`Unknown character id: ${id}`);
  }
  return found;
}

/** Returns all characters with the given role, in registry order. */
export function getCharactersByRole(role: CharacterRole): Character[] {
  return CHARACTERS.filter((c) => c.role === role);
}

/** The two consultants — both on every user's team (brief §2). */
export const CONSULTANTS = getCharactersByRole('consultant');

/** The three V1 weight-loss trainers. */
export const TRAINERS = getCharactersByRole('trainer');

/** The eight nutrition specialists, by cultural tradition. */
export const NUTRITION_SPECIALISTS = getCharactersByRole('nutrition-specialist');
