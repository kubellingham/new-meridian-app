/**
 * Streak — the "you showed up" counter behind the Home widget. A day
 * counts if the user logged at least one food OR completed a workout on
 * it. The streak is the run of consecutive counted days ending today (or
 * yesterday, so the number doesn't drop to zero the moment midnight
 * passes and before the day's first log). Pure functions over the stores.
 */

import { todayLocalISODate } from '@/src/services/food-log';
import type { LoggedFood, WorkoutSession } from '@/src/types/user-data';

/**
 * The furthest back a streak can be trusted. Food logs are pruned to ~30
 * days and sessions capped at 10, so a longer run can't be proven from
 * what's in memory — we show it as "30+" rather than claim a number the
 * data can't support.
 */
export const STREAK_LOOKBACK_CAP = 30;

/** Local YYYY-MM-DD for an epoch timestamp — same convention as food-log. */
function localISODateFromEpoch(ms: number): string {
  const d = new Date(ms);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Shifts a local ISO date by whole days, staying in local time. */
function addDays(isoDate: string, delta: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** The set of local dates that count — a food log or a completed workout. */
export function activeDates(
  foodLog: readonly LoggedFood[],
  sessions: readonly WorkoutSession[],
): Set<string> {
  const dates = new Set<string>();
  for (const entry of foodLog) dates.add(entry.forDate);
  for (const session of sessions) {
    if (session.status === 'completed' && session.completedAt) {
      dates.add(localISODateFromEpoch(session.completedAt));
    }
  }
  return dates;
}

/**
 * Consecutive counted days ending today — or yesterday, if today has no
 * activity yet (a fresh morning shouldn't read as a broken streak). Zero
 * when neither today nor yesterday counts.
 */
export function currentStreak(
  foodLog: readonly LoggedFood[],
  sessions: readonly WorkoutSession[],
  today: string = todayLocalISODate(),
): number {
  const dates = activeDates(foodLog, sessions);
  if (dates.size === 0) return 0;

  // Anchor on today if it counts, else fall back one day (grace period).
  let cursor = today;
  if (!dates.has(cursor)) {
    cursor = addDays(today, -1);
    if (!dates.has(cursor)) return 0;
  }

  let count = 0;
  while (dates.has(cursor)) {
    count += 1;
    cursor = addDays(cursor, -1);
  }
  return count;
}

/** Home-facing label for a streak count, capped honestly at the lookback. */
export function formatStreak(count: number): string {
  if (count <= 0) return 'Day 1';
  if (count >= STREAK_LOOKBACK_CAP) return `${STREAK_LOOKBACK_CAP}+ days`;
  return count === 1 ? 'Day 1' : `${count} days`;
}
