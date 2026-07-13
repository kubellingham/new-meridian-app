/**
 * Food-log selectors — the dashboard arithmetic. Pure functions.
 */

import {
  dailyTotals,
  entriesForDate,
  entryCalories,
  groupByMeal,
  recentFoods,
  remaining,
} from '../food-log';
import type { LoggedFood } from '@/src/types/user-data';

function entry(overrides: Partial<LoggedFood> = {}): LoggedFood {
  return {
    id: overrides.id ?? 'f1',
    loggedAt: overrides.loggedAt ?? 1000,
    forDate: overrides.forDate ?? '2026-07-13',
    meal: overrides.meal ?? 'lunch',
    source: overrides.source ?? 'manual',
    servings: overrides.servings ?? 1,
    item: overrides.item ?? {
      name: 'Jollof rice',
      caloriesPerServing: 400,
      proteinG: 10,
      carbsG: 60,
      fatsG: 12,
    },
    note: overrides.note,
  };
}

describe('entriesForDate', () => {
  it('filters to the date and sorts oldest first', () => {
    const log = [
      entry({ id: 'b', loggedAt: 200, forDate: '2026-07-13' }),
      entry({ id: 'x', loggedAt: 150, forDate: '2026-07-12' }),
      entry({ id: 'a', loggedAt: 100, forDate: '2026-07-13' }),
    ];
    expect(entriesForDate(log, '2026-07-13').map((e) => e.id)).toEqual(['a', 'b']);
  });
});

describe('groupByMeal', () => {
  it('buckets entries into the four slots, empty slots present', () => {
    const groups = groupByMeal([
      entry({ id: '1', meal: 'breakfast' }),
      entry({ id: '2', meal: 'snack' }),
      entry({ id: '3', meal: 'breakfast' }),
    ]);
    expect(groups.breakfast.map((e) => e.id)).toEqual(['1', '3']);
    expect(groups.snack.map((e) => e.id)).toEqual(['2']);
    expect(groups.lunch).toEqual([]);
    expect(groups.dinner).toEqual([]);
  });
});

describe('dailyTotals', () => {
  it('applies servings multipliers', () => {
    const totals = dailyTotals([entry({ servings: 1.5 })]);
    expect(totals.calories).toBe(600);
    expect(totals.proteinG).toBe(15);
    expect(totals.carbsG).toBe(90);
    expect(totals.fatsG).toBe(18);
  });

  it('treats missing macro fields as zero without losing calories', () => {
    const totals = dailyTotals([
      entry({ item: { name: 'Mystery snack', caloriesPerServing: 250 } }),
      entry(),
    ]);
    expect(totals.calories).toBe(650);
    expect(totals.proteinG).toBe(10); // only the jollof contributes
  });

  it('returns zeros for an empty day', () => {
    expect(dailyTotals([])).toEqual({ calories: 0, proteinG: 0, carbsG: 0, fatsG: 0 });
  });
});

describe('remaining', () => {
  const totals = { calories: 1400, proteinG: 90, carbsG: 150, fatsG: 45 };

  it('computes distance to each set target', () => {
    const r = remaining(totals, {
      calorieTarget: 2000,
      macroTargets: { proteinG: 140, carbsG: 200, fatsG: 60 },
    });
    expect(r).toEqual({ calories: 600, proteinG: 50, carbsG: 50, fatsG: 15 });
  });

  it('goes negative when over target (never clamps)', () => {
    const r = remaining(totals, { calorieTarget: 1200 });
    expect(r.calories).toBe(-200);
  });

  it('returns null for unset targets', () => {
    const r = remaining(totals, {});
    expect(r).toEqual({ calories: null, proteinG: null, carbsG: null, fatsG: null });
  });
});

describe('entryCalories', () => {
  it('is per-serving times servings', () => {
    expect(entryCalories(entry({ servings: 2 }))).toBe(800);
  });
});

describe('recentFoods', () => {
  it('dedupes by name (case-insensitive), newest first, with last servings', () => {
    const log = [
      entry({ id: 'a', loggedAt: 1, servings: 1 }), // Jollof rice
      entry({ id: 'b', loggedAt: 2, item: { name: 'Eggs', caloriesPerServing: 150 }, servings: 2 }),
      entry({ id: 'c', loggedAt: 3, item: { name: 'JOLLOF RICE', caloriesPerServing: 400 }, servings: 1.5 }),
    ];
    const recents = recentFoods(log);
    expect(recents).toHaveLength(2);
    expect(recents[0].item.name).toBe('JOLLOF RICE'); // most recent wins
    expect(recents[0].servings).toBe(1.5);
    expect(recents[1].item.name).toBe('Eggs');
  });

  it('caps at ten distinct foods', () => {
    const log = Array.from({ length: 15 }, (_, i) =>
      entry({ id: `x${i}`, loggedAt: i, item: { name: `Food ${i}`, caloriesPerServing: 100 } }),
    );
    expect(recentFoods(log)).toHaveLength(10);
    expect(recentFoods(log)[0].item.name).toBe('Food 14');
  });

  it('returns empty for an empty log', () => {
    expect(recentFoods([])).toEqual([]);
  });
});
