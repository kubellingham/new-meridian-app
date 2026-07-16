import { getCharacter, type CharacterId } from '@/src/content/characters';
import type { ChatMessage } from '@/src/store/chat-store';
import type {
  SharedUserData,
  TeamEvent,
  WorkoutSession,
} from '@/src/types/user-data';
import { pendingEventsFor } from './events';
import { dailyTotals, entriesForDate, todayLocalISODate } from './food-log';

/**
 * The shared-database MVP (brief §4, Collaboration Model §2). Every
 * specialist collects data into a shared picture; consultants sit above
 * it and see across everything. This assembles two blocks for the
 * character now speaking:
 *
 *  1. Structured facts the team has come to know (birthday, height, goal
 *     weight, dietary pattern, current programme, etc.) — from
 *     `useUserDataStore`.
 *  2. Recent turns from OTHER threads the character is allowed to see.
 *
 * Both are framed as things this character already knows from working
 * with the team — never as a database or record lookup. That framing
 * matters: the moment a specialist says "your records show," we've
 * broken the illusion of a real team.
 *
 * Visibility follows the brief's lanes:
 *   - Consultants (Kael, Sera) see every other thread — they coordinate.
 *   - Specialists (trainer, NS) see only the consultants' threads —
 *     enough to receive routed context ("Kael flagged X"), without
 *     reading a peer specialist's private domain.
 * The structured facts (block 1) are visible to everyone: they are the
 * team's shared picture of the user.
 */

/** Last N messages pulled from each visible thread — bounds token growth. */
const MAX_MESSAGES_PER_THREAD = 6;
/** Per-message character cap so one long message can't dominate the block. */
const MAX_CHARS_PER_MESSAGE = 300;

/** Decides whether `viewer` is allowed to see `other`'s thread. */
function canSee(viewerId: CharacterId, otherId: CharacterId): boolean {
  if (viewerId === otherId) return false; // own thread is already in `messages`
  const viewerRole = getCharacter(viewerId).role;
  const otherRole = getCharacter(otherId).role;
  if (viewerRole === 'consultant') return true; // consultants see everything
  return otherRole === 'consultant'; // specialists see only consultant threads
}

/** Trims a message to a single bounded line for the digest. */
function condense(message: ChatMessage): string {
  const text = message.text.replace(/\s+/g, ' ').trim();
  const clipped =
    text.length > MAX_CHARS_PER_MESSAGE ? `${text.slice(0, MAX_CHARS_PER_MESSAGE)}…` : text;
  return clipped;
}

/**
 * Builds a small list of prose facts from the shared user data. Only
 * fields with values are shown, so early on the block is short and
 * grows naturally as intake surfaces contribute more.
 */
function shareableFacts(data: SharedUserData): string[] {
  const lines: string[] = [];
  const profile = data.userProfile;
  const programme = data.programmeState;
  const nutrition = data.nutritionState;

  if (profile.primaryGoal === 'weight-loss') {
    const target = profile.goalWeight ? ` aiming for around ${profile.goalWeight} kg` : '';
    lines.push(`goal is weight loss${target}`.trim());
  } else if (profile.primaryGoal === 'build-muscle') {
    const target = profile.goalWeight ? ` aiming for around ${profile.goalWeight} kg` : '';
    lines.push(`goal is building muscle${target}`.trim());
  } else if (profile.primaryGoal === 'general-fitness') {
    lines.push('goal is general fitness — strength, movement, consistency');
  }

  // Physical baselines grouped so they read like a single glance.
  const physical: string[] = [];
  if (profile.height) physical.push(`${profile.height} cm tall`);
  if (profile.birthday) physical.push(`born ${profile.birthday}`);
  if (profile.activityLevel) physical.push(`activity level ${profile.activityLevel}`);
  if (physical.length > 0) lines.push(physical.join(', '));

  if (profile.startingWeight) {
    lines.push(`starting weight was around ${profile.startingWeight} kg`);
  }
  if (profile.gender) lines.push(`gender ${profile.gender}`);
  if (profile.fitnessExperience) {
    lines.push(`fitness experience: ${profile.fitnessExperience}`);
  }
  // Training logistics from the trainer's intake — visible to the whole
  // team so nobody re-asks what the trainer already collected.
  const logistics: string[] = [];
  if (profile.trainingDaysPerWeek) logistics.push(`${profile.trainingDaysPerWeek} days/week`);
  if (profile.sessionLengthMinutes) logistics.push(`~${profile.sessionLengthMinutes} min sessions`);
  if (profile.trainingPlace) logistics.push(`trains ${profile.trainingPlace === 'mix' ? 'in a mix of places' : profile.trainingPlace === 'gym' ? 'at a gym' : profile.trainingPlace === 'home' ? 'at home' : 'outdoors'}`);
  if (profile.preferredTrainingTime && profile.preferredTrainingTime !== 'varies') {
    logistics.push(`usually ${profile.preferredTrainingTime}s`);
  }
  if (logistics.length > 0) lines.push(`training setup: ${logistics.join(', ')}`);
  if (profile.trainingHistory) {
    lines.push(`from their trainer's intake: ${profile.trainingHistory}`);
  }
  if (profile.culturalBackground) {
    lines.push(`cultural context: ${profile.culturalBackground}`);
  }
  if (profile.dietaryPattern) lines.push(`eats: ${profile.dietaryPattern}`);
  if (profile.allergies?.length) {
    lines.push(`allergies / avoid: ${profile.allergies.join(', ')}`);
  }
  if (profile.injuries?.length) {
    lines.push(`injuries to work around: ${profile.injuries.join(', ')}`);
  }
  if (profile.medicalConditions?.length) {
    lines.push(`medical: ${profile.medicalConditions.join(', ')}`);
  }
  if (profile.coachingPreference) {
    lines.push(`prefers a ${profile.coachingPreference} coaching style`);
  }
  // The latest emotional check-in (Sera's onboarding question, and her
  // future in-conversation notes) — her opening thread. Absent when
  // never captured; nothing is faked.
  const checkIns = data.sessionFeedback.emotionalCheckIns;
  if (checkIns && checkIns.length > 0) {
    lines.push(`most recent emotional check-in: "${checkIns[checkIns.length - 1].text}"`);
  }

  if (programme.currentProgrammeName) {
    const block = programme.currentBlock ? `, currently in ${programme.currentBlock}` : '';
    lines.push(`on the ${programme.currentProgrammeName} programme${block}`);
  } else if (programme.currentBlock) {
    lines.push(`training block: ${programme.currentBlock}`);
  }

  if (nutrition.calorieTarget) {
    const macros = nutrition.macroTargets;
    const macroBits: string[] = [];
    if (macros?.proteinG) macroBits.push(`${macros.proteinG}g protein`);
    if (macros?.carbsG) macroBits.push(`${macros.carbsG}g carbs`);
    if (macros?.fatsG) macroBits.push(`${macros.fatsG}g fats`);
    const macroText = macroBits.length > 0 ? ` (${macroBits.join(', ')})` : '';
    lines.push(`calorie target around ${nutrition.calorieTarget}${macroText}`);
  }

  if (data.dailySignals.currentWeight) {
    lines.push(`most recent weight around ${data.dailySignals.currentWeight} kg`);
  }

  // Today's intake so far — what the user has actually eaten, against the
  // target when one exists. This is what lets the NS coach with real
  // numbers, Kael note the day's direction, and Sera see patterns.
  const intakeLine = describeTodaysIntake(data);
  if (intakeLine) lines.push(intakeLine);

  if (data.dailySignals.waterMl !== undefined && data.dailySignals.waterMl > 0) {
    const goal = data.nutritionState.hydrationBaselineMl ?? 2000;
    const toL = (ml: number) => Math.round(ml / 100) / 10;
    lines.push(`water so far today: ${toL(data.dailySignals.waterMl)} of ${toL(goal)} L`);
  }

  // Today's plan (what the trainer prescribed) comes before the history of
  // completed sessions — it's the most current thing the team should know,
  // and it's what lets the trainer answer "why these exercises?" instead of
  // denying a plan they just built.
  const planLine = describeTodaysPlan(data.programmeState);
  if (planLine) lines.push(planLine);

  const trainingLine = describeRecentTraining(data.programmeState.recentSessions);
  if (trainingLine) lines.push(trainingLine);

  return lines;
}

/** Foods named explicitly in the intake line before "+N more". */
const INTAKE_FOODS_NAMED = 5;

/**
 * One line for what's been eaten today — totals against the target, plus
 * the foods by name so the NS can react to the actual meal, not just the
 * math. Empty when nothing's logged today.
 */
function describeTodaysIntake(data: SharedUserData): string {
  const entries = entriesForDate(data.foodLog ?? [], todayLocalISODate());
  if (entries.length === 0) return '';

  const totals = dailyTotals(entries);
  const target = data.nutritionState.calorieTarget;
  const calorieBit =
    target !== undefined
      ? `~${totals.calories} of ${target} kcal`
      : `~${totals.calories} kcal`;
  const macroBit = `(P ${totals.proteinG} / C ${totals.carbsG} / F ${totals.fatsG} g)`;

  const named = entries.slice(0, INTAKE_FOODS_NAMED).map((e) => e.item.name.toLowerCase());
  const extra = entries.length - named.length;
  const foods = extra > 0 ? `${named.join(', ')}, +${extra} more` : named.join(', ');

  return `eaten so far today: ${calorieBit} ${macroBit} — ${foods}`;
}

/** Today's local date (YYYY-MM-DD) for comparing against a plan's forDate. */
function todayISO(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Exercise names to name explicitly before summarizing the rest as a count. */
const PLAN_EXERCISES_NAMED = 8;

/**
 * Describes today's workout plan — the prescription that exists before
 * any set is logged. Attributed to the trainer by name so whoever reads
 * it (the trainer included) knows whose work it is. Empty string when
 * there's no plan for today.
 */
function describeTodaysPlan(programme: SharedUserData['programmeState']): string {
  const plan = programme.currentPlan;
  if (!plan || plan.forDate !== todayISO()) return '';

  const trainer = getCharacter(plan.createdBy).name;

  if (plan.exercises.length === 0) {
    return `${trainer} set today as a rest day (${plan.intent})`;
  }

  const named = plan.exercises.slice(0, PLAN_EXERCISES_NAMED).map((e) => e.name);
  const extra = plan.exercises.length - named.length;
  const nameList = extra > 0 ? `${named.join(', ')}, +${extra} more` : named.join(', ');

  // Reflect where the user is in it — planned, mid-session, or done.
  const session = programme.currentSession;
  let status = 'not started yet';
  if (session && session.status === 'in-progress') {
    const done = session.logs.filter((l) => l.status === 'completed').length;
    status = `underway, ${done} of ${plan.exercises.length} done`;
  }

  return `today's session, built by ${trainer}: ${plan.focusArea} — ${nameList} (${plan.exercises.length} exercises, ~${plan.estimatedMinutes} min), ${status}`;
}

/** How many past sessions surface in the team-context digest. */
const RECENT_TRAINING_DIGEST_MAX = 3;

/**
 * Compact one-line summary of the last N sessions for the facts block.
 * The trainer's own generation call also reads this via the same block,
 * so the shape needs to convey enough to progress load — focus, duration,
 * feel, whether it completed. Empty string when there's nothing to say.
 */
function describeRecentTraining(sessions: WorkoutSession[] | undefined): string {
  if (!sessions || sessions.length === 0) return '';

  const parts = sessions.slice(0, RECENT_TRAINING_DIGEST_MAX).map((s) => {
    const dayLabel = describeDayFromEpoch(s.completedAt ?? s.abandonedAt ?? s.startedAt);
    const focus = s.focusArea?.toLowerCase() ?? sessionFocusHint(s);
    const durationMin =
      s.completedAt && s.startedAt
        ? Math.max(1, Math.round((s.completedAt - s.startedAt) / 60000))
        : undefined;
    const bits: string[] = [`${dayLabel} ${focus}`];
    if (durationMin !== undefined) bits.push(`${durationMin} min`);
    if (s.status === 'abandoned') {
      bits.push('cut short');
    } else if (s.sessionFeeling) {
      bits.push(`felt ${s.sessionFeeling}`);
    }
    return bits.join(' · ');
  });

  return `recent training: ${parts.join('; ')}`;
}

/** Best-effort focus label for a session — falls back to the first exercise. */
function sessionFocusHint(s: WorkoutSession): string {
  const first = s.logs[0]?.name;
  return first ? first.toLowerCase() : 'training';
}

/**
 * Short-form day label ("Mon", "yesterday", "today") from an epoch ms.
 * Kept simple and calendar-day-based; timezone is device local.
 */
function describeDayFromEpoch(at: number): string {
  const then = new Date(at);
  const now = new Date();
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(now) - startOfDay(then)) / (24 * 60 * 60 * 1000));
  if (dayDiff === 0) return 'today';
  if (dayDiff === 1) return 'yesterday';
  if (dayDiff > 1 && dayDiff <= 6) {
    return then.toLocaleDateString('en-US', { weekday: 'short' });
  }
  return then.toISOString().slice(0, 10);
}

/**
 * Builds the "team has come to know" block for the current character.
 * Returns empty string when no structured facts are present yet — the
 * caller omits the section on a fresh account.
 */
function buildFactsBlock(userName: string, data: SharedUserData | undefined): string {
  if (!data) return '';
  const lines = shareableFacts(data);
  if (lines.length === 0) return '';

  const bulleted = lines.map((line) => `- ${line}.`).join('\n');
  return `WHAT YOU'VE COME TO KNOW ABOUT ${userName.toUpperCase()}:\nYou know these things about ${userName} the way anyone on a real team would — from working with them over time. Reference them naturally when they're relevant. Never as if you were reading a chart or looking up a record.\n\n${bulleted}`;
}

/**
 * Builds the "what the user shared with the team" block from recent
 * conversation history. Same voice-safe framing as the facts block —
 * this is what a colleague-who-was-briefed would carry, not a transcript.
 */
function buildConversationBlock(
  currentId: CharacterId,
  threads: Partial<Record<CharacterId, ChatMessage[]>>,
  userName: string,
): string {
  const sections: string[] = [];

  for (const key of Object.keys(threads) as CharacterId[]) {
    if (!canSee(currentId, key)) continue;

    const messages = (threads[key] ?? []).filter((m) => !m.error);
    // Only include threads with real user input — a thread holding just the
    // scripted greeting isn't shared knowledge, it's an unopened door.
    const hasUserInput = messages.some((m) => m.role === 'user');
    if (!hasUserInput) continue;

    const other = getCharacter(key);
    const recent = messages.slice(-MAX_MESSAGES_PER_THREAD);
    const lines = recent.map((m) => {
      const speaker = m.role === 'user' ? userName : other.name;
      return `${speaker}: ${condense(m)}`;
    });
    sections.push(`— With ${other.name}:\n${lines.join('\n')}`);
  }

  if (sections.length === 0) return '';

  return `WHAT ${userName.toUpperCase()} HAS ALREADY SHARED WITH THE TEAM:\nYou all work as one coordinated team and share this context. Reference it naturally when it's relevant — the way a colleague who was already briefed would — never by saying "according to your data" or "your records show." If a teammate already flagged something here, you already know it; don't ask the user to repeat it.\n\n${sections.join('\n\n')}`;
}

/**
 * Builds the "your teammates have asked you to know" block — the
 * pending events for the current character, formatted the same way
 * anyone on a real team would carry a heads-up from a colleague.
 * Empty when there's nothing pending.
 */
function buildEventsBlock(
  currentId: CharacterId,
  events: readonly TeamEvent[] | undefined,
): string {
  if (!events || events.length === 0) return '';
  const pending = pendingEventsFor(currentId, events);
  if (pending.length === 0) return '';

  const lines = pending.map((event) => {
    const source = getCharacter(event.from).name;
    const reasoning = event.reasoning ? ` — ${event.reasoning}` : '';
    return `- ${source}: ${event.summary}${reasoning}`;
  });

  return `RECENT DECISIONS YOUR TEAM HAS ASKED YOU TO KNOW ABOUT:\nYou already heard these through the team the way a colleague on a real team hears things — briefly, in passing, from the person who made the call. Reference them naturally in what you say next; don't repeat them back verbatim, and never say "your file shows" or "your log says."\n\n${lines.join('\n')}`;
}

/**
 * Builds the full team-context block for the character now speaking:
 * structured facts + pending team events + conversation digest. Each
 * part is optional and gated on having anything to say — the caller
 * can concatenate whatever comes back without worrying about empty
 * sections.
 *
 * @param currentId the character about to speak
 * @param threads all persisted conversation threads (from the chat store)
 * @param userName how to refer to the user in the header
 * @param data structured shared user data (from the user-data store).
 *   Optional so existing callers and tests without the store still work.
 */
export function buildTeamContext(
  currentId: CharacterId,
  threads: Partial<Record<CharacterId, ChatMessage[]>>,
  userName: string,
  data?: SharedUserData,
): string {
  const factsBlock = buildFactsBlock(userName, data);
  const eventsBlock = buildEventsBlock(currentId, data?.events);
  const conversationBlock = buildConversationBlock(currentId, threads, userName);

  return [factsBlock, eventsBlock, conversationBlock]
    .filter((b) => b.length > 0)
    .join('\n\n');
}
