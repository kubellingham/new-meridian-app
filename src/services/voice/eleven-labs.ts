import type { CharacterId } from '@/src/content/characters';
import { getVoiceId } from './voices';

/**
 * ElevenLabs text-to-speech — turns a character's reply into audio.
 *
 * MVP decision (mirrors the Claude service, brief §12): the key ships
 * client-side via EXPO_PUBLIC_ELEVENLABS_API_KEY for personal testing
 * ONLY. ElevenLabs bills by usage and a leaked key can be drained, so a
 * backend proxy is required before any public launch — even more so than
 * for Claude.
 *
 * We call the REST endpoint with a plain fetch rather than the ElevenLabs
 * SDK: the SDK pulls in Node built-ins that Metro can't resolve on native
 * (the same class of bug we hit with the Anthropic SDK's node:fs import).
 */

const API_BASE = 'https://api.elevenlabs.io/v1/text-to-speech';
/** Turbo v2.5: low latency, multilingual, cost-effective — good for chat. */
const MODEL_ID = 'eleven_turbo_v2_5';
/** Standard MP3 output that expo-audio plays on every platform. */
const OUTPUT_FORMAT = 'mp3_44100_128';

/** Reads the API key from the Expo public env (inlined at build time). */
function getApiKey(): string | undefined {
  return process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY || undefined;
}

/** True when a key is present and speech synthesis can work. */
export function isVoiceConfigured(): boolean {
  return Boolean(getApiKey());
}

/**
 * Synthesizes `text` in the character's voice and returns the MP3 bytes.
 * Throws on a missing key or a non-OK response; callers decide how loudly
 * to fail (voice is an enhancement, never a blocker for the text reply).
 *
 * @param characterId whose voice to speak in
 * @param text the reply text to voice
 */
export async function synthesizeSpeech(
  characterId: CharacterId,
  text: string,
): Promise<Uint8Array> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('ElevenLabs API key not configured');
  }

  const voiceId = getVoiceId(characterId);
  const url = `${API_BASE}/${voiceId}?output_format=${OUTPUT_FORMAT}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({ text, model_id: MODEL_ID }),
  });

  if (!response.ok) {
    // Surface the status so the caller can log something actionable.
    throw new VoiceError(response.status, `ElevenLabs returned ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

/** Error carrying the HTTP status from a failed synthesis call. */
export class VoiceError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'VoiceError';
  }
}

/** A short, developer-facing description of why voice failed. */
export function describeVoiceError(error: unknown): string {
  if (error instanceof VoiceError) {
    if (error.status === 401) {
      return 'Voice service key was rejected.';
    }
    if (error.status === 429) {
      return 'ElevenLabs rate limit or quota reached.';
    }
    return `ElevenLabs error (${error.status}).`;
  }
  return 'Voice synthesis failed.';
}
