/**
 * Open Food Facts client — the packaged-food database behind barcode
 * scanning and text search. Free, open, no API key. Nutrition comes back
 * per 100 g, so mapped items use servingDescription "100 g" and the user
 * scales with servings.
 *
 * NOTE: unreachable from the development sandbox (egress-blocked), so
 * the mapping is unit-tested against captured response shapes and the
 * live calls are part of on-device acceptance.
 */

import type { FoodItem } from '@/src/types/user-data';

const SEARCH_URL = 'https://world.openfoodfacts.org/cgi/search.pl';
const PRODUCT_URL = 'https://world.openfoodfacts.org/api/v2/product';
/** OFF asks API users to identify themselves. */
const USER_AGENT = 'Meridian/0.2 (personal fitness app; development)';

/** Distinguishes "network/HTTP failed" from "no results" for the UI. */
export class FoodDatabaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FoodDatabaseError';
  }
}

/** The slice of an OFF product we read. Everything optional — real data is messy. */
interface OffProduct {
  product_name?: string;
  brands?: string;
  code?: string;
  nutriments?: {
    'energy-kcal_100g'?: number;
    proteins_100g?: number;
    carbohydrates_100g?: number;
    fat_100g?: number;
    fiber_100g?: number;
    sugars_100g?: number;
    sodium_100g?: number; // grams per 100 g
  };
}

/**
 * Maps one OFF product to a FoodItem, or null when it's unusable (no
 * name or no calorie figure — junk entries are common in open data).
 * Exported for tests.
 */
export function mapProduct(product: OffProduct): FoodItem | null {
  const name = product.product_name?.trim();
  const calories = product.nutriments?.['energy-kcal_100g'];
  if (!name || typeof calories !== 'number' || !Number.isFinite(calories) || calories < 0) {
    return null;
  }
  const n = product.nutriments ?? {};
  const grams = (v: number | undefined) =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v * 10) / 10 : undefined;
  return {
    name,
    brand: product.brands?.split(',')[0]?.trim() || undefined,
    servingDescription: '100 g',
    caloriesPerServing: Math.round(calories),
    proteinG: grams(n.proteins_100g),
    carbsG: grams(n.carbohydrates_100g),
    fatsG: grams(n.fat_100g),
    fiberG: grams(n.fiber_100g),
    sugarG: grams(n.sugars_100g),
    // OFF stores sodium in g/100g; the schema wants mg.
    sodiumMg:
      typeof n.sodium_100g === 'number' && Number.isFinite(n.sodium_100g) && n.sodium_100g >= 0
        ? Math.round(n.sodium_100g * 1000)
        : undefined,
    barcode: product.code,
  };
}

/** Text search — top matches mapped to FoodItems, junk filtered out. */
export async function searchFoods(query: string): Promise<FoodItem[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const url =
    `${SEARCH_URL}?search_terms=${encodeURIComponent(trimmed)}` +
    '&search_simple=1&action=process&json=1&page_size=20&fields=product_name,brands,code,nutriments';
  let response: Response;
  try {
    response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  } catch {
    throw new FoodDatabaseError('Could not reach the food database. Check your connection.');
  }
  if (!response.ok) {
    throw new FoodDatabaseError(`Food database returned ${response.status}.`);
  }
  const body = (await response.json()) as { products?: OffProduct[] };
  return (body.products ?? [])
    .map(mapProduct)
    .filter((item): item is FoodItem => item !== null);
}

/** Barcode lookup — one product or null when unknown. */
export async function lookupBarcode(barcode: string): Promise<FoodItem | null> {
  const url = `${PRODUCT_URL}/${encodeURIComponent(barcode)}.json?fields=product_name,brands,code,nutriments`;
  let response: Response;
  try {
    response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  } catch {
    throw new FoodDatabaseError('Could not reach the food database. Check your connection.');
  }
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new FoodDatabaseError(`Food database returned ${response.status}.`);
  }
  const body = (await response.json()) as { status?: number; product?: OffProduct };
  if (body.status === 0 || !body.product) return null;
  return mapProduct(body.product);
}
