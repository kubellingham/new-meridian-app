/**
 * Filtering and ordering rules for team events. Pure functions — no store.
 */

import { pendingEventIdsFor, pendingEventsFor } from '../events';
import type { CharacterId } from '@/src/content/characters';
import type { EventKind, TeamEvent } from '@/src/types/user-data';

/** Builds a compact event for tests. */
function evt(overrides: Partial<TeamEvent> = {}): TeamEvent {
  return {
    id: overrides.id ?? 'e1',
    at: overrides.at ?? 1,
    from: overrides.from ?? 'cassidy',
    to: overrides.to ?? ['nneka'],
    kind: overrides.kind ?? ('programme-block-shift' as EventKind),
    summary: overrides.summary ?? 'pulled volume back this week',
    reasoning: overrides.reasoning,
    seenBy: overrides.seenBy ?? [],
  };
}

describe('pendingEventsFor', () => {
  it('returns events addressed to the character', () => {
    const events = [evt({ id: '1', to: ['nneka'] }), evt({ id: '2', to: ['sera'] })];
    const pending = pendingEventsFor('nneka', events);
    expect(pending.map((e) => e.id)).toEqual(['1']);
  });

  it('supports multiple recipients on a single event', () => {
    const events = [evt({ id: '1', to: ['nneka', 'kael'] })];
    expect(pendingEventsFor('nneka', events).map((e) => e.id)).toEqual(['1']);
    expect(pendingEventsFor('kael', events).map((e) => e.id)).toEqual(['1']);
    expect(pendingEventsFor('sera', events).map((e) => e.id)).toEqual([]);
  });

  it('excludes events the character has already seen', () => {
    const events = [
      evt({ id: '1', to: ['nneka'], seenBy: ['nneka'] }),
      evt({ id: '2', to: ['nneka'], seenBy: [] }),
    ];
    expect(pendingEventsFor('nneka', events).map((e) => e.id)).toEqual(['2']);
  });

  it('still surfaces an event to other recipients even after one has seen it', () => {
    const events = [evt({ id: '1', to: ['nneka', 'kael'], seenBy: ['nneka'] })];
    expect(pendingEventsFor('nneka', events)).toEqual([]);
    expect(pendingEventsFor('kael', events).map((e) => e.id)).toEqual(['1']);
  });

  it('sorts pending events oldest-first so the most recent reads last', () => {
    const events = [
      evt({ id: 'later', to: ['nneka'], at: 200 }),
      evt({ id: 'earlier', to: ['nneka'], at: 100 }),
    ];
    expect(pendingEventsFor('nneka', events).map((e) => e.id)).toEqual([
      'earlier',
      'later',
    ]);
  });

  it('returns an empty array when there are no events at all', () => {
    expect(pendingEventsFor('nneka', [])).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const events = [
      evt({ id: 'b', to: ['nneka'], at: 2 }),
      evt({ id: 'a', to: ['nneka'], at: 1 }),
    ];
    const originalOrder = events.map((e) => e.id);
    pendingEventsFor('nneka', events);
    expect(events.map((e) => e.id)).toEqual(originalOrder);
  });
});

describe('pendingEventIdsFor', () => {
  it('extracts the ids of pending events', () => {
    const events = [
      evt({ id: '1', to: ['nneka'] }),
      evt({ id: '2', to: ['nneka'], seenBy: ['nneka'] }),
      evt({ id: '3', to: ['nneka'] }),
    ];
    expect(pendingEventIdsFor('nneka', events)).toEqual(['1', '3']);
  });

  it('returns [] when nothing is pending', () => {
    const events = [evt({ id: '1', to: ['nneka'], seenBy: ['nneka'] })];
    expect(pendingEventIdsFor('nneka', events)).toEqual([]);
  });
});

// The service should stay closed under type narrowing — TS enforces this
// but a small runtime check pins the contract for future refactors.
describe('type contract', () => {
  it('accepts a readonly events array', () => {
    const events: readonly TeamEvent[] = [evt({ id: '1', to: ['nneka'] })];
    const ids: CharacterId[] = ['nneka'];
    expect(pendingEventsFor(ids[0], events)).toHaveLength(1);
  });
});
