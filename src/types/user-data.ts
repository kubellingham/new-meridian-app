/**
 * The six-category shared user database — Collaboration Model v1.0 §2.
 *
 * Every specialist reads from and writes to this shape. Categories are
 * distinct so different subsystems can own writes cleanly (setup writes
 * profile; the trainer writes programme state; the NS writes nutrition
 * state; Health Connect writes daily signals; each character writes
 * session feedback; Kael and Sera write pattern flags during their
 * review passes). All fields are optional — real data trickles in from
 * many sources over time, and the schema must survive the meantime.
 */

import type { CharacterId } from '@/src/content/characters';

/** The three V1 goal paths. Everything downstream branches on this. */
export type PrimaryGoal = 'weight-loss' | 'build-muscle' | 'general-fitness';

/** What the user can train with — set by the trainer's first-visit intake. */
export type EquipmentAccess = 'full-gym' | 'home-basics' | 'bodyweight';

/** §2.1 Set during onboarding and specialist intake, rarely changes. */
export interface UserProfile {
  birthday?: string; // ISO date (YYYY-MM-DD)
  gender?: string;
  primaryGoal?: PrimaryGoal;
  culturalBackground?: string; // inferred from NS choice, refined over time
  coachingPreference?: 'push' | 'support' | 'both' | 'read-as-we-go';
  height?: number; // cm
  startingWeight?: number; // kg
  goalWeight?: number; // kg
  activityLevel?: 'sedentary' | 'light' | 'moderate' | 'active';
  /** 'returning' = trained before, coming back after a real break. */
  fitnessExperience?: 'none' | 'returning' | 'some' | 'experienced';
  equipmentAccess?: EquipmentAccess;
  trainingDaysPerWeek?: number;
  /** Where training actually happens — drives equipment questions. */
  trainingPlace?: 'home' | 'gym' | 'outdoors' | 'mix';
  /** Session length the user says they can sustain, in minutes. */
  sessionLengthMinutes?: number;
  preferredTrainingTime?: 'morning' | 'midday' | 'evening' | 'varies';
  trainingHistory?: string; // free text from trainer intake
  dietaryPattern?: string; // e.g. "West African, jollof-and-egusi baseline"
  allergies?: string[];
  culturalFoodContext?: string; // from NS intake
  injuries?: string[]; // updatable when trainer flags something
  medicalConditions?: string[];
}

/** §2.2 Owned by the trainer, visible to all specialists. */
export interface ProgrammeState {
  currentProgrammeName?: string;
  philosophy?: string;
  weekNumber?: number;
  dayNumber?: number;
  currentBlock?: 'hypertrophy' | 'cutting' | 'deload' | 'maintenance';
  plannedWeeklyVolume?: string; // "3 strength + 2 conditioning"
  scheduledSessions?: string[]; // human-readable summaries
  recentAdjustments?: RecentAdjustment[];
  /** The workout plan the trainer generated for today, if any. */
  currentPlan?: WorkoutPlan;
  /** In-progress or most-recently-abandoned session for today's plan. */
  currentSession?: WorkoutSession;
  /** Completed and abandoned sessions, most recent first. Capped at 10. */
  recentSessions?: WorkoutSession[];
  /**
   * Which trainer has run their first-time intake. Relationship-scoped:
   * a newly picked trainer runs THEIR intake even when the facts are
   * already on file — the questions are theirs, in their voice.
   */
  intakeCompletedBy?: CharacterId;
}

/** §2.3 Owned by the NS, visible to all specialists. */
export interface NutritionState {
  calorieTarget?: number;
  macroTargets?: { proteinG?: number; carbsG?: number; fatsG?: number };
  dietaryPatternNotes?: string;
  strictAvoidances?: string[]; // allergies + user-declared no-gos
  mealTimingPreferences?: string;
  hydrationBaselineMl?: number;
  recentAdjustments?: RecentAdjustment[];
}

/** §2.4 Updated continuously; everyone reads. */
export interface DailySignals {
  lastSleepHours?: number;
  lastSleepQuality?: 'poor' | 'okay' | 'good';
  restingHeartRate?: number;
  hrv?: number;
  todaySteps?: number;
  workoutCompletedToday?: boolean;
  mealsLoggedToday?: number;
  waterMl?: number;
  currentWeight?: number; // kg, most recent log
  lastMoodCheckIn?: { at: number; mood: 'good' | 'okay' | 'off'; note?: string };
}

/** A single entry in one of the feedback streams — bounded, uniform shape. */
export interface FeedbackEntry {
  at: number; // epoch ms
  from: CharacterId | 'user';
  text: string;
}

/** §2.5 Owned by whoever collected it, visible to all. */
export interface SessionFeedback {
  postWorkoutComments?: FeedbackEntry[];
  preWorkoutCheckIns?: FeedbackEntry[];
  warmupDiagnostic?: FeedbackEntry[];
  postMealReactions?: FeedbackEntry[];
  emotionalCheckIns?: FeedbackEntry[];
  freeText?: FeedbackEntry[];
}

/** §2.6 Calculated by Kael/Sera during daily review. Interpretations, not raw. */
export interface PatternFlag {
  id: string;
  at: number; // epoch ms of detection
  category: 'symptom' | 'behavior' | 'sleep' | 'engagement' | 'emotional' | 'plateau';
  description: string;
  raisedBy: 'kael' | 'sera';
}

/** A recent domain-changing decision by any specialist, kept as a short trail. */
export interface RecentAdjustment {
  at: number;
  by: CharacterId;
  summary: string;
}

/**
 * Trainer-owned workout types. The `WorkoutPlan` is what the trainer
 * prescribes for a day; the `WorkoutSession` is what the user actually
 * performed. Two distinct shapes because "planned" and "logged" diverge
 * as soon as the user starts training — different loads, missed sets,
 * skipped exercises, added ones. Keeping them separate lets the trainer
 * see prescription vs. reality when generating the next plan.
 */

export type ExerciseCategory =
  | 'strength'
  | 'conditioning'
  | 'mobility'
  | 'warm-up'
  | 'cool-down';

/** One exercise the trainer put on today's plan. */
export interface PlannedExercise {
  id: string;
  name: string; // "Back squat", "45s plank"
  category: ExerciseCategory;
  targetSets: number;
  targetReps: string; // "8-10", "12", "45s" — allows ranges + timed holds
  targetLoad?: string; // "60 kg", "Bodyweight", "5-7 RPE"
  restSeconds?: number;
  cue?: string; // Trainer's coaching cue for the exercise, in their voice
  note?: string; // Conditional instruction ("skip if lower back tight")
}

/** Today's prescription from the trainer. Empty `exercises` = rest day. */
export interface WorkoutPlan {
  id: string;
  createdAt: number;
  forDate: string; // ISO local date, YYYY-MM-DD
  createdBy: CharacterId;
  focusArea: string; // "Lower body strength"
  estimatedMinutes: number;
  intent: string; // Trainer's one-line reasoning, in voice
  exercises: PlannedExercise[];
}

/** One logged set inside an exercise. */
export interface SetLog {
  setNumber: number;
  weight?: number; // kg
  reps?: number;
  durationSeconds?: number;
  note?: string;
}

/** All logs for one prescribed exercise inside a session. */
export interface ExerciseLog {
  plannedExerciseId: string;
  name: string; // denormalized so history stays readable if the plan is gone
  status: 'pending' | 'in-progress' | 'completed' | 'skipped';
  sets: SetLog[];
  note?: string;
}

/**
 * NS-owned food-logging types. A `FoodItem` is the nutritional identity
 * of a food (per serving); a `LoggedFood` is one instance of eating it —
 * when, which meal, how many servings, and where the data came from.
 * Separate shapes so a database/barcode item can be logged repeatedly
 * without duplicating its nutrition facts.
 */

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

/** How an entry got into the log — shapes trust and edit affordances. */
export type FoodSource = 'manual' | 'chat' | 'photo' | 'barcode' | 'database';

/** The measurable unit a food's serving is expressed in. */
export type ServingUnit = 'g' | 'ml';

/** The nutritional identity of one food, per serving. */
export interface FoodItem {
  name: string;
  brand?: string;
  servingDescription?: string; // "1 plate", "100 g", "1 medium"
  /** Unit + sizes let the portion UI offer honest choices (a drink is
   *  drunk in ml, not grams). All optional — AI/manual foods have none. */
  servingUnit?: ServingUnit;
  servingQuantity?: number; // one serving, in servingUnit (e.g. 200 ml)
  packageQuantity?: number; // the whole package, in servingUnit (e.g. 500 ml)
  caloriesPerServing: number;
  proteinG?: number;
  carbsG?: number;
  fatsG?: number;
  fiberG?: number;
  sugarG?: number;
  sodiumMg?: number;
  barcode?: string; // set when it came from a scan
}

/** One eaten instance of a food, counted toward a day and a meal. */
export interface LoggedFood {
  id: string;
  loggedAt: number; // epoch ms
  forDate: string; // ISO local date it counts toward (YYYY-MM-DD)
  meal: MealSlot;
  source: FoodSource;
  item: FoodItem;
  servings: number; // multiplier of the item's per-serving values
  note?: string;
  photoUri?: string; // local cache uri for photo logs
}

/** A single workout session — what the user did today. */
export interface WorkoutSession {
  id: string;
  planId: string;
  /** Denormalized from the plan so history stays readable once the plan
   *  is cleared (currentPlan is wiped when a session completes). */
  focusArea?: string;
  startedAt: number;
  completedAt?: number;
  abandonedAt?: number;
  status: 'in-progress' | 'completed' | 'abandoned';
  logs: ExerciseLog[];
  sessionFeeling?: 'strong' | 'okay' | 'flat' | 'rough';
  sessionNote?: string;
}

/**
 * The kinds of decisions that ripple across the team — Collaboration Model
 * §3.2. New kinds get added here as new emitters land; the union stays the
 * source of truth so downstream code (team-context, morning brief) can
 * exhaust it.
 *
 * - programme-block-shift: trainer moved the user between blocks
 *   (cutting → maintenance, etc.); the NS needs to know so macros follow.
 * - macro-target-change: NS made a significant calorie/macro shift; the
 *   trainer needs to know so recovery capacity is right.
 * - injury-flag: trainer or user surfaced a pain / injury; Kael routes,
 *   Sera may follow if there's psychological weight.
 * - emotional-flag: Sera saw wellbeing weight in an ordinary message; Kael
 *   integrates into his next brief.
 * - plateau-detected: Kael flagged a stall from the numbers; the specialist
 *   whose domain owns the plateau owns the response.
 * - goal-milestone: a goal or streak crossed a threshold worth surfacing.
 * - morning-brief: Kael's daily review; scheduled by the periodic timer,
 *   consumed by the Home surface. First real emitter next session.
 */
export type EventKind =
  | 'programme-block-shift'
  | 'macro-target-change'
  | 'injury-flag'
  | 'emotional-flag'
  | 'plateau-detected'
  | 'goal-milestone'
  | 'morning-brief'
  | 'workout-plan-created'
  | 'workout-completed'
  | 'workout-abandoned'
  // Trainer intake: completion summary, and any challenge the trainer
  // raised (Noa's flag-and-proceed, Priya's four-days pushback) with the
  // user's decision — so Kael knows the story if a swap comes up.
  | 'intake-completed'
  | 'intake-concern';

/**
 * A single event: one specialist noted a domain-changing decision, and
 * one or more teammates need to know. Once every character in `to` has
 * appeared in `seenBy`, the event stays in the log but is no longer
 * surfaced in team context (the team has processed it).
 */
export interface TeamEvent {
  id: string;
  at: number; // epoch ms
  from: CharacterId; // who fired the event
  to: CharacterId[]; // whose domain is affected
  kind: EventKind;
  summary: string; // short human-readable line — what the deciding specialist would say
  reasoning?: string; // optional "why" — for the affected specialist to reference in-voice
  seenBy: CharacterId[]; // characters (from `to`) who have processed this event
  /**
   * For events that surface to the USER (e.g. a morning brief) — set once
   * the user has opened it. Undefined means it's still waiting on Home.
   * Distinct from seenBy, which tracks specialist-to-specialist processing.
   */
  deliveredAt?: number;
}

/** The top-level shape held by the store. Categories default to empty objects. */
/** One weigh-in. `forDate` is the local ISO day it counts toward. */
export interface WeightEntry {
  at: number;
  forDate: string;
  kg: number;
  /** Migration seed — "first known weight", not a real weigh-in moment. */
  seeded?: boolean;
}

export interface SharedUserData {
  userProfile: UserProfile;
  programmeState: ProgrammeState;
  nutritionState: NutritionState;
  dailySignals: DailySignals;
  sessionFeedback: SessionFeedback;
  patternFlags: PatternFlag[];
  /** Append-only log of domain-changing decisions across the team. */
  events: TeamEvent[];
  /**
   * Everything the user has eaten, newest last. Pruned to a rolling
   * window (see the store) so AsyncStorage stays bounded.
   */
  foodLog: LoggedFood[];
  /**
   * Weigh-in history, oldest first, one entry per local day (a repeat
   * same-day log replaces). Capped in the store. Drives the rate-of-loss
   * trend on Home and Insights; dailySignals.currentWeight stays the
   * latest entry.
   */
  weightLog: WeightEntry[];
}

/** Default value for a brand-new account — every category present but empty. */
export const EMPTY_SHARED_USER_DATA: SharedUserData = {
  userProfile: {},
  programmeState: {},
  nutritionState: {},
  dailySignals: {},
  sessionFeedback: {},
  patternFlags: [],
  events: [],
  foodLog: [],
  weightLog: [],
};
