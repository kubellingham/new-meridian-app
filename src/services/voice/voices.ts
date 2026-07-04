import type { CharacterId } from '@/src/content/characters';

/**
 * Character → ElevenLabs voice mapping.
 *
 * MVP status: these are ElevenLabs STOCK voices chosen as reasonable
 * starting points for the three characters with chat surfaces so far.
 * They are NOT culturally matched yet — Nneka's Nigerian warmth, for
 * example, deserves a tuned or cloned voice before launch (brief §3
 * cultural authenticity). Swapping is a one-line change here: paste a
 * new voice ID from the ElevenLabs library next to the character.
 *
 * Characters without an explicit entry fall back to DEFAULT_VOICE_ID so
 * nothing crashes as more surfaces come online — but each should get its
 * own tuned voice as it ships.
 */
const VOICES: Partial<Record<CharacterId, string>> = {
  // Kael — measured, direct, operations. "Adam": deep, steady, head-coach.
  kael: 'pNInz6obpgDQGcFmaJgB',
  // Sera — warm, perceptive, behavioral. "Rachel": calm and warm.
  sera: '21m00Tcm4TlvDq8ikWAM',
  // Nneka — warm, proud, grounded. "Domi": confident female, distinct
  // from Sera. Placeholder until a West-African-matched voice is chosen.
  nneka: 'AZnzlk1XvdvUeBnXmlld',
};

/** Fallback for any character not yet explicitly mapped. "Rachel". */
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';

/** Returns the ElevenLabs voice ID to use for a character. */
export function getVoiceId(characterId: CharacterId): string {
  return VOICES[characterId] ?? DEFAULT_VOICE_ID;
}

/** True when a character has an explicitly tuned voice (not the fallback). */
export function hasTunedVoice(characterId: CharacterId): boolean {
  return characterId in VOICES;
}
