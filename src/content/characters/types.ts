/**
 * Character content types — Master Brief v2.0, Section 2 (personnel
 * architecture) and Appendix A (prompts live in code).
 *
 * These files are the source of truth for how each character speaks and
 * behaves in live AI conversation. Concept changes belong in the brief;
 * operational voice changes belong here.
 */

/** The four-role model. "future" roles (sports coaches etc.) are not in V1. */
export type CharacterRole = 'consultant' | 'trainer' | 'nutrition-specialist';

/**
 * The goal a trainer specializes in (brief §2 — trainers specialize by
 * goal, NS by culture). Values mirror `PrimaryGoal` in user-data.ts;
 * duplicated as a literal union because user-data imports from this
 * module and the reverse import would be a cycle.
 */
export type TrainerGoal = 'weight-loss' | 'build-muscle' | 'general-fitness';

/**
 * Stable identifiers for every character, including retired ones —
 * persisted data (plans, threads, events) references retired ids
 * forever, so ids are never removed from this union.
 */
export type CharacterId =
  | 'kael'
  | 'sera'
  | 'cassidy'
  | 'renata'
  | 'marcus'
  | 'priya'
  | 'noa'
  | 'tobias' // retired
  | 'marco' // retired
  | 'ananya'
  | 'dmitri'
  | 'kofi'
  | 'amara'
  | 'ingrid'
  | 'sam'
  | 'nneka'
  | 'kavya'
  | 'haruki'
  | 'sofia'
  | 'yasmin'
  | 'elena'
  | 'jordan'
  | 'mei-lin';

export interface Character {
  id: CharacterId;
  /** Callable name — what teammates and chat headers use, e.g. "Renata". */
  name: string;
  /**
   * Full name shown on selection/roster cards where weight matters,
   * e.g. "Renata Alves". Falls back to `name` when unset.
   */
  fullName?: string;
  role: CharacterRole;
  /** Where they're from — shown on selection cards. */
  origin: string;
  /** Three-ish personality words, e.g. "Patient. Honest. Relentless." */
  personalityWords: string;
  /** One-line philosophy shown on cards and used in intros. */
  philosophy: string;
  /**
   * How this character relates to humor (brief §3, humor distribution).
   * Documentation for writers/designers; the systemPrompt encodes it too.
   */
  humorProfile: string;
  /**
   * Notes on cultural seasoning — expressions this character may use
   * sparingly. Empty string when not applicable.
   */
  culturalSeasoning: string;
  /**
   * The character-specific portion of the system prompt. The shared
   * instruction block (shared.ts) is prepended at assembly time — never
   * baked into this string.
   */
  voicePrompt: string;
  /**
   * Trainers only: which goal path this trainer coaches. Drives roster
   * filtering in onboarding. Unset for consultants and NS.
   */
  goalSpecialty?: TrainerGoal;
  /**
   * Retired characters stay registered (persisted plans, threads, and
   * events reference them forever — getCharacter must keep resolving),
   * but they are excluded from every roster and picker. No new
   * relationship can start with a retired character.
   */
  retired?: boolean;
}
