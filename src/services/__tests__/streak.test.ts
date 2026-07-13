/**
 * Streak — the "you showed up" counter. Pure functions over the food log
 * and completed sessions; the tricky parts are the today/yesterday grace
 * window and the OR between food and workouts.
 */

import { activeDates, currentStreak, formatStreak, STREAK_LOOKBACK_CAP } from '../streak';
import type { LoggedFood, WorkoutSession } from '@/src/types/user-data';

/** Epoch ms for local midday of a local ISO date — avoids TZ edge slips. */
function middayEpoch(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0).getTime();
}

function food(forDate: string): LoggedFood {
  return {
    id: `f-${forDate}-${Math.random()}`,
    loggedAt: middayEpoch(forDate),
    forDate,
    meal: 'lunch',
    source: 'manual',
    servings: 1,
    item: { name: 'Rice', caloriesPerServing: 400 },
  };
}

function completedSession(onDate: string): WorkoutSession {
  return {
    id: `s-${onDate}`,
    planId: 'p1',
    startedAt: middayEpoch(onDate) - 3600_000,
    completedAt: middayEpoch(onDate),
    status: 'completed',
    logs: [],
  };
}

describe('activeDates', () => {
  it('unions food dates and completed-session dates', () => {
    const dates = activeDates(
      [food('2026-07-10'), food('2026-07-11')],
      [completedSession('2026-07-12')],
    );
    expect([...dates].sort()).toEqual(['2026-07-10', '2026-07-11', '2026-07-12']);
  });

  it('ignores in-progress and abandoned sessions', () => {
    const dates = activeDates(
      [],
      [
        { ...completedSession('2026-07-10'), status: 'in-progress', completedAt: undefined },
        { ...completedSession('2026-07-11'), status: 'abandoned', completedAt: undefined },
      ],
    );
    expect(dates.size).toBe(0);
  });
});

describe('currentStreak', () => {
  const today = '2026-07-13';

  it('counts consecutive days ending today', () => {
    const log = [food('2026-07-11'), food('2026-07-12'), food('2026-07-13')];
    expect(currentStreak(log, [], today)).toBe(3);
  });

  it('grace: today empty but yesterday active still counts', () => {
    const log = [food('2026-07-11'), food('2026-07-12')];
    expect(currentStreak(log, [], today)).toBe(2);
  });

  it('breaks on a gap', () => {
    const log = [food('2026-07-10'), food('2026-07-13')]; // 11 & 12 missing
    expect(currentStreak(log, [], today)).toBe(1);
  });

  it('returns 0 when neither today nor yesterday is active', () => {
    const log = [food('2026-07-01')];
    expect(currentStreak(log, [], today)).toBe(0);
  });

  it('a workout alone keeps the streak alive', () => {
    const streak = currentStreak([food('2026-07-12')], [completedSession('2026-07-13')], today);
    expect(streak).toBe(2);
  });

  it('food and workout on the same day count once', () => {
    const streak = currentStreak([food('2026-07-13')], [completedSession('2026-07-13')], today);
    expect(streak).toBe(1);
  });

  it('returns 0 for no activity at all', () => {
    expect(currentStreak([], [], today)).toBe(0);
  });
});

describe('formatStreak', () => {
  it('frames zero and one as Day 1', () => {
    expect(formatStreak(0)).toBe('Day 1');
    expect(formatStreak(1)).toBe('Day 1');
  });

  it('pluralizes multi-day runs', () => {
    expect(formatStreak(6)).toBe('6 days');
  });

  it('caps at the lookback bound', () => {
    expect(formatStreak(STREAK_LOOKBACK_CAP)).toBe(`${STREAK_LOOKBACK_CAP}+ days`);
    expect(formatStreak(99)).toBe(`${STREAK_LOOKBACK_CAP}+ days`);
  });
});
