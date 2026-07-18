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

import {
  buildRefineMessages,
  parseFollowUpsFromToolInput,
  parseFoodsFromToolInput,
  type PhotoExchange,
} from '../food-logging';

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

describe('parseFollowUpsFromToolInput', () => {
  it('keeps trimmed non-empty strings, capped at three', () => {
    expect(
      parseFollowUpsFromToolInput({
        questions: [' How was it cooked? ', '', 42, 'Any oil?', 'Cheese?', 'One too many?'],
      }),
    ).toEqual(['How was it cooked?', 'Any oil?', 'Cheese?']);
  });

  it('returns empty for junk input', () => {
    expect(parseFollowUpsFromToolInput(undefined)).toEqual([]);
    expect(parseFollowUpsFromToolInput({})).toEqual([]);
    expect(parseFollowUpsFromToolInput({ questions: 'nope' })).toEqual([]);
  });
});

describe('buildRefineMessages', () => {
  const exchange: PhotoExchange = {
    reply: 'Solid plate.',
    foods: [
      {
        item: {
          name: 'Chicken sandwich',
          servingDescription: '1 sandwich',
          caloriesPerServing: 450,
          proteinG: 28,
        },
        servings: 1,
        meal: 'lunch',
      },
    ],
    answers: [{ question: 'Any cheese in there?', answer: 'Yes, one slice of cheddar' }],
  };

  it('rebuilds the thread: image turn, plain-text rounds, answers last', () => {
    const messages = buildRefineMessages('abc123', 'image/jpeg', [exchange]);
    expect(messages).toHaveLength(3);
    // Turn 1: the original image + directive.
    expect(messages[0].role).toBe('user');
    const first = messages[0].content as { type: string }[];
    expect(first[0].type).toBe('image');
    // Turn 2: the NS's round as plain text — its reply AND its own
    // numbers, but no tool_use blocks (nothing to pair a tool_result to).
    expect(messages[1].role).toBe('assistant');
    expect(messages[1].content).toContain('Solid plate.');
    expect(messages[1].content).toContain('Chicken sandwich: 450 kcal per 1 sandwich');
    expect(messages[1].content).toContain('protein 28 g');
    // Turn 3: the refine directive + the user's answers.
    expect(messages[2].role).toBe('user');
    expect(messages[2].content).toContain('Q: Any cheese in there?');
    expect(messages[2].content).toContain('A: Yes, one slice of cheddar');
    expect(messages[2].content).toContain('COMPLETE corrected list');
  });

  it('chains multiple rounds in order', () => {
    const round2: PhotoExchange = {
      reply: 'Updated for the cheese.',
      foods: [],
      answers: [{ question: 'Anything I missed on the plate?', answer: 'A handful of fries' }],
    };
    const messages = buildRefineMessages('abc123', 'image/jpeg', [exchange, round2]);
    expect(messages).toHaveLength(5);
    expect(messages[3].content).toContain('Updated for the cheese.');
    expect(messages[3].content).toContain('(logged nothing)');
    expect(messages[4].content).toContain('A handful of fries');
  });
});
