import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { Platform } from 'react-native';

/**
 * Plays synthesized MP3 bytes through expo-audio.
 *
 * Cross-platform source handling differs:
 *   - Native (Android/iOS): expo-audio plays a local file URI reliably,
 *     so we write the bytes to a cache file and point the player at it.
 *   - Web: file URIs don't apply; a Blob object URL is the natural source.
 *
 * A single player and cache file are reused so overlapping replies never
 * stack — starting a new clip stops the previous one.
 */

/** The one active player, replaced on each new clip. */
let currentPlayer: AudioPlayer | null = null;
/** The web object URL currently in use, revoked when replaced. */
let currentObjectUrl: string | null = null;
/** Audio mode is configured once, lazily, before the first clip. */
let audioModeReady = false;

/** Ensures playback works even with the iOS silent switch on. */
async function ensureAudioMode(): Promise<void> {
  if (audioModeReady) return;
  try {
    await setAudioModeAsync({ playsInSilentMode: true });
  } catch {
    // Web (and some environments) may not implement this; playback still
    // works, so a failure here is non-fatal.
  }
  audioModeReady = true;
}

/** Tears down the active player and any web object URL. */
function disposeCurrent(): void {
  if (currentPlayer) {
    try {
      currentPlayer.remove();
    } catch {
      // Already removed — ignore.
    }
    currentPlayer = null;
  }
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }
}

/** Builds a playable source URI from raw MP3 bytes, per platform. */
async function sourceFromBytes(bytes: Uint8Array): Promise<string> {
  if (Platform.OS === 'web') {
    // Cast the backing buffer to ArrayBuffer — TS's BlobPart type rejects
    // the ArrayBufferLike union, but the runtime value is a real buffer.
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'audio/mpeg' });
    currentObjectUrl = URL.createObjectURL(blob);
    return currentObjectUrl;
  }

  // Native: write to a reused cache file and play its file:// URI. Import
  // lazily so web bundles never pull in the native file-system module.
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy load keeps expo-file-system out of the web bundle
  const { File, Paths } = require('expo-file-system');
  const file = new File(Paths.cache, 'meridian-voice.mp3');
  if (file.exists) {
    file.delete();
  }
  file.create();
  file.write(bytes);
  return file.uri;
}

/**
 * Plays the given MP3 bytes, stopping whatever was playing first.
 * Rejects if the audio can't be prepared; never throws synchronously.
 */
export async function playAudioBytes(bytes: Uint8Array): Promise<void> {
  await ensureAudioMode();
  disposeCurrent();

  const uri = await sourceFromBytes(bytes);
  const player = createAudioPlayer(uri);
  currentPlayer = player;
  player.play();
}

/** Stops any current playback — e.g. when the user sends a new message. */
export function stopPlayback(): void {
  disposeCurrent();
}
