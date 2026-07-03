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

/** Stable identifiers for every V1 character. */
export type CharacterId =
  | 'kael'
  | 'sera'
  | 'cassidy'
  | 'tobias'
  | 'marco'
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
  /** Display name, e.g. "Mei Lin". */
  name: string;
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
}
