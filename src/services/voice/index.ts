import type { CharacterId } from '@/src/content/characters';
import { describeVoiceError, isVoiceConfigured, synthesizeSpeech } from './eleven-labs';
import { playAudioBytes, stopPlayback } from './player';

export { isVoiceConfigured } from './eleven-labs';
export { getVoiceId, hasTunedVoice } from './voices';

/**
 * Speaks a character's reply aloud: synthesize, then play. Any failure is
 * logged and swallowed — voice is an enhancement layered on top of the
 * text, and a synthesis error must never break the conversation.
 *
 * @param characterId whose voice to use
 * @param text the reply to speak
 */
export async function speak(characterId: CharacterId, text: string): Promise<void> {
  try {
    const bytes = await synthesizeSpeech(characterId, text);
    await playAudioBytes(bytes);
  } catch (error) {
    console.warn('Voice playback skipped:', describeVoiceError(error));
  }
}

/** Stops any current playback (new message sent, screen left, muted). */
export function stopSpeaking(): void {
  stopPlayback();
}

/** Re-exported so callers can gate UI on whether voice can work at all. */
export const voiceConfigured = isVoiceConfigured;
