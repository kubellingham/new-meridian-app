/**
 * Portion mode derivation + conversion — the honest-units contract:
 * modes only exist when the item's data supports them, and every typed
 * amount maps to the stored `servings` multiplier exactly.
 */

import {
  caloriesLabel,
  defaultMode,
  defaultValue,
  isPer100,
  quantityModes,
  rescaleNutrition,
  toServings,
} from '../food-quantity';
import type { FoodItem } from '@/src/types/user-data';

/** A 500 ml bottle with a 200 ml label serving — the Mountain Dew shape. */
const DRINK: FoodItem = {
  name: 'Mountain Dew',
  servingDescription: '200 ml',
  servingUnit: 'ml',
  servingQuantity: 200,
  packageQuantity: 500,
  caloriesPerServing: 88,
};

/** A per-100g database row (no label serving). */
const PER_100G: FoodItem = {
  name: 'Rice',
  servingDescription: '100 g',
  servingUnit: 'g',
  servingQuantity: 100,
  caloriesPerServing: 360,
};

/** An AI-estimated plate — no unit data at all. */
const PLATE: FoodItem = {
  name: 'Chicken curry',
  servingDescription: '1 plate',
  caloriesPerServing: 550,
};

/** A pre-units logged row (before servingUnit existed on the schema). */
const LEGACY_100G: FoodItem = {
  name: 'Old rice',
  servingDescription: '100 g',
  caloriesPerServing: 360,
};

describe('quantityModes', () => {
  it('offers servings, ml amount, and whole pack for a drink', () => {
    const modes = quantityModes(DRINK);
    expect(modes.map((m) => m.mode)).toEqual(['servings', 'unit-amount', 'whole-package']);
    expect(modes[0].label).toBe('Servings (1 = 200 ml)');
    expect(modes[1].fieldLabel).toBe('ml eaten');
    expect(modes[2].label).toBe('Whole pack (500 ml)');
    expect(modes[2].needsValue).toBe(false);
  });

  it('drops the silly "servings of 100 g" mode for per-100 rows', () => {
    const modes = quantityModes(PER_100G);
    expect(modes.map((m) => m.mode)).toEqual(['unit-amount']);
    expect(modes[0].fieldLabel).toBe('g eaten');
  });

  it('gives unitless items plain servings only — no dropdown material', () => {
    const modes = quantityModes(PLATE);
    expect(modes).toHaveLength(1);
    expect(modes[0].mode).toBe('servings');
    expect(modes[0].label).toBe('Servings (1 = 1 plate)');
  });

  it('keeps the grams input for rows logged before unit fields existed', () => {
    expect(isPer100(LEGACY_100G)).toBe(true);
    expect(quantityModes(LEGACY_100G).map((m) => m.mode)).toEqual(['unit-amount']);
  });
});

describe('defaults', () => {
  it('opens per-100 rows on the unit amount, others on servings', () => {
    expect(defaultMode(PER_100G)).toBe('unit-amount');
    expect(defaultMode(LEGACY_100G)).toBe('unit-amount');
    expect(defaultMode(DRINK)).toBe('servings');
    expect(defaultMode(PLATE)).toBe('servings');
  });

  it('prefills the unit amount from the servings multiplier', () => {
    expect(defaultValue('unit-amount', 1.5, PER_100G)).toBe(150);
    expect(defaultValue('unit-amount', 1, DRINK)).toBe(200);
    expect(defaultValue('servings', 2, DRINK)).toBe(2);
  });
});

describe('toServings', () => {
  it('converts unit amounts through the serving size', () => {
    expect(toServings('unit-amount', 500, DRINK)).toBe(2.5); // 500 ml of a 200 ml serving
    expect(toServings('unit-amount', 150, PER_100G)).toBe(1.5);
    expect(toServings('unit-amount', 150, LEGACY_100G)).toBe(1.5);
  });

  it('whole package is the package over the serving', () => {
    expect(toServings('whole-package', 0, DRINK)).toBe(2.5); // 500/200, value ignored
    expect(toServings('whole-package', 0, PER_100G)).toBeUndefined(); // no package data
  });

  it('passes servings through and refuses junk', () => {
    expect(toServings('servings', 2, PLATE)).toBe(2);
    expect(toServings('servings', 0, PLATE)).toBeUndefined();
    expect(toServings('servings', NaN, PLATE)).toBeUndefined();
    expect(toServings('unit-amount', 100, PLATE)).toBeUndefined(); // no unit data
  });
});

describe('rescaleNutrition', () => {
  // The tester's bottle: per-100ml row redefined as a 200 ml serve.
  it('re-bases per-100 nutrition to a new serving size', () => {
    const dew100: FoodItem = {
      name: 'Mountain Dew',
      servingDescription: '100 ml',
      servingUnit: 'ml',
      servingQuantity: 100,
      caloriesPerServing: 49,
      carbsG: 12.3,
    };
    const scaled = rescaleNutrition(dew100, 200);
    expect(scaled.caloriesPerServing).toBe(98);
    expect(scaled.carbsG).toBe(24.6);
    expect(scaled.proteinG).toBeUndefined(); // absent stays absent
  });

  it('passes through when nothing really changes or nothing can convert', () => {
    expect(rescaleNutrition(DRINK, 200).caloriesPerServing).toBe(88); // same basis
    expect(rescaleNutrition(PLATE, 200).caloriesPerServing).toBe(550); // no basis
    expect(rescaleNutrition(DRINK, NaN).caloriesPerServing).toBe(88); // junk qty
  });

  it('scales an arbitrary per-serving basis', () => {
    expect(rescaleNutrition(DRINK, 500).caloriesPerServing).toBe(220); // 88 × 500/200
  });
});

describe('caloriesLabel', () => {
  it('names the per-100 basis, per-serving otherwise', () => {
    expect(caloriesLabel(PER_100G)).toBe('kcal / 100 g');
    expect(caloriesLabel(DRINK)).toBe('kcal / serving');
    expect(caloriesLabel(PLATE)).toBe('kcal / serving');
  });
});
