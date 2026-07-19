/**
 * OFF product → FoodItem mapping. The live API is egress-blocked in the
 * dev sandbox, so mapping is pinned here against realistic shapes and
 * the network paths are exercised on device.
 */

import { lookupBarcode, mapProduct, parseMeasureText, searchFoods } from '../food-database';

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
    expect(item.servingUnit).toBe('g');
    expect(item.servingQuantity).toBe(100);
  });
});

describe('mapProduct — units and package size', () => {
  // The Mountain Dew case: a drink is drunk in ml, not weighed in grams.
  it('captures ml units and package size for a drink with serving data', () => {
    const item = mapProduct({
      product_name: 'Mountain Dew',
      brands: 'PepsiCo',
      code: '012000001291',
      serving_size: '200 ml',
      serving_quantity: 200,
      serving_quantity_unit: 'ml',
      product_quantity: '500',
      product_quantity_unit: 'ml',
      nutriments: { 'energy-kcal_100g': 44, 'energy-kcal_serving': 88, sugars_100g: 11 },
    })!;
    expect(item.servingUnit).toBe('ml');
    expect(item.servingQuantity).toBe(200);
    expect(item.packageQuantity).toBe(500);
    expect(item.caloriesPerServing).toBe(88);
    expect(item.sugarG).toBe(22); // scaled per-100ml → per-200ml serving
  });

  it('labels the per-100 basis in ml for drinks without serving data', () => {
    const item = mapProduct({
      product_name: 'Sparkling water',
      product_quantity: 330,
      product_quantity_unit: 'ml',
      nutriments: { 'energy-kcal_100g': 0 },
    })!;
    expect(item.servingDescription).toBe('100 ml');
    expect(item.servingUnit).toBe('ml');
    expect(item.servingQuantity).toBe(100);
    expect(item.packageQuantity).toBe(330);
  });

  it('normalizes cl and l to millilitres', () => {
    const item = mapProduct({
      product_name: 'Cola',
      serving_quantity: 33,
      serving_quantity_unit: 'cl',
      product_quantity: 1,
      product_quantity_unit: 'l',
      nutriments: { 'energy-kcal_serving': 139 },
    })!;
    expect(item.servingUnit).toBe('ml');
    expect(item.servingQuantity).toBe(330);
    expect(item.packageQuantity).toBe(1000);
    expect(item.servingDescription).toBe('330 ml');
  });

  it('drops the package when its unit disagrees with the serving unit', () => {
    const item = mapProduct({
      product_name: 'Odd data',
      serving_quantity: 30,
      serving_quantity_unit: 'g',
      product_quantity: 500,
      product_quantity_unit: 'ml',
      nutriments: { 'energy-kcal_serving': 120 },
    })!;
    expect(item.servingUnit).toBe('g');
    expect(item.packageQuantity).toBeUndefined();
  });

  // The real-device Mountain Dew case: per-100 nutriments only, no unit
  // fields anywhere — the category still says it's drunk, not weighed.
  it('infers ml from a beverage category when no unit fields exist', () => {
    const item = mapProduct({
      product_name: 'Mountain Dew',
      code: '8901491101837',
      categories_tags: ['en:beverages', 'en:carbonated-drinks', 'en:sodas'],
      nutriments: { 'energy-kcal_100g': 49, carbohydrates_100g: 12.3 },
    })!;
    expect(item.servingUnit).toBe('ml');
    expect(item.servingDescription).toBe('100 ml');
    expect(item.servingQuantity).toBe(100);
  });

  it('reads the serving size from label text when unit fields are missing', () => {
    const item = mapProduct({
      product_name: 'Dew with label text',
      serving_size: '200 ml',
      categories_tags: ['en:beverages'],
      nutriments: { 'energy-kcal_100g': 49, 'energy-kcal_serving': 98 },
    })!;
    expect(item.servingUnit).toBe('ml');
    expect(item.servingQuantity).toBe(200);
    expect(item.servingDescription).toBe('200 ml');
    expect(item.caloriesPerServing).toBe(98);
  });

  it('sums same-unit package text ("1 l + 250 ml" promo bottle → 1250 ml)', () => {
    const item = mapProduct({
      product_name: 'Promo bottle',
      quantity: '1 l + 250 ml',
      categories_tags: ['en:beverages'],
      nutriments: { 'energy-kcal_100g': 49 },
    })!;
    expect(item.servingUnit).toBe('ml');
    expect(item.packageQuantity).toBe(1250);
  });

  it('interprets a bare serving_quantity in the inferred unit', () => {
    const item = mapProduct({
      product_name: 'Juice',
      serving_quantity: 250, // number, no unit field at all
      categories_tags: ['en:fruit-juices'],
      nutriments: { 'energy-kcal_serving': 110 },
    })!;
    expect(item.servingUnit).toBe('ml');
    expect(item.servingQuantity).toBe(250);
    expect(item.servingDescription).toBe('250 ml');
  });

  it('refuses mixed-unit text and keeps solids on grams', () => {
    expect(parseMeasureText('100 g in 250 ml water')).toBeUndefined();
    expect(parseMeasureText('two scoops')).toBeUndefined();
    expect(parseMeasureText('0,33 l')).toEqual({ unit: 'ml', value: 330 });
    const solid = mapProduct({
      product_name: 'Biscuits',
      categories_tags: ['en:snacks', 'en:biscuits'],
      nutriments: { 'energy-kcal_100g': 480 },
    })!;
    expect(solid.servingUnit).toBe('g');
    expect(solid.servingDescription).toBe('100 g');
  });

  it('ignores junk units rather than guessing', () => {
    const item = mapProduct({
      product_name: 'Weird row',
      serving_quantity: 2,
      serving_quantity_unit: 'portions',
      nutriments: { 'energy-kcal_100g': 200 },
    })!;
    // Unusable serving measure → plain per-100g behavior.
    expect(item.servingDescription).toBe('100 g');
    expect(item.servingQuantity).toBe(100);
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
