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
import {
  buildSystem,
  extractSuggestedReplies,
  getClient,
  MODEL,
  SUGGEST_REPLIES_TOOL,
} from '@/src/services/claude';
import type { ChatMessage } from '@/src/store/chat-store';
import type { FoodItem, MealSlot, ServingUnit } from '@/src/types/user-data';

/** One parsed food plus the NS's judgement of servings and meal slot. */
export interface ParsedFood {
  item: FoodItem;
  servings: number;
  meal?: MealSlot;
}

/** Reply text + any foods the NS logged + quick-reply suggestions. */
export interface FoodLoggingResult {
  reply: string;
  foods: ParsedFood[];
  suggestedReplies: string[];
  /**
   * Optional questions the NS asked about what the photo can't show
   * (cooking method, hidden ingredients, oil). Photo path only; always
   * safe to ignore — answering is never required.
   */
  followUps: string[];
}

/**
 * One completed photo-analysis round: what the NS said and logged, and
 * the answers the user gave to its follow-ups (empty until they do).
 * The screen accumulates these so each refinement call can rebuild the
 * whole conversation faithfully.
 */
export interface PhotoExchange {
  reply: string;
  foods: ParsedFood[];
  answers: { question: string; answer: string }[];
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

/** Follow-up questions cap — a chat, not an interrogation. */
const MAX_FOLLOWUPS = 3;

/**
 * Lets the NS ask about what the photo can't show. Available on the
 * photo path only; the schema keeps questions short and few, and the
 * directive makes clear that asking nothing is fine.
 */
const ASK_FOLLOWUPS_TOOL: Anthropic.Tool = {
  name: 'ask_followups',
  description:
    "Ask the user short follow-up questions ONLY about details you genuinely could not see in the photo and that would meaningfully change the nutrition estimate — cooking method, oil or butter used, hidden ingredients (cheese, sauces, fillings), or how much of the plate they actually ate. Never ask about what is plainly visible, and ask nothing when the estimate is already solid.",
  input_schema: {
    type: 'object',
    required: ['questions'] as string[],
    properties: {
      questions: {
        type: 'array',
        description: `Up to ${MAX_FOLLOWUPS} short, specific questions.`,
        items: { type: 'string' },
      },
    },
  },
};

/** Validates ask_followups input — strings only, trimmed, capped. */
export function parseFollowUpsFromToolInput(input: unknown): string[] {
  const questions = (input as { questions?: unknown })?.questions;
  if (!Array.isArray(questions)) return [];
  return questions
    .filter((q): q is string => typeof q === 'string' && q.trim().length > 0)
    .map((q) => q.trim())
    .slice(0, MAX_FOLLOWUPS);
}

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

/** Pulls reply text + parsed foods + suggestions out of one API response. */
function extractResult(response: Anthropic.Message): FoodLoggingResult {
  const reply = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
  // Match tool blocks by name — with several tools aboard, "first
  // tool_use" is no longer guaranteed to be the food log.
  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'log_food',
  );
  const followUpsUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'ask_followups',
  );
  return {
    reply,
    foods: toolUse ? parseFoodsFromToolInput(toolUse.input) : [],
    suggestedReplies: extractSuggestedReplies(response),
    followUps: followUpsUse ? parseFollowUpsFromToolInput(followUpsUse.input) : [],
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
    tools: [LOG_FOOD_TOOL, SUGGEST_REPLIES_TOOL],
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
const PHOTO_DIRECTIVE = `[The user is showing you a photo of food they're eating. Look at the plate, identify each distinct food you can actually see, and log it via the log_food tool with honest per-serving estimates. Also reply briefly in your own voice — react to the meal like you would in person. If the photo isn't food or is too unclear to judge, say so plainly and log nothing. If something you can't see would meaningfully change the numbers — how it was cooked, oil or butter, hidden cheese/sauce/fillings, how much of it they'll actually eat — ask via the ask_followups tool. Answering is optional for the user, so your logged estimate must already be your honest best guess without the answers.]`;

/** The directive for a refinement turn, after the user answered. */
const REFINE_DIRECTIVE = `[The user answered some of your questions about the same plate — their answers are below. Rework your estimate with what you now know and call log_food again with the COMPLETE corrected list: it fully replaces what you logged before, so include every food on the plate, updated. Reply in one or two sentences in your own voice about what changed (or that nothing did). Only use ask_followups again if something still unseen would genuinely change the numbers.]`;

/**
 * Renders one round's logged foods as plain text for the rebuilt
 * conversation — keeps the assistant turns free of tool_use blocks (no
 * tool_result pairing needed) while the model still sees its own
 * previous numbers.
 */
function describeFoods(foods: ParsedFood[]): string {
  if (foods.length === 0) return '(logged nothing)';
  return foods
    .map((f) => {
      const macros = [
        f.item.proteinG !== undefined ? `protein ${f.item.proteinG} g` : null,
        f.item.carbsG !== undefined ? `carbs ${f.item.carbsG} g` : null,
        f.item.fatsG !== undefined ? `fat ${f.item.fatsG} g` : null,
      ]
        .filter(Boolean)
        .join(', ');
      const per = f.item.servingDescription ?? 'serving';
      return `- ${f.item.name}: ${f.item.caloriesPerServing} kcal per ${per}${macros ? ` (${macros})` : ''}, servings: ${f.servings}`;
    })
    .join('\n');
}

/** One round's Q&A as a plain user-turn payload. */
function describeAnswers(answers: PhotoExchange['answers']): string {
  return answers.map((a) => `Q: ${a.question}\nA: ${a.answer}`).join('\n\n');
}

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
    tools: [LOG_FOOD_TOOL, ASK_FOLLOWUPS_TOOL],
    messages: [{ role: 'user', content }],
  });
  const result = extractResult(response);
  if (!result.reply && result.foods.length === 0) {
    throw new Error('Empty response from model');
  }
  return result;
}

/**
 * The label-reading tool — for a photo of a product's printed nutrition
 * table, not a plate. Values are transcribed on the label's own basis;
 * the parser converts to a FoodItem. The database is often wrong or
 * incomplete for regional products (a reformulated soda at 28 kcal/100ml
 * listed as 49); the label in the user's hand is the ground truth.
 */
const READ_LABEL_TOOL: Anthropic.Tool = {
  name: 'read_label',
  description:
    "Transcribe the nutrition facts printed on the product label in the photo. Report ONLY values you can actually read — never estimate, never fill gaps from memory of similar products. Use the label's own basis (per 100 g/ml or per serving) and its own serving size. If the label is too blurry or cut off to read, don't call this tool.",
  input_schema: {
    type: 'object',
    required: ['basis', 'calories'] as string[],
    properties: {
      productName: { type: 'string', description: 'Product name, if printed and readable.' },
      basis: {
        type: 'string',
        enum: ['per-100', 'per-serving'],
        description: 'Which basis the reported values use, exactly as the label states them.',
      },
      servingUnit: {
        type: 'string',
        enum: ['g', 'ml'],
        description: 'The unit the label measures in (ml for drinks).',
      },
      servingQuantity: {
        type: 'number',
        description: 'The label\'s serve size in that unit, e.g. 200 for "Serve size: 200 ml".',
      },
      packageQuantity: {
        type: 'number',
        description: 'Net quantity of the whole package in the same unit, if printed.',
      },
      calories: { type: 'number', description: 'Energy in kcal, on the stated basis.' },
      proteinG: { type: 'number', description: 'Protein g, on the stated basis.' },
      carbsG: { type: 'number', description: 'Carbohydrate g, on the stated basis.' },
      fatsG: { type: 'number', description: 'Total fat g, on the stated basis.' },
      sugarG: { type: 'number', description: 'Total sugars g, on the stated basis.' },
      fiberG: { type: 'number', description: 'Fiber g, on the stated basis.' },
      sodiumMg: { type: 'number', description: 'Sodium mg, on the stated basis.' },
    },
  },
};

/**
 * read_label tool input → a FoodItem on the app's model: per-serving
 * values with the measure captured in the unit fields. A per-100 basis
 * becomes the familiar "100 g / 100 ml" pseudo-serving; a per-serving
 * basis uses the label's own serve size. Returns null when the call
 * carries no usable calories. Exported for tests.
 */
export function parseLabelFromToolInput(
  input: unknown,
  fallbackName: string,
): FoodItem | null {
  const raw = (input ?? {}) as Record<string, unknown>;
  const calories = num(raw.calories);
  if (calories === undefined) return null;
  const unit: ServingUnit | undefined =
    raw.servingUnit === 'g' || raw.servingUnit === 'ml' ? raw.servingUnit : undefined;
  const servingQty = num(raw.servingQuantity);
  const perServing = raw.basis === 'per-serving' && servingQty !== undefined && unit !== undefined;
  const name =
    typeof raw.productName === 'string' && raw.productName.trim()
      ? raw.productName.trim()
      : fallbackName;
  // A per-serving basis without a measurable serve size can't be placed
  // on any unit scale — keep it an unstructured "1 serving" rather than
  // mislabeling it per-100.
  const shape =
    raw.basis === 'per-serving'
      ? perServing
        ? {
            servingDescription: `${servingQty} ${unit}`,
            servingUnit: unit,
            servingQuantity: servingQty,
          }
        : { servingDescription: '1 serving', servingUnit: undefined, servingQuantity: undefined }
      : {
          servingDescription: `100 ${unit ?? 'g'}`,
          servingUnit: unit ?? ('g' as ServingUnit),
          servingQuantity: 100,
        };
  return {
    name,
    ...shape,
    packageQuantity: num(raw.packageQuantity),
    caloriesPerServing: calories,
    proteinG: num(raw.proteinG),
    carbsG: num(raw.carbsG),
    fatsG: num(raw.fatsG),
    sugarG: num(raw.sugarG),
    fiberG: num(raw.fiberG),
    sodiumMg: num(raw.sodiumMg),
  };
}

/** The directive attached to a nutrition-label photo. */
const LABEL_DIRECTIVE = `[The user is showing you a photo of a packaged product's printed nutrition label{NAME} because the food database's numbers look wrong. Read the actual printed table and report it via the read_label tool — transcribe, don't estimate, and never fill gaps from memory of similar products. Use the label's own basis and serve size. Then reply with ONE short sentence in your own voice saying what you read. If the label is too blurry or cut off, say so plainly and call no tool.]`;

/** What a label read returns: the transcribed item (or null) + the NS's line. */
export interface LabelReadResult {
  item: FoodItem | null;
  reply: string;
}

/**
 * The NS reads a product's printed nutrition label from a photo. The
 * returned item carries NO barcode — the caller stamps it (the label
 * photo doesn't prove which barcode it belongs to; the scan does).
 */
export async function getFoodFromLabel(
  characterId: CharacterId,
  userName: string,
  base64: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp',
  productName?: string,
): Promise<LabelReadResult> {
  const directive = LABEL_DIRECTIVE.replace(
    '{NAME}',
    productName ? ` (the product is "${productName}")` : '',
  );
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: buildSystem(characterId, userName),
    tools: [READ_LABEL_TOOL],
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: directive },
        ],
      },
    ],
  });
  const reply = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'read_label',
  );
  const item = toolUse ? parseLabelFromToolInput(toolUse.input, productName ?? 'Scanned item') : null;
  if (!item && !reply) throw new Error('Empty response from model');
  return { item, reply };
}

/**
 * Builds the message list for a refinement turn: the original image +
 * directive, then each completed round as plain text (assistant: reply
 * + logged list; user: refine directive + answers). The last exchange
 * must carry the newly-given answers. Exported for tests.
 */
export function buildRefineMessages(
  base64: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp',
  exchanges: PhotoExchange[],
): Anthropic.MessageParam[] {
  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
        { type: 'text', text: PHOTO_DIRECTIVE },
      ],
    },
  ];
  for (const exchange of exchanges) {
    messages.push({
      role: 'assistant',
      content: `${exchange.reply}\n\nLogged:\n${describeFoods(exchange.foods)}`,
    });
    messages.push({
      role: 'user',
      content: `${REFINE_DIRECTIVE}\n\n${describeAnswers(exchange.answers)}`,
    });
  }
  return messages;
}

/**
 * Refinement: the NS reconsiders the same plate with the user's answers
 * to its follow-up questions. `exchanges` is every completed round so
 * far (oldest first), each with the answers the user gave; the returned
 * foods fully REPLACE the previous round's list.
 */
export async function refineFoodFromPhoto(
  characterId: CharacterId,
  userName: string,
  base64: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp',
  exchanges: PhotoExchange[],
): Promise<FoodLoggingResult> {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: buildSystem(characterId, userName),
    tools: [LOG_FOOD_TOOL, ASK_FOLLOWUPS_TOOL],
    messages: buildRefineMessages(base64, mediaType, exchanges),
  });
  const result = extractResult(response);
  if (!result.reply && result.foods.length === 0) {
    throw new Error('Empty response from model');
  }
  return result;
}
