import { getCharacter, type CharacterId } from '@/src/content/characters';
import type { ChatMessage } from '@/src/store/chat-store';
import type { SharedUserData } from '@/src/types/user-data';

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
  if (profile.trainingHistory) lines.push(profile.trainingHistory);
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

  return lines;
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
 * Builds the full team-context block for the character now speaking:
 * structured facts + conversation digest. Both parts are optional and
 * gated on having anything to say — the caller can concatenate whatever
 * comes back without worrying about empty sections.
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
  const conversationBlock = buildConversationBlock(currentId, threads, userName);

  return [factsBlock, conversationBlock].filter((b) => b.length > 0).join('\n\n');
}
