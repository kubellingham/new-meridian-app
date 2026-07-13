/**
 * Tool-input validation for AI food logging — the boundary between what
 * the model sends and what we trust into the log.
 */

// food-logging imports claude.ts, which pulls the persisted stores.
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

import { parseFoodsFromToolInput } from '../food-logging';

describe('parseFoodsFromToolInput', () => {
  it('parses a well-formed tool call', () => {
    const foods = parseFoodsFromToolInput({
      foods: [
        {
          name: 'Jollof rice',
          servingDescription: '1 plate',
          caloriesPerServing: 450,
          proteinG: 12,
          carbsG: 70,
          fatsG: 14,
          servings: 1.5,
          meal: 'lunch',
        },
      ],
    });
    expect(foods).toHaveLength(1);
    expect(foods[0].item.name).toBe('Jollof rice');
    expect(foods[0].item.caloriesPerServing).toBe(450);
    expect(foods[0].servings).toBe(1.5);
    expect(foods[0].meal).toBe('lunch');
  });

  it('drops malformed items without losing the good ones', () => {
    const foods = parseFoodsFromToolInput({
      foods: [
        { name: 'No calories given' },
        { caloriesPerServing: 300 }, // no name
        { name: 'Good item', caloriesPerServing: 300 },
        { name: 'Negative', caloriesPerServing: -50 },
      ],
    });
    expect(foods).toHaveLength(1);
    expect(foods[0].item.name).toBe('Good item');
  });

  it('defaults servings to 1 and ignores invalid meal values', () => {
    const foods = parseFoodsFromToolInput({
      foods: [{ name: 'Eggs', caloriesPerServing: 150, meal: 'brunch' }],
    });
    expect(foods[0].servings).toBe(1);
    expect(foods[0].meal).toBeUndefined();
  });

  it('returns empty for junk input', () => {
    expect(parseFoodsFromToolInput(undefined)).toEqual([]);
    expect(parseFoodsFromToolInput({})).toEqual([]);
    expect(parseFoodsFromToolInput({ foods: 'nope' })).toEqual([]);
  });

  it('coerces non-numeric macro fields to undefined', () => {
    const foods = parseFoodsFromToolInput({
      foods: [{ name: 'Soup', caloriesPerServing: 200, proteinG: 'lots' }],
    });
    expect(foods[0].item.proteinG).toBeUndefined();
  });
});
