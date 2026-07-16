import type { WeightEntry } from '@/src/types/user-data';

/**
 * Weight-trend math for the weight-loss-first surfaces (Home weigh-in
 * caption, Insights "Weight" section). Pure functions over the persisted
 * weightLog — no store, no network, no dates other than what's passed in.
 *
 * Honesty rules baked in:
 * - No weekly rate until there are ≥ 2 entries spanning ≥ 3 days, so the
 *   migration's seeded "first known weight" can never fabricate a rate.
 * - The projection refuses to promise anything on flat, wrong-direction,
 *   or absurdly long trends.
 */

export interface WeightTrend {
  entryCount: number;
  /** Days between the oldest and newest entry (0 for a single entry). */
  spanDays: number;
  latestKg?: number;
  firstKg?: number;
  /** Latest minus first — negative means loss. */
  totalChangeKg?: number;
  /** Change over the trailing 7 / 30 days (undefined without a baseline). */
  delta7?: number;
  delta30?: number;
  /**
   * Average weekly rate (kg/week, negative = losing): least-squares slope
   * over the trailing 28 days of entries. Undefined until the log has
   * ≥ 2 entries spanning ≥ 3 days.
   */
  weeklyRateKg?: number;
}

export type GoalProjection =
  | { kind: 'no-data' }
  | { kind: 'no-goal' }
  | { kind: 'flat' }
  | { kind: 'wrong-direction' }
  | { kind: 'too-far' }
  | { kind: 'date'; date: Date; weeks: number };

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MIN_RATE_SPAN_DAYS = 3;
/** Below this the trend is honest noise, not a direction. */
const FLAT_RATE_KG_PER_WEEK = 0.05;
/** Projections beyond two years are guesses, not plans. */
const MAX_PROJECTION_WEEKS = 104;

/** Parses a local ISO date (YYYY-MM-DD) to a local-midnight timestamp. */
function dayMs(forDate: string): number {
  const [y, m, d] = forDate.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

/** Change between the last entry and the newest entry at least `days` old. */
function trailingDelta(
  sorted: WeightEntry[],
  todayMs: number,
  days: number,
): number | undefined {
  const cutoff = todayMs - days * MS_PER_DAY;
  const latest = sorted[sorted.length - 1];
  // Baseline: the newest entry at or before the cutoff — a real "then".
  const baseline = [...sorted].reverse().find((e) => dayMs(e.forDate) <= cutoff);
  if (!baseline || baseline === latest) return undefined;
  return Math.round((latest.kg - baseline.kg) * 10) / 10;
}

/** Least-squares slope (kg/week) over entries in the trailing window. */
function weeklySlope(sorted: WeightEntry[], todayMs: number): number | undefined {
  const windowStart = todayMs - 28 * MS_PER_DAY;
  const points = sorted
    .filter((e) => dayMs(e.forDate) >= windowStart)
    .map((e) => ({ x: dayMs(e.forDate) / MS_PER_DAY, y: e.kg }));
  if (points.length < 2) return undefined;
  const span = points[points.length - 1].x - points[0].x;
  if (span < MIN_RATE_SPAN_DAYS) return undefined;
  const n = points.length;
  const meanX = points.reduce((s, p) => s + p.x, 0) / n;
  const meanY = points.reduce((s, p) => s + p.y, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.x - meanX) * (p.y - meanY);
    den += (p.x - meanX) ** 2;
  }
  if (den === 0) return undefined;
  const perDay = num / den;
  return Math.round(perDay * 7 * 100) / 100;
}

/** Computes the trend from the persisted log (any order; empty ok). */
export function computeWeightTrend(
  entries: WeightEntry[] | undefined,
  todayISO: string,
): WeightTrend {
  const sorted = [...(entries ?? [])].sort((a, b) => dayMs(a.forDate) - dayMs(b.forDate));
  if (sorted.length === 0) return { entryCount: 0, spanDays: 0 };

  const todayMs = dayMs(todayISO);
  const first = sorted[0];
  const latest = sorted[sorted.length - 1];
  const spanDays = Math.round((dayMs(latest.forDate) - dayMs(first.forDate)) / MS_PER_DAY);

  return {
    entryCount: sorted.length,
    spanDays,
    latestKg: latest.kg,
    firstKg: first.kg,
    totalChangeKg: Math.round((latest.kg - first.kg) * 10) / 10,
    delta7: trailingDelta(sorted, todayMs, 7),
    delta30: trailingDelta(sorted, todayMs, 30),
    weeklyRateKg: sorted.length >= 2 && spanDays >= MIN_RATE_SPAN_DAYS
      ? weeklySlope(sorted, todayMs)
      : undefined,
  };
}

/** Honest "at this rate" projection toward a goal weight. */
export function projectGoalDate(trend: WeightTrend, goalKg?: number): GoalProjection {
  if (trend.latestKg === undefined || trend.weeklyRateKg === undefined) {
    return { kind: 'no-data' };
  }
  if (goalKg === undefined || goalKg <= 0) return { kind: 'no-goal' };

  const remaining = goalKg - trend.latestKg; // negative when losing toward goal
  if (Math.abs(remaining) < 0.05) return { kind: 'flat' }; // already there — nothing to project
  if (Math.abs(trend.weeklyRateKg) < FLAT_RATE_KG_PER_WEEK) return { kind: 'flat' };
  // The trend must point toward the goal (same sign as the remaining gap).
  if (Math.sign(remaining) !== Math.sign(trend.weeklyRateKg)) {
    return { kind: 'wrong-direction' };
  }
  const weeks = Math.abs(remaining / trend.weeklyRateKg);
  if (weeks > MAX_PROJECTION_WEEKS) return { kind: 'too-far' };
  return {
    kind: 'date',
    weeks: Math.round(weeks),
    date: new Date(Date.now() + weeks * 7 * MS_PER_DAY),
  };
}
