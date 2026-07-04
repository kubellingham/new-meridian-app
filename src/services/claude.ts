import Anthropic from '@anthropic-ai/sdk';

import { buildSystemPrompt, getCharacter, type CharacterId } from '@/src/content/characters';
import type { ChatMessage } from '@/src/store/chat-store';
import { useUserStore } from '@/src/store/user-store';

/**
 * Claude API service — the live conversation layer.
 *
 * MVP decision (brief §12): the key lives client-side for personal testing
 * only, via EXPO_PUBLIC_ANTHROPIC_API_KEY in .env. A backend proxy is
 * required before any public launch. Prompt caching is deferred (brief §12).
 */

/** Model locked in the brief's tech stack (§12). */
const MODEL = 'claude-sonnet-4-6';

/** Reads the API key from the Expo public env (inlined at build time). */
function getApiKey(): string | undefined {
  return process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY || undefined;
}

/** True when a key is present and live conversation can work. */
export function isClaudeConfigured(): boolean {
  return Boolean(getApiKey());
}

/** Lazily constructed client so a missing key never crashes app start. */
let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({
      apiKey: getApiKey(),
      // React Native exposes a window-like global, which trips the SDK's
      // browser guard. Client-side keys are an explicit MVP-only decision.
      dangerouslyAllowBrowser: true,
    });
  }
  return client;
}

/**
 * Builds the short user-context block appended after the character prompt
 * so replies are personal without any onboarding data model yet. Includes
 * the user's team roster so characters route to teammates by name
 * ("Nneka should see this", not "your nutrition specialist").
 *
 * Team names are read from the user store here — not passed by callers —
 * so every chat surface gets them without changing its call site.
 */
function buildUserContext(userName: string): string {
  const { nsId, trainerId } = useUserStore.getState();
  const teamLines: string[] = [];
  if (nsId) {
    teamLines.push(`Their nutrition specialist is ${getCharacter(nsId).name}.`);
  }
  if (trainerId) {
    teamLines.push(`Their trainer is ${getCharacter(trainerId).name}.`);
  }
  teamLines.push('Kael (operations consultant) and Sera (behavioral consultant) are on every team.');

  return `CONTEXT ABOUT THIS USER:\nTheir name is ${userName}. Their goal is weight loss. You are speaking with them inside the Meridian app right now.\n\nTHEIR MERIDIAN TEAM:\n${teamLines.join('\n')}\nWhen something belongs to a teammate's domain, route to them by name.\n\nWHAT EXISTS SO FAR: No device data (sleep, steps, heart rate) is connected yet, and no training programme has been built yet. If asked about those, say so plainly — never invent numbers or schedule details that don't exist.`;
}

/**
 * Sends the conversation to Claude and returns the character's reply text.
 *
 * @param characterId which specialist is speaking
 * @param history the full thread so far (persisted messages, oldest first)
 * @param userName how the character should address the user
 */
export async function getCharacterReply(
  characterId: CharacterId,
  history: ChatMessage[],
  userName: string,
): Promise<string> {
  const character = getCharacter(characterId);

  // Error bubbles are UI state, not conversation — keep them out of the
  // prompt. The API also requires the first message to be from the user.
  const messages = history
    .filter((m) => !m.error)
    .map((m) => ({ role: m.role, content: m.text }));
  const firstUserIndex = messages.findIndex((m) => m.role === 'user');
  const apiMessages = firstUserIndex >= 0 ? messages.slice(firstUserIndex) : [];

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: `${buildSystemPrompt(character)}\n\n---\n\n${buildUserContext(userName)}`,
    messages: apiMessages,
  });

  // Concatenate text blocks; guard on type per SDK guidance.
  const text = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');

  if (!text) {
    throw new Error('Empty response from model');
  }
  return text;
}

/**
 * Maps an SDK error to a short, in-character-adjacent notice the thread
 * can show. Detailed diagnostics stay in the console for the developer.
 */
export function describeClaudeError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) {
    return 'The API key was rejected. Check EXPO_PUBLIC_ANTHROPIC_API_KEY in your .env file.';
  }
  if (error instanceof Anthropic.RateLimitError) {
    return 'Rate limited right now. Give it a moment, then try again.';
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return 'Could not reach the network. Check your connection and try again.';
  }
  if (error instanceof Anthropic.APIError) {
    return `The conversation service returned an error (${error.status ?? 'unknown'}). Try again.`;
  }
  return 'Something went wrong sending that. Try again.';
}
