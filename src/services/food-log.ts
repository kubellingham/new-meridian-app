/**
 * Pure selectors over the food log — the arithmetic behind the Diet
 * dashboard and the team-context intake line. No store, no network.
 */

import type { LoggedFood, MealSlot, NutritionState } from '@/src/types/user-data';

/** Daily nutrient totals, servings applied. */
export interface DailyTotals {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatsG: number;
}

/** What's left of each target. Negative = over. Null target field = null. */
export interface RemainingTotals {
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatsG: number | null;
}

/** Meal slots in presentation order. */
export const MEAL_SLOTS: readonly MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

/** Local YYYY-MM-DD for "today" — matches the workout system's convention. */
export function todayLocalISODate(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Entries counted toward one local date, oldest first. */
export function entriesForDate(log: readonly LoggedFood[], isoDate: string): LoggedFood[] {
  return log.filter((e) => e.forDate === isoDate).sort((a, b) => a.loggedAt - b.loggedAt);
}

/** Groups entries into the four meal slots (empty slots included). */
export function groupByMeal(
  entries: readonly LoggedFood[],
): Record<MealSlot, LoggedFood[]> {
  const groups: Record<MealSlot, LoggedFood[]> = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snack: [],
  };
  for (const entry of entries) groups[entry.meal].push(entry);
  return groups;
}

/** Calories for one entry, servings applied. */
export function entryCalories(entry: LoggedFood): number {
  return entry.item.caloriesPerServing * entry.servings;
}

/**
 * Sums a day's intake. Missing macro fields contribute zero rather than
 * poisoning the total — a barcode item without a protein value shouldn't
 * blank the protein bar.
 */
export function dailyTotals(entries: readonly LoggedFood[]): DailyTotals {
  const totals: DailyTotals = { calories: 0, proteinG: 0, carbsG: 0, fatsG: 0 };
  for (const entry of entries) {
    totals.calories += entry.item.caloriesPerServing * entry.servings;
    totals.proteinG += (entry.item.proteinG ?? 0) * entry.servings;
    totals.carbsG += (entry.item.carbsG ?? 0) * entry.servings;
    totals.fatsG += (entry.item.fatsG ?? 0) * entry.servings;
  }
  return {
    calories: Math.round(totals.calories),
    proteinG: Math.round(totals.proteinG),
    carbsG: Math.round(totals.carbsG),
    fatsG: Math.round(totals.fatsG),
  };
}

/**
 * Distance to each target — null where no target is set, negative when
 * the user has gone past it (the UI renders that honestly, not as an
 * error).
 */
export function remaining(totals: DailyTotals, targets: NutritionState): RemainingTotals {
  return {
    calories:
      targets.calorieTarget !== undefined ? targets.calorieTarget - totals.calories : null,
    proteinG:
      targets.macroTargets?.proteinG !== undefined
        ? targets.macroTargets.proteinG - totals.proteinG
        : null,
    carbsG:
      targets.macroTargets?.carbsG !== undefined
        ? targets.macroTargets.carbsG - totals.carbsG
        : null,
    fatsG:
      targets.macroTargets?.fatsG !== undefined
        ? targets.macroTargets.fatsG - totals.fatsG
        : null,
  };
}

/** How many distinct foods the recents strip shows. */
const RECENT_FOODS_MAX = 10;

/**
 * Distinct recently-logged foods, newest first — the fast-relog path.
 * Deduped by lowercased name (day two of tracking is mostly repeat
 * meals); each result carries the most recent serving count so a re-log
 * defaults to what the user actually had last time.
 */
export function recentFoods(log: readonly LoggedFood[]): Array<{
  item: LoggedFood['item'];
  servings: number;
}> {
  const seen = new Set<string>();
  const recents: Array<{ item: LoggedFood['item']; servings: number }> = [];
  // Newest last in storage → walk backwards.
  for (let i = log.length - 1; i >= 0 && recents.length < RECENT_FOODS_MAX; i--) {
    const entry = log[i];
    const key = entry.item.name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    recents.push({ item: entry.item, servings: entry.servings });
  }
  return recents;
}

/** Small id helper for log entries — same shape as the other id makers. */
export function makeFoodLogId(): string {
  return `food-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
