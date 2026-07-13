import Anthropic from '@anthropic-ai/sdk';

import { buildSystemPrompt, getCharacter, type CharacterId } from '@/src/content/characters';
import { useChatStore, type ChatMessage } from '@/src/store/chat-store';
import { useUserDataStore } from '@/src/store/user-data-store';
import { useUserStore } from '@/src/store/user-store';
import { pendingEventIdsFor } from './events';
import { buildTeamContext } from './team-context';

/**
 * Claude API service — the live conversation layer.
 *
 * Distribution builds talk to Meridian's own proxy (api/claude.js on the
 * Vercel deployment): the SDK's baseURL points at the proxy and its
 * "API key" is a shared app token that only grants access to that capped
 * endpoint — the real Anthropic key lives server-side only. For local
 * development, a direct EXPO_PUBLIC_ANTHROPIC_API_KEY still works as a
 * fallback; never set it in a build handed to anyone else.
 */

/** Model locked in the brief's tech stack (§12). Exported for services that
 *  need to make their own messages.create calls (e.g. workout generation). */
export const MODEL = 'claude-sonnet-4-6';

/** Proxy deployment base URL (e.g. https://meridian.vercel.app). */
function getProxyUrl(): string | undefined {
  return process.env.EXPO_PUBLIC_MERIDIAN_PROXY_URL || undefined;
}

/** Shared app token the proxy checks. Safe-ish in a bundle: it opens the
 *  capped proxy, not the vendor account, and rotating it cuts old builds off. */
function getAppToken(): string | undefined {
  return process.env.EXPO_PUBLIC_MERIDIAN_APP_TOKEN || undefined;
}

/** Dev-only direct key — personal builds without a deployed proxy. */
function getDirectKey(): string | undefined {
  return process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY || undefined;
}

/** True when live conversation can work (proxy configured, or dev key). */
export function isClaudeConfigured(): boolean {
  return Boolean((getProxyUrl() && getAppToken()) || getDirectKey());
}

/** Lazily constructed client so missing config never crashes app start. */
let client: Anthropic | null = null;
export function getClient(): Anthropic {
  if (!client) {
    const proxyUrl = getProxyUrl();
    const appToken = getAppToken();
    const viaProxy = Boolean(proxyUrl && appToken);
    client = new Anthropic({
      apiKey: viaProxy ? appToken : getDirectKey(),
      // The SDK appends /v1/messages to baseURL; vercel.json rewrites that
      // path to the api/claude function.
      baseURL: viaProxy ? proxyUrl : undefined,
      // React Native exposes a window-like global, which trips the SDK's
      // browser guard. With the proxy there's no vendor secret in the
      // client; the dev-key fallback remains an explicit dev-only choice.
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
/** The goal, phrased for the context block. Empty when not set yet. */
function goalSentence(): string {
  const { primaryGoal } = useUserDataStore.getState().userProfile;
  switch (primaryGoal) {
    case 'weight-loss':
      return ' Their goal is weight loss.';
    case 'build-muscle':
      return ' Their goal is building muscle.';
    case 'general-fitness':
      return ' Their goal is general fitness — feeling strong, moving well, staying consistent.';
    default:
      return '';
  }
}

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

  // Whether a workout exists changes what's honest to say. Once the
  // trainer has generated a plan (or the user has trained), the shared
  // context below carries it — telling the character "no programme
  // exists" here would contradict that and make them deny their own work.
  const { programmeState } = useUserDataStore.getState();
  const hasPlan = programmeState.currentPlan !== undefined;
  const hasHistory = (programmeState.recentSessions?.length ?? 0) > 0;
  const trainingClause =
    hasPlan || hasHistory
      ? "Today's workout and recent training appear in the shared context below — those are real; treat them as things you already know and reference them naturally."
      : 'No training programme has been built yet.';

  return `CONTEXT ABOUT THIS USER:\nTheir name is ${userName}.${goalSentence()} You are speaking with them inside the Meridian app right now.\n\nTHEIR MERIDIAN TEAM:\n${teamLines.join('\n')}\nWhen something belongs to a teammate's domain, route to them by name.\n\nWHAT EXISTS SO FAR: No device data (sleep, steps, heart rate) is connected yet. ${trainingClause} If asked about device data that isn't connected, say so plainly — never invent numbers or schedule details that don't exist.`;
}

/** A message in the shape the API expects. */
type ApiMessage = { role: 'user' | 'assistant'; content: string };

/**
 * Converts persisted thread messages to API messages: drop error bubbles
 * (UI state, not conversation) and start at the first user turn (the API
 * requires the first message to be from the user).
 */
function toApiMessages(history: ChatMessage[]): ApiMessage[] {
  const messages: ApiMessage[] = history
    .filter((m) => !m.error)
    .map((m) => ({ role: m.role, content: m.text }));
  const firstUserIndex = messages.findIndex((m) => m.role === 'user');
  return firstUserIndex >= 0 ? messages.slice(firstUserIndex) : [];
}

/**
 * Assembles the full system prompt: character voice, then who the user is,
 * then the shared team memory (what they've told everyone else). The team
 * block reads all threads from the store so no caller has to pass it in;
 * it's omitted entirely when there's nothing shared.
 *
 * Exported so other Claude-backed services (e.g. workout generation) get
 * the same team-aware context without re-implementing the assembly.
 */
export function buildSystem(characterId: CharacterId, userName: string): string {
  const character = getCharacter(characterId);
  const { hasHydrated: _dataHydrated, ...userData } = useUserDataStore.getState();
  const teamContext = buildTeamContext(
    characterId,
    useChatStore.getState().threads,
    userName,
    userData,
  );
  const sections = [buildSystemPrompt(character), buildUserContext(userName)];
  if (teamContext) {
    sections.push(teamContext);
  }
  return sections.join('\n\n---\n\n');
}

/** Runs one messages.create call and returns the joined text, or throws. */
async function requestText(
  characterId: CharacterId,
  userName: string,
  apiMessages: ApiMessage[],
): Promise<string> {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: buildSystem(characterId, userName),
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

/** A character's reply plus any tappable answers they suggested. */
export interface CharacterReply {
  text: string;
  /** 0-4 short answers to the question the reply asked, in the user's voice. */
  suggestedReplies: string[];
}

/**
 * The quick-reply side channel: when a character asks a question with a
 * small set of natural answers, they also call this tool so the UI can
 * offer tappable choices. tool_choice stays auto everywhere — prose is
 * never forced through it, and open questions produce no chips.
 */
export const SUGGEST_REPLIES_TOOL: Anthropic.Tool = {
  name: 'suggest_replies',
  description:
    "When your reply asks the user ONE direct question that has a small set of natural answers, also call this with 2-4 short options they could tap instead of typing. Each option must be an answer to your question, phrased in the user's voice (\"Push me\", \"3 days a week\", \"Mostly at home\"), 6 words or fewer. Do NOT call this for open-ended questions, rhetorical questions, or replies that ask nothing.",
  input_schema: {
    type: 'object',
    required: ['replies'] as string[],
    properties: {
      replies: {
        type: 'array',
        items: { type: 'string' },
        description: "2-4 tappable answers in the user's voice, each 6 words or fewer.",
      },
    },
  },
};

/** Validates suggest_replies input — bad entries drop, never throw. */
export function parseSuggestedReplies(input: unknown): string[] {
  const replies = (input as { replies?: unknown })?.replies;
  if (!Array.isArray(replies)) return [];
  return replies
    .filter((r): r is string => typeof r === 'string' && r.trim().length > 0)
    .map((r) => r.trim())
    .slice(0, 4);
}

/** Pulls the suggested replies out of a response, if the tool was called. */
export function extractSuggestedReplies(response: Anthropic.Message): string[] {
  const block = response.content.find(
    (b): b is Anthropic.ToolUseBlock =>
      b.type === 'tool_use' && b.name === SUGGEST_REPLIES_TOOL.name,
  );
  return block ? parseSuggestedReplies(block.input) : [];
}

/**
 * Sends the conversation to Claude and returns the character's reply —
 * text plus any quick-reply suggestions. After a successful reply, marks
 * every pending team event for this character as seen — their reply is
 * the point at which they had a chance to weave the event context in,
 * so it's no longer "pending" for their next turn.
 *
 * @param characterId which specialist is speaking
 * @param history the full thread so far (persisted messages, oldest first)
 * @param userName how the character should address the user
 */
export async function getCharacterReply(
  characterId: CharacterId,
  history: ChatMessage[],
  userName: string,
): Promise<CharacterReply> {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: buildSystem(characterId, userName),
    tools: [SUGGEST_REPLIES_TOOL],
    messages: toApiMessages(history),
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim();
  if (!text) {
    throw new Error('Empty response from model');
  }

  acknowledgePendingEvents(characterId);
  return { text, suggestedReplies: extractSuggestedReplies(response) };
}

/** Marks every event pending for this character as seen. */
function acknowledgePendingEvents(characterId: CharacterId): void {
  const { events, markEventSeen } = useUserDataStore.getState();
  const ids = pendingEventIdsFor(characterId, events);
  for (const id of ids) markEventSeen(id, characterId);
}

/**
 * The ephemeral instruction that produces a warm return greeting. It is
 * appended as the final user turn for the greeting call ONLY — never
 * persisted or shown — so the character greets in-voice without any change
 * to their (validated) system prompt.
 */
const RETURN_GREETING_DIRECTIVE =
  '[The user just re-entered your space after some time away. Greet them back briefly in your own voice — one or two lines. If something from an earlier conversation fits naturally, reference it warmly; if not, a simple hello is enough. Do not interrogate them or force a topic. This is a greeting, not a coaching message.]';

/**
 * Generates a context-aware return greeting using the full prior history,
 * so the specialist can naturally reference earlier conversations ("how'd
 * that meal idea go?"). The directive turn is not part of `history` and is
 * never persisted.
 *
 * @param characterId which specialist is greeting
 * @param history the full prior thread (persisted messages)
 * @param userName how the character should address the user
 */
export async function getReturnGreeting(
  characterId: CharacterId,
  history: ChatMessage[],
  userName: string,
): Promise<string> {
  const apiMessages = [
    ...toApiMessages(history),
    { role: 'user' as const, content: RETURN_GREETING_DIRECTIVE },
  ];
  return requestText(characterId, userName, apiMessages);
}

/**
 * Sends a single ephemeral directive as the user turn and returns the
 * character's reply — no thread history, all context comes from the
 * system prompt (character voice + team context). The generic shape
 * behind proactive messages like Kael's morning brief; reusable for any
 * character's directed note (a future Sera check-in, etc.).
 *
 * @param characterId who is speaking
 * @param userName how to address the user
 * @param directive the (unpersisted, unshown) instruction for this message
 */
export async function getDirectedMessage(
  characterId: CharacterId,
  userName: string,
  directive: string,
): Promise<string> {
  return requestText(characterId, userName, [{ role: 'user', content: directive }]);
}

/**
 * Maps an SDK error to a short, in-character-adjacent notice the thread
 * can show. Detailed diagnostics stay in the console for the developer.
 */
export function describeClaudeError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) {
    return 'This version of Meridian can no longer reach the service — an update may be needed.';
  }
  if (error instanceof Anthropic.RateLimitError) {
    return 'Things are busy right now. Give it a moment, then try again.';
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return 'Could not reach the network. Check your connection and try again.';
  }
  if (error instanceof Anthropic.APIError) {
    return 'The conversation service hit a problem. Try again in a moment.';
  }
  return 'Something went wrong sending that. Try again.';
}
