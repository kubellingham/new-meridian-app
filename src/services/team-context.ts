import { getCharacter, type CharacterId } from '@/src/content/characters';
import type { ChatMessage } from '@/src/store/chat-store';

/**
 * The shared-database MVP (brief §4). Every specialist collects data into a
 * shared picture; consultants sit above it and see across everything. This
 * assembles a compact digest of what the user has told OTHER characters, so
 * the character now speaking has the team's memory — not just their own
 * thread. Without this, each character is a stranger who forgets the rest of
 * the team exists.
 *
 * Visibility follows the brief's lanes:
 *   - Consultants (Kael, Sera) see every other thread — they coordinate.
 *   - Specialists (trainer, NS) see only the consultants' threads — enough
 *     to receive routed context ("Kael flagged X"), without reading a
 *     peer specialist's private domain.
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
 * Builds the "what the user shared with the team" block for `currentId`.
 * Returns an empty string when there's nothing shareable yet, so the caller
 * can omit the section entirely on a fresh account.
 *
 * @param currentId the character about to speak
 * @param threads all persisted conversation threads (from the chat store)
 * @param userName how to refer to the user in the header
 */
export function buildTeamContext(
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
