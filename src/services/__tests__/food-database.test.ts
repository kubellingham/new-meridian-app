/**
 * OFF product → FoodItem mapping. The live API is egress-blocked in the
 * dev sandbox, so mapping is pinned here against realistic shapes and
 * the network paths are exercised on device.
 */

import { lookupBarcode, mapProduct, searchFoods } from '../food-database';

const REAL_ISH_PRODUCT = {
  product_name: 'Peanut Butter',
  brands: 'Justin\'s, Justin\'s LLC',
  code: '737628064502',
  nutriments: {
    'energy-kcal_100g': 588,
    proteins_100g: 25,
    carbohydrates_100g: 20,
    fat_100g: 50,
    fiber_100g: 6.25,
    sugars_100g: 9.38,
    sodium_100g: 0.469,
  },
};

describe('mapProduct', () => {
  it('maps a full product to a per-100g FoodItem', () => {
    const item = mapProduct(REAL_ISH_PRODUCT)!;
    expect(item.name).toBe('Peanut Butter');
    expect(item.brand).toBe("Justin's"); // first brand only
    expect(item.servingDescription).toBe('100 g');
    expect(item.caloriesPerServing).toBe(588);
    expect(item.proteinG).toBe(25);
    expect(item.fiberG).toBe(6.3); // rounded to 1 dp
    expect(item.sodiumMg).toBe(469); // g → mg
    expect(item.barcode).toBe('737628064502');
  });

  it('rejects products without a name or calories', () => {
    expect(mapProduct({ nutriments: { 'energy-kcal_100g': 100 } })).toBeNull();
    expect(mapProduct({ product_name: 'Ghost item' })).toBeNull();
    expect(mapProduct({ product_name: ' ', nutriments: { 'energy-kcal_100g': 100 } })).toBeNull();
  });

  it('tolerates partial nutriments', () => {
    const item = mapProduct({
      product_name: 'Mystery bar',
      nutriments: { 'energy-kcal_100g': 400 },
    })!;
    expect(item.caloriesPerServing).toBe(400);
    expect(item.proteinG).toBeUndefined();
    expect(item.sodiumMg).toBeUndefined();
  });
});

describe('mapProduct — serving-aware path', () => {
  it('uses the label serving when per-serving data exists', () => {
    const item = mapProduct({
      product_name: 'Peanut Butter',
      serving_size: '2 tbsp (32 g)',
      serving_quantity: 32,
      nutriments: {
        'energy-kcal_100g': 588,
        'energy-kcal_serving': 190,
        proteins_100g: 25,
        proteins_serving: 8,
        fat_100g: 50,
        fat_serving: 16,
      },
    })!;
    // Matches the package, not the 100g math.
    expect(item.caloriesPerServing).toBe(190);
    expect(item.servingDescription).toBe('2 tbsp (32 g)');
    expect(item.proteinG).toBe(8);
    expect(item.fatsG).toBe(16);
  });

  it('scales missing per-serving macros from per-100g via serving_quantity', () => {
    const item = mapProduct({
      product_name: 'Cereal',
      serving_size: '30 g',
      serving_quantity: 30,
      nutriments: {
        'energy-kcal_serving': 113,
        proteins_100g: 10, // no proteins_serving → 10 * 30/100 = 3
        carbohydrates_100g: 80, // → 24
      },
    })!;
    expect(item.caloriesPerServing).toBe(113);
    expect(item.proteinG).toBe(3);
    expect(item.carbsG).toBe(24);
  });

  it('handles serving_quantity delivered as a string', () => {
    const item = mapProduct({
      product_name: 'Yogurt',
      serving_quantity: '125',
      nutriments: { 'energy-kcal_serving': 95, proteins_100g: 4 },
    })!;
    expect(item.servingDescription).toBe('125 g');
    expect(item.proteinG).toBe(5); // 4 * 125/100
  });

  it('falls back to "1 serving" when no label text or quantity exists', () => {
    const item = mapProduct({
      product_name: 'Snack',
      nutriments: { 'energy-kcal_serving': 150 },
    })!;
    expect(item.servingDescription).toBe('1 serving');
    expect(item.caloriesPerServing).toBe(150);
    expect(item.proteinG).toBeUndefined(); // no quantity → no scaling
  });

  it('stays per-100g when only 100g data exists', () => {
    const item = mapProduct({
      product_name: 'Rice',
      nutriments: { 'energy-kcal_100g': 360, proteins_100g: 7 },
    })!;
    expect(item.servingDescription).toBe('100 g');
    expect(item.caloriesPerServing).toBe(360);
  });
});

describe('network wrappers (mocked fetch)', () => {
  afterEach(() => {
    // @ts-expect-error cleanup
    global.fetch = undefined;
  });

  it('searchFoods maps and filters the products array', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          products: [REAL_ISH_PRODUCT, { product_name: 'Junk, no nutriments' }],
        }),
    }) as unknown as typeof fetch;
    const items = await searchFoods('peanut butter');
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('Peanut Butter');
  });

  it('lookupBarcode returns null for unknown products', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ status: 0 }),
    }) as unknown as typeof fetch;
    expect(await lookupBarcode('0000000000000')).toBeNull();
  });

  it('throws a typed error when the network fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;
    await expect(searchFoods('rice')).rejects.toThrow('Could not reach the food database');
  });
});
