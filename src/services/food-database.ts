/**
 * Open Food Facts client — the packaged-food database behind barcode
 * scanning and text search. Free, open, no API key. Items are mapped
 * per the LABEL's serving when the product carries serving data (so the
 * app matches the package in the user's hand), falling back to per-100g
 * with a grams-eaten portion input in the confirm UI.
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
  serving_size?: string; // human label, e.g. "2 tbsp (32 g)"
  serving_quantity?: number | string; // grams in one serving
  nutriments?: {
    'energy-kcal_100g'?: number;
    proteins_100g?: number;
    carbohydrates_100g?: number;
    fat_100g?: number;
    fiber_100g?: number;
    sugars_100g?: number;
    sodium_100g?: number; // grams per 100 g
    'energy-kcal_serving'?: number;
    proteins_serving?: number;
    carbohydrates_serving?: number;
    fat_serving?: number;
    fiber_serving?: number;
    sugars_serving?: number;
    sodium_serving?: number; // grams per serving
  };
}

/** A sane finite non-negative number, or undefined. */
function sane(v: number | string | undefined): number | undefined {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : undefined;
}

/** Rounded to one decimal for macro grams. */
function round1(v: number | undefined): number | undefined {
  return v === undefined ? undefined : Math.round(v * 10) / 10;
}

/**
 * Maps one OFF product to a FoodItem, or null when it's unusable (no
 * name or no calorie figure — junk entries are common in open data).
 *
 * Servings: when the product carries per-serving data (most packaged
 * foods do), the item is built PER SERVING with the label's own
 * serving_size text — so what Meridian shows matches the package in the
 * user's hand. Missing per-serving macro fields are scaled from the
 * per-100g value via serving_quantity when known. Products without any
 * serving data stay per-100g (the confirm UI then asks for grams eaten).
 *
 * Exported for tests.
 */
export function mapProduct(product: OffProduct): FoodItem | null {
  const name = product.product_name?.trim();
  if (!name) return null;
  const n = product.nutriments ?? {};

  const brand = product.brands?.split(',')[0]?.trim() || undefined;
  const servingKcal = sane(n['energy-kcal_serving']);
  const servingQty = sane(product.serving_quantity);
  const servingLabel = product.serving_size?.trim();

  // Per-serving path — the label's own numbers.
  if (servingKcal !== undefined) {
    // Prefer the explicit per-serving field; scale from per-100g when a
    // field is missing but the serving's gram weight is known.
    const scaled = (per100: number | undefined): number | undefined =>
      per100 !== undefined && servingQty !== undefined
        ? (per100 * servingQty) / 100
        : undefined;
    const pick = (perServing: number | undefined, per100: number | undefined) =>
      round1(perServing !== undefined ? perServing : scaled(per100));

    const sodiumG = pick(sane(n.sodium_serving), sane(n.sodium_100g));
    return {
      name,
      brand,
      servingDescription:
        servingLabel || (servingQty !== undefined ? `${servingQty} g` : '1 serving'),
      caloriesPerServing: Math.round(servingKcal),
      proteinG: pick(sane(n.proteins_serving), sane(n.proteins_100g)),
      carbsG: pick(sane(n.carbohydrates_serving), sane(n.carbohydrates_100g)),
      fatsG: pick(sane(n.fat_serving), sane(n.fat_100g)),
      fiberG: pick(sane(n.fiber_serving), sane(n.fiber_100g)),
      sugarG: pick(sane(n.sugars_serving), sane(n.sugars_100g)),
      sodiumMg: sodiumG !== undefined ? Math.round(sodiumG * 1000) : undefined,
      barcode: product.code,
    };
  }

  // Per-100g path — unchanged behavior for products without serving data.
  const calories = sane(n['energy-kcal_100g']);
  if (calories === undefined) return null;
  const sodium100 = sane(n.sodium_100g);
  return {
    name,
    brand,
    servingDescription: '100 g',
    caloriesPerServing: Math.round(calories),
    proteinG: round1(sane(n.proteins_100g)),
    carbsG: round1(sane(n.carbohydrates_100g)),
    fatsG: round1(sane(n.fat_100g)),
    fiberG: round1(sane(n.fiber_100g)),
    sugarG: round1(sane(n.sugars_100g)),
    sodiumMg: sodium100 !== undefined ? Math.round(sodium100 * 1000) : undefined,
    barcode: product.code,
  };
}

/** Text search — top matches mapped to FoodItems, junk filtered out. */
export async function searchFoods(query: string): Promise<FoodItem[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const url =
    `${SEARCH_URL}?search_terms=${encodeURIComponent(trimmed)}` +
    '&search_simple=1&action=process&json=1&page_size=20&fields=product_name,brands,code,serving_size,serving_quantity,nutriments';
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
  const url = `${PRODUCT_URL}/${encodeURIComponent(barcode)}.json?fields=product_name,brands,code,serving_size,serving_quantity,nutriments`;
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
