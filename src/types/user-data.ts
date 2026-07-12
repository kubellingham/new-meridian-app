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

/** §2.1 Set during onboarding and specialist intake, rarely changes. */
export interface UserProfile {
  birthday?: string; // ISO date (YYYY-MM-DD)
  gender?: string;
  primaryGoal?: 'weight-loss'; // V1 is weight loss only
  culturalBackground?: string; // inferred from NS choice, refined over time
  coachingPreference?: 'push' | 'support' | 'both' | 'read-as-we-go';
  height?: number; // cm
  startingWeight?: number; // kg
  goalWeight?: number; // kg
  activityLevel?: 'sedentary' | 'light' | 'moderate' | 'active';
  fitnessExperience?: 'none' | 'some' | 'experienced';
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
  | 'morning-brief';

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
}

/** The top-level shape held by the store. Categories default to empty objects. */
export interface SharedUserData {
  userProfile: UserProfile;
  programmeState: ProgrammeState;
  nutritionState: NutritionState;
  dailySignals: DailySignals;
  sessionFeedback: SessionFeedback;
  patternFlags: PatternFlag[];
  /** Append-only log of domain-changing decisions across the team. */
  events: TeamEvent[];
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
};
