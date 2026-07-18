/**
 * Portion arithmetic for the food review UI. A FoodItem's nutrition is
 * per serving and the log stores a `servings` multiplier; this module
 * translates between that and the ways a person actually measures food
 * — label servings, grams/millilitres, or the whole package — using the
 * structured unit fields when the item carries them. No guessing: modes
 * are only offered when the data to convert honestly exists.
 */

import type { FoodItem, ServingUnit } from '@/src/types/user-data';

export type QuantityMode = 'servings' | 'unit-amount' | 'whole-package';

export interface QuantityOption {
  mode: QuantityMode;
  /** Dropdown row text, e.g. "Servings (1 = 200 ml)" / "Whole pack (500 ml)". */
  label: string;
  /** Label over the number input, e.g. "servings" / "ml eaten" / "g eaten". */
  fieldLabel: string;
  /** Whole-package needs no typed number — the amount is the package. */
  needsValue: boolean;
}

interface Measure {
  unit: ServingUnit;
  servingQty: number;
  packageQty?: number;
}

/**
 * The item's measurable identity, if it has one. Rows mapped before the
 * unit fields existed carry only the '100 g' description — honored here
 * so old recent-foods rows keep their grams input.
 */
function measure(item: FoodItem): Measure | undefined {
  if (item.servingUnit && item.servingQuantity) {
    return {
      unit: item.servingUnit,
      servingQty: item.servingQuantity,
      packageQty: item.packageQuantity,
    };
  }
  if (item.servingDescription === '100 g') return { unit: 'g', servingQty: 100 };
  return undefined;
}

/**
 * Items whose "serving" is just the per-100 nutriment basis — nobody
 * thinks in 1.5 servings of 100 g, so these default to a unit amount.
 */
export function isPer100(item: FoodItem): boolean {
  const m = measure(item);
  return m?.servingQty === 100 && item.servingDescription === `100 ${m.unit}`;
}

/**
 * The portion modes this item's data honestly supports, in display
 * order. Always at least one; items without unit data (photo, chat,
 * manual) get plain servings only and the UI can skip the dropdown.
 */
export function quantityModes(item: FoodItem): QuantityOption[] {
  const m = measure(item);
  const options: QuantityOption[] = [];

  if (!isPer100(item)) {
    options.push({
      mode: 'servings',
      label: item.servingDescription ? `Servings (1 = ${item.servingDescription})` : 'Servings',
      fieldLabel: 'servings',
      needsValue: true,
    });
  }
  if (m) {
    options.push({
      mode: 'unit-amount',
      label: `Amount in ${m.unit}`,
      fieldLabel: `${m.unit} eaten`,
      needsValue: true,
    });
    if (m.packageQty) {
      options.push({
        mode: 'whole-package',
        label: `Whole pack (${m.packageQty} ${m.unit})`,
        fieldLabel: `${m.unit} eaten`,
        needsValue: false,
      });
    }
  }
  if (options.length === 0) {
    options.push({ mode: 'servings', label: 'Servings', fieldLabel: 'servings', needsValue: true });
  }
  return options;
}

/** The mode the input should open in. */
export function defaultMode(item: FoodItem): QuantityMode {
  return isPer100(item) ? 'unit-amount' : 'servings';
}

/** The number to prefill the input with, for a given starting multiplier. */
export function defaultValue(mode: QuantityMode, servings: number, item: FoodItem): number {
  const m = measure(item);
  if (mode === 'unit-amount' && m) return Math.round(servings * m.servingQty);
  return servings;
}

/**
 * A typed value in the given mode → the `servings` multiplier the log
 * stores. Returns undefined when the value (or the item's data) can't
 * make an honest number.
 */
export function toServings(mode: QuantityMode, value: number, item: FoodItem): number | undefined {
  const m = measure(item);
  if (mode === 'whole-package') {
    return m?.packageQty ? m.packageQty / m.servingQty : undefined;
  }
  if (!Number.isFinite(value) || value <= 0) return undefined;
  if (mode === 'unit-amount') return m ? value / m.servingQty : undefined;
  return value;
}

/** Label for the calories field: per-100 items name their basis. */
export function caloriesLabel(item: FoodItem): string {
  return isPer100(item) ? `kcal / ${item.servingDescription}` : 'kcal / serving';
}
