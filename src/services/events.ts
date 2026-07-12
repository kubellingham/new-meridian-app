/**
 * Team event routing — Collaboration Model §3.2 in code.
 *
 * A specialist emits an event when their decision touches another
 * specialist's domain. The affected specialist(s) pick it up on their
 * next turn via team-context and reference it naturally. Once every
 * character in `to` has appeared in `seenBy`, the event stays in the
 * log for audit but drops out of pending views.
 *
 * Pure functions here — the store is the only thing that mutates. Kept
 * separate from team-context so callers can inspect pending state
 * without building the whole context block.
 */

import type { CharacterId } from '@/src/content/characters';
import type { TeamEvent } from '@/src/types/user-data';

/**
 * Returns events the given character still needs to process — they're
 * in the recipient list AND haven't been marked seen yet — sorted
 * newest last so the most recent decision reads at the bottom of any
 * digest.
 */
export function pendingEventsFor(
  characterId: CharacterId,
  events: readonly TeamEvent[],
): TeamEvent[] {
  return events
    .filter((e) => e.to.includes(characterId) && !e.seenBy.includes(characterId))
    .slice()
    .sort((a, b) => a.at - b.at);
}

/**
 * Convenience for callers that need to acknowledge every pending event
 * for a character at once. Returns the ids to mark, so the caller can
 * pass them through the store's `markEventSeen` action.
 */
export function pendingEventIdsFor(
  characterId: CharacterId,
  events: readonly TeamEvent[],
): string[] {
  return pendingEventsFor(characterId, events).map((e) => e.id);
}

/** Small id helper mirroring makeMessageId — no collision worries. */
export function makeEventId(): string {
  return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
