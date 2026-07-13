/**
 * Workout plan generation — Trainer's Claude tool-use call.
 *
 * The trainer composes a structured `WorkoutPlan` in a single API call
 * via a forced tool. The trainer's system prompt (their voice) and the
 * usual team context both go in; the JSON schema in the tool constrains
 * the shape without constraining the voice. `intent` and per-exercise
 * `cue`s are still the trainer speaking — nothing is templated.
 *
 * Rest day handling is baked into the directive: the trainer can submit
 * an empty exercises list with a rest-day `intent`. One code path handles
 * both training and recovery days.
 */

import type Anthropic from '@anthropic-ai/sdk';

import type { CharacterId } from '@/src/content/characters';
import { buildSystem, getClient, MODEL } from '@/src/services/claude';
import { buildProgressionDigest } from '@/src/services/workout-progression';
import { useUserDataStore } from '@/src/store/user-data-store';
import type { ExerciseCategory, WorkoutPlan } from '@/src/types/user-data';

/** Local ISO date (YYYY-MM-DD) — used to stamp `forDate` and dedup per day. */
export function todayLocalISODate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Small id helper for plans and their per-exercise ids. */
function makePlanId(): string {
  return `plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
function makePlannedExerciseId(index: number): string {
  return `ex-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 5)}`;
}

/**
 * The ephemeral directive the trainer sees as the user's turn. Speaks to
 * them as themselves — reference the shared data, choose load and volume,
 * hand-off if a rest day. Not persisted; not shown; never modified.
 */
const GENERATE_PLAN_DIRECTIVE = `[Compose today's workout for the user and submit it via the submit_workout_plan tool.

Use your voice for the intent line and for every per-exercise cue — this is you speaking, not a template. Match load, volume, and choice of exercises to what you know about the user and their recent training. If they've been progressing, take the next honest step; if the picture calls for holding steady or backing off, do that.

If today should be a rest day, submit an empty exercises list with an intent that explains why in your voice.

Keep the plan realistic for the estimated minutes. Cue exercises briefly — one clear thing per cue.]`;

/** The categories the tool schema accepts — mirrored from the type union. */
const EXERCISE_CATEGORIES: ExerciseCategory[] = [
  'strength',
  'conditioning',
  'mobility',
  'warm-up',
  'cool-down',
];

/**
 * The tool the trainer must call. The schema names each field so Claude
 * fills the right shape; descriptions carry the intent. Fields the caller
 * stamps (id, createdAt, forDate, createdBy) are NOT in the schema — the
 * trainer decides the plan, we own the metadata.
 */
const WORKOUT_PLAN_TOOL: Anthropic.Tool = {
  name: 'submit_workout_plan',
  description:
    "Submit today's workout plan for this user. Return the plan whether it's a training day or a rest day — a rest day is signalled by an empty exercises list plus a rest-day intent.",
  input_schema: {
    type: 'object',
    required: ['focusArea', 'estimatedMinutes', 'intent', 'exercises'] as string[],
    properties: {
      focusArea: {
        type: 'string',
        description:
          'One short label for what today is — "Lower body strength", "Full body conditioning", "Recovery day", etc.',
      },
      estimatedMinutes: {
        type: 'integer',
        description:
          'Rough time the whole session should take. 0 is acceptable on a rest day.',
      },
      intent: {
        type: 'string',
        description:
          "Your one-line reasoning for today, in your own voice. The user will read this at the top of the plan. Short, honest, in-character. On a rest day, explain why briefly.",
      },
      exercises: {
        type: 'array',
        description:
          'The exercises to perform in order. Leave empty for a rest day.',
        items: {
          type: 'object',
          required: ['name', 'category', 'targetSets', 'targetReps'] as string[],
          properties: {
            name: { type: 'string', description: 'Exercise name.' },
            category: {
              type: 'string',
              enum: EXERCISE_CATEGORIES,
              description: 'What kind of movement this is.',
            },
            targetSets: {
              type: 'integer',
              description: 'How many sets to perform.',
              minimum: 1,
            },
            targetReps: {
              type: 'string',
              description:
                'Reps as a string so ranges and timed holds both work — "8-10", "12", "45s".',
            },
            targetLoad: {
              type: 'string',
              description:
                'Optional load target — "60 kg", "Bodyweight", "5-7 RPE", "Same as last week".',
            },
            restSeconds: {
              type: 'integer',
              description: 'Optional rest between sets, in seconds.',
              minimum: 0,
            },
            cue: {
              type: 'string',
              description:
                'One short coaching cue for this exercise, in your voice. Skip if nothing worth saying.',
            },
            note: {
              type: 'string',
              description:
                'Optional conditional instruction ("skip if lower back tight").',
            },
          },
        },
      },
    },
  },
};

/** The subset of the plan Claude returns (before we stamp metadata). */
interface WorkoutPlanInput {
  focusArea: string;
  estimatedMinutes: number;
  intent: string;
  exercises: Array<{
    name: string;
    category: ExerciseCategory;
    targetSets: number;
    targetReps: string;
    targetLoad?: string;
    restSeconds?: number;
    cue?: string;
    note?: string;
  }>;
}

/** Extracts the tool_use block from a response; throws with detail if absent. */
function extractPlanInput(response: unknown): WorkoutPlanInput {
  const content = (response as { content?: unknown }).content;
  if (!Array.isArray(content)) {
    throw new Error('Unexpected response shape from model — no content array');
  }
  const toolUse = content.find(
    (block): block is { type: 'tool_use'; name: string; input: unknown } =>
      typeof block === 'object' &&
      block !== null &&
      (block as { type?: unknown }).type === 'tool_use',
  );
  if (!toolUse) {
    throw new Error(
      "Trainer replied without calling submit_workout_plan. That shouldn't happen — check the tool_choice.",
    );
  }
  return toolUse.input as WorkoutPlanInput;
}

/**
 * Generates today's workout plan by calling Claude with the trainer's
 * voice + shared context, forcing the plan-submission tool.
 *
 * @param trainerId which trainer is composing the plan
 * @param userName how the trainer should address the user
 */
export async function generateWorkoutPlan(
  trainerId: CharacterId,
  userName: string,
): Promise<WorkoutPlan> {
  // The per-exercise progression digest is generation-specific detail —
  // it rides on the directive rather than every character's context, so
  // only the trainer composing a plan pays the tokens for it.
  const digest = buildProgressionDigest(
    useUserDataStore.getState().programmeState.recentSessions,
  );
  const directive = digest
    ? `${GENERATE_PLAN_DIRECTIVE}\n\n${digest}`
    : GENERATE_PLAN_DIRECTIVE;

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: buildSystem(trainerId, userName),
    tools: [WORKOUT_PLAN_TOOL],
    tool_choice: { type: 'tool', name: 'submit_workout_plan' },
    messages: [{ role: 'user', content: directive }],
  });

  const input = extractPlanInput(response);
  const now = Date.now();

  return {
    id: makePlanId(),
    createdAt: now,
    forDate: todayLocalISODate(),
    createdBy: trainerId,
    focusArea: input.focusArea,
    estimatedMinutes: input.estimatedMinutes,
    intent: input.intent,
    exercises: input.exercises.map((ex, i) => ({
      id: makePlannedExerciseId(i),
      name: ex.name,
      category: ex.category,
      targetSets: ex.targetSets,
      targetReps: ex.targetReps,
      targetLoad: ex.targetLoad,
      restSeconds: ex.restSeconds,
      cue: ex.cue,
      note: ex.note,
    })),
  };
}
