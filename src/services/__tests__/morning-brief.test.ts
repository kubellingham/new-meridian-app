/**
 * Dedup + delivery helpers for Kael's morning brief. Pure functions over
 * the events log; the generation call itself is not unit-tested here.
 */

// morning-brief pulls in the Claude service (for generation), which pulls
// in the persisted stores — mock AsyncStorage so the import chain loads.
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

import {
  localDateOf,
  makeMorningBriefEvent,
  todaysBrief,
  undeliveredBrief,
} from '../morning-brief';
import type { TeamEvent } from '@/src/types/user-data';

const DAY = 24 * 60 * 60 * 1000;

function brief(overrides: Partial<TeamEvent> = {}): TeamEvent {
  return {
    id: overrides.id ?? 'b1',
    at: overrides.at ?? Date.now(),
    from: 'kael',
    to: ['kael'],
    kind: 'morning-brief',
    summary: overrides.summary ?? 'Morning. Quiet start — nothing logged yet.',
    seenBy: [],
    deliveredAt: overrides.deliveredAt,
  };
}

describe('localDateOf', () => {
  it('formats a timestamp as local YYYY-MM-DD', () => {
    const d = new Date(2026, 6, 12, 8, 30); // 12 Jul 2026 local
    expect(localDateOf(d.getTime())).toBe('2026-07-12');
  });
});

describe('todaysBrief', () => {
  it('finds a brief created today', () => {
    expect(todaysBrief([brief({ at: Date.now() })])).toBeDefined();
  });

  it('ignores a brief from a previous day', () => {
    expect(todaysBrief([brief({ at: Date.now() - DAY })])).toBeUndefined();
  });

  it('ignores non-brief events', () => {
    const other: TeamEvent = {
      id: 'x',
      at: Date.now(),
      from: 'cassidy',
      to: ['kael'],
      kind: 'workout-completed',
      summary: 'done',
      seenBy: [],
    };
    expect(todaysBrief([other])).toBeUndefined();
  });
});

describe('undeliveredBrief', () => {
  it('returns the newest brief that has not been delivered', () => {
    const events = [
      brief({ id: 'old', at: Date.now() - DAY }),
      brief({ id: 'new', at: Date.now() }),
    ];
    expect(undeliveredBrief(events)?.id).toBe('new');
  });

  it('skips briefs already delivered', () => {
    const events = [brief({ id: 'seen', at: Date.now(), deliveredAt: Date.now() })];
    expect(undeliveredBrief(events)).toBeUndefined();
  });

  it('returns undefined when there are no briefs', () => {
    expect(undeliveredBrief([])).toBeUndefined();
  });
});

describe('makeMorningBriefEvent', () => {
  it('wraps text as a kael morning-brief event, undelivered', () => {
    const e = makeMorningBriefEvent('Morning. Sleep was rough.');
    expect(e.kind).toBe('morning-brief');
    expect(e.from).toBe('kael');
    expect(e.summary).toBe('Morning. Sleep was rough.');
    expect(e.deliveredAt).toBeUndefined();
    expect(e.seenBy).toEqual([]);
  });
});
