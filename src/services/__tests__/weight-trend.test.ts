/**
 * Weight-trend math — the honesty rules matter most: no rate from thin
 * data (the migration seed case), no projection that points the wrong
 * way or promises a date two years out.
 */

import { computeWeightTrend, projectGoalDate, type WeightTrend } from '../weight-trend';
import type { WeightEntry } from '@/src/types/user-data';

/** Builds an entry n days before the fixed "today" used in these tests. */
const TODAY = '2026-07-16';
function entry(daysAgo: number, kg: number): WeightEntry {
  const d = new Date(2026, 6, 16);
  d.setDate(d.getDate() - daysAgo);
  const forDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
  return { at: d.getTime(), forDate, kg };
}

describe('computeWeightTrend', () => {
  it('handles an empty log', () => {
    const t = computeWeightTrend([], TODAY);
    expect(t.entryCount).toBe(0);
    expect(t.weeklyRateKg).toBeUndefined();
    expect(t.latestKg).toBeUndefined();
  });

  it('handles a single entry — baseline only, no rate', () => {
    const t = computeWeightTrend([entry(0, 92)], TODAY);
    expect(t.entryCount).toBe(1);
    expect(t.latestKg).toBe(92);
    expect(t.totalChangeKg).toBe(0);
    expect(t.weeklyRateKg).toBeUndefined();
  });

  it('refuses a rate when the span is under 3 days (seed + first real log)', () => {
    // The migration seed then a weigh-in the next day: a real -1kg drop,
    // but too thin to call a trend.
    const t = computeWeightTrend([entry(1, 96.5), entry(0, 95.5)], TODAY);
    expect(t.entryCount).toBe(2);
    expect(t.weeklyRateKg).toBeUndefined();
  });

  it('computes deltas and a weekly rate on a steady loss', () => {
    const log = [entry(28, 94), entry(21, 93.4), entry(14, 92.9), entry(7, 92.2), entry(0, 91.6)];
    const t = computeWeightTrend(log, TODAY);
    expect(t.totalChangeKg).toBe(-2.4);
    expect(t.delta7).toBe(-0.6);
    expect(t.delta30).toBeUndefined(); // no entry ≥30 days old to baseline against
    expect(t.weeklyRateKg).toBeLessThan(-0.5);
    expect(t.weeklyRateKg).toBeGreaterThan(-0.7);
  });

  it('reports a positive rate when gaining', () => {
    const t = computeWeightTrend([entry(14, 90), entry(7, 90.8), entry(0, 91.5)], TODAY);
    expect(t.weeklyRateKg).toBeGreaterThan(0.5);
  });

  it('sorts unordered input', () => {
    const t = computeWeightTrend([entry(0, 91), entry(14, 93), entry(7, 92)], TODAY);
    expect(t.firstKg).toBe(93);
    expect(t.latestKg).toBe(91);
  });
});

describe('projectGoalDate', () => {
  const losing: WeightTrend = {
    entryCount: 5,
    spanDays: 28,
    latestKg: 92,
    firstKg: 94,
    totalChangeKg: -2,
    weeklyRateKg: -0.5,
  };

  it('needs data and a goal', () => {
    expect(projectGoalDate({ entryCount: 0, spanDays: 0 }, 80).kind).toBe('no-data');
    expect(projectGoalDate(losing, undefined).kind).toBe('no-goal');
  });

  it('projects a date on a steady loss toward the goal', () => {
    const p = projectGoalDate(losing, 87);
    if (p.kind !== 'date') throw new Error(`expected date, got ${p.kind}`);
    expect(p.weeks).toBe(10); // 5 kg at 0.5/week
    expect(p.date.getTime()).toBeGreaterThan(Date.now());
  });

  it('calls a near-zero rate flat instead of promising a distant date', () => {
    expect(projectGoalDate({ ...losing, weeklyRateKg: -0.02 }, 87).kind).toBe('flat');
  });

  it('refuses to project when the trend points away from the goal', () => {
    expect(projectGoalDate({ ...losing, weeklyRateKg: 0.4 }, 87).kind).toBe('wrong-direction');
  });

  it('caps projections at two years', () => {
    expect(projectGoalDate({ ...losing, weeklyRateKg: -0.06 }, 80).kind).toBe('too-far');
  });

  it('projects gains too — direction is goal-relative, not loss-only', () => {
    const gaining = { ...losing, weeklyRateKg: 0.5 };
    const p = projectGoalDate(gaining, 96);
    expect(p.kind).toBe('date');
  });
});
