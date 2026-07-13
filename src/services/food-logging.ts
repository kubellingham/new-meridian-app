/**
 * AI food logging — the NS turns unstructured input (a sentence, a
 * photo) into structured FoodItems via Claude tool use, without losing
 * their voice. Mirrors workout-generation's pattern: one tool, strict
 * schema, caller stamps metadata.
 *
 * Two entry points:
 *  - chat: tool_choice auto — the NS replies in voice AND logs when the
 *    user actually described eating something.
 *  - photo: an image block + forced tool — the NS looks at the plate,
 *    identifies what's on it, and estimates the numbers.
 */

import type Anthropic from '@anthropic-ai/sdk';

import type { CharacterId } from '@/src/content/characters';
import { buildSystem, getClient, MODEL } from '@/src/services/claude';
import type { ChatMessage } from '@/src/store/chat-store';
import type { FoodItem, MealSlot } from '@/src/types/user-data';

/** One parsed food plus the NS's judgement of servings and meal slot. */
export interface ParsedFood {
  item: FoodItem;
  servings: number;
  meal?: MealSlot;
}

/** Reply text + any foods the NS logged from the input. */
export interface FoodLoggingResult {
  reply: string;
  foods: ParsedFood[];
}

/** The meal slots the tool schema accepts. */
const MEAL_SLOT_VALUES: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

/**
 * The logging tool the NS calls when the user has described (or shown)
 * food. Estimates are per serving; `servings` captures how much of it
 * they ate. Kept flat and forgiving — only name and calories required.
 */
const LOG_FOOD_TOOL: Anthropic.Tool = {
  name: 'log_food',
  description:
    "Record food the user ate. Call this ONLY when the user's latest message describes or shows something they've eaten — never re-log food mentioned earlier in the conversation, and never log hypothetical or future food. Estimate per-serving nutrition honestly; use `servings` for how much they had. One array item per distinct food.",
  input_schema: {
    type: 'object',
    required: ['foods'] as string[],
    properties: {
      foods: {
        type: 'array',
        description: 'Each distinct food that was eaten.',
        items: {
          type: 'object',
          required: ['name', 'caloriesPerServing'] as string[],
          properties: {
            name: { type: 'string', description: 'What the food is, plainly named.' },
            brand: { type: 'string', description: 'Brand, if clearly identifiable.' },
            servingDescription: {
              type: 'string',
              description: 'What one serving means here — "1 plate", "100 g", "1 medium".',
            },
            caloriesPerServing: {
              type: 'number',
              description: 'Estimated calories for one serving.',
            },
            proteinG: { type: 'number', description: 'Protein grams per serving.' },
            carbsG: { type: 'number', description: 'Carb grams per serving.' },
            fatsG: { type: 'number', description: 'Fat grams per serving.' },
            servings: {
              type: 'number',
              description: 'How many servings the user ate. Default 1.',
            },
            meal: {
              type: 'string',
              enum: MEAL_SLOT_VALUES,
              description: 'Which meal this belongs to, if the user made it clear.',
            },
          },
        },
      },
    },
  },
};

/** Raw shape of one tool-call food before validation. */
interface RawFood {
  name?: unknown;
  brand?: unknown;
  servingDescription?: unknown;
  caloriesPerServing?: unknown;
  proteinG?: unknown;
  carbsG?: unknown;
  fatsG?: unknown;
  servings?: unknown;
  meal?: unknown;
}

/** Keeps a number when it's a sane finite value, else undefined. */
function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

/**
 * Validates the tool input into ParsedFoods, dropping malformed items
 * rather than failing the whole log — one bad array entry shouldn't
 * lose the meal.
 */
export function parseFoodsFromToolInput(input: unknown): ParsedFood[] {
  const foods = (input as { foods?: unknown })?.foods;
  if (!Array.isArray(foods)) return [];

  const parsed: ParsedFood[] = [];
  for (const raw of foods as RawFood[]) {
    const name = typeof raw.name === 'string' ? raw.name.trim() : '';
    const calories = num(raw.caloriesPerServing);
    if (!name || calories === undefined) continue;
    parsed.push({
      item: {
        name,
        brand: typeof raw.brand === 'string' ? raw.brand : undefined,
        servingDescription:
          typeof raw.servingDescription === 'string' ? raw.servingDescription : undefined,
        caloriesPerServing: calories,
        proteinG: num(raw.proteinG),
        carbsG: num(raw.carbsG),
        fatsG: num(raw.fatsG),
      },
      servings: num(raw.servings) || 1,
      meal: MEAL_SLOT_VALUES.includes(raw.meal as MealSlot)
        ? (raw.meal as MealSlot)
        : undefined,
    });
  }
  return parsed;
}

/** Pulls reply text + parsed foods out of one API response. */
function extractResult(response: Anthropic.Message): FoodLoggingResult {
  const reply = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
  );
  return {
    reply,
    foods: toolUse ? parseFoodsFromToolInput(toolUse.input) : [],
  };
}

/** Chat history → API messages (same rules as claude.ts, local copy). */
function toApiMessages(history: ChatMessage[]): Anthropic.MessageParam[] {
  const messages = history
    .filter((m) => !m.error)
    .map((m) => ({ role: m.role, content: m.text }));
  const firstUser = messages.findIndex((m) => m.role === 'user');
  return firstUser >= 0 ? messages.slice(firstUser) : [];
}

/**
 * The NS's chat reply with logging switched on: replies in voice, and
 * when the last user turn described eaten food, also calls log_food.
 * tool_choice stays auto so ordinary conversation stays conversation.
 */
export async function getCharacterReplyWithFoodLog(
  characterId: CharacterId,
  history: ChatMessage[],
  userName: string,
): Promise<FoodLoggingResult> {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: buildSystem(characterId, userName),
    tools: [LOG_FOOD_TOOL],
    messages: toApiMessages(history),
  });
  const result = extractResult(response);
  // A tool-only response with no prose would leave the chat silent —
  // give the caller a minimal in-voice fallback to show.
  if (!result.reply && result.foods.length > 0) {
    result.reply = 'Logged that for you.';
  }
  if (!result.reply) {
    throw new Error('Empty response from model');
  }
  return result;
}

/** The directive attached to a plate photo. */
const PHOTO_DIRECTIVE = `[The user is showing you a photo of food they're eating. Look at the plate, identify each distinct food you can actually see, and log it via the log_food tool with honest per-serving estimates. Also reply briefly in your own voice — react to the meal like you would in person. If the photo isn't food or is too unclear to judge, say so plainly and log nothing.]`;

/**
 * Photo logging: the NS looks at the plate. Image goes in as a base64
 * content block; the tool stays available but not forced, so an
 * unreadable photo can come back honestly empty.
 *
 * @param mediaType e.g. 'image/jpeg'
 * @param caption optional user note ("half of this was my wife's")
 */
export async function getFoodFromPhoto(
  characterId: CharacterId,
  userName: string,
  base64: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp',
  caption?: string,
): Promise<FoodLoggingResult> {
  const content: Anthropic.ContentBlockParam[] = [
    {
      type: 'image',
      source: { type: 'base64', media_type: mediaType, data: base64 },
    },
    { type: 'text', text: caption ? `${PHOTO_DIRECTIVE}\n\nUser's note: ${caption}` : PHOTO_DIRECTIVE },
  ];

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: buildSystem(characterId, userName),
    tools: [LOG_FOOD_TOOL],
    messages: [{ role: 'user', content }],
  });
  const result = extractResult(response);
  if (!result.reply && result.foods.length === 0) {
    throw new Error('Empty response from model');
  }
  return result;
}
