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

import type { FoodItem, ServingUnit } from '@/src/types/user-data';

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
  serving_quantity?: number | string; // one serving, in serving_quantity_unit
  serving_quantity_unit?: string; // "g" | "ml" | occasionally junk
  product_quantity?: number | string; // whole package, in product_quantity_unit
  product_quantity_unit?: string;
  quantity?: string; // package text, e.g. "500 ml", "1 l + 250 ml"
  categories_tags?: string[]; // e.g. ["en:beverages", "en:sodas"]
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
 * Normalizes an OFF quantity + unit string to grams or millilitres.
 * OFF data uses g/kg for solids and ml/cl/l for drinks; a missing or
 * junk unit comes back undefined — no claim — so the caller's fuller
 * inference chain (label text, category) gets its say instead of a
 * silent grams default.
 */
function toBaseUnit(
  value: number | undefined,
  unitRaw: string | undefined,
): { unit: ServingUnit; value: number } | undefined {
  if (value === undefined || value <= 0) return undefined;
  switch (unitRaw?.trim().toLowerCase()) {
    case 'g':
      return { unit: 'g', value };
    case 'kg':
      return { unit: 'g', value: value * 1000 };
    case 'ml':
      return { unit: 'ml', value };
    case 'cl':
      return { unit: 'ml', value: value * 10 };
    case 'l':
      return { unit: 'ml', value: value * 1000 };
    default:
      return undefined;
  }
}

/**
 * Pulls a measure out of free text — "200 ml", "2 tbsp (32 g)",
 * "1 l + 250 ml" (promo bottles; same-unit tokens are summed → 1250 ml).
 * Mixed g/ml text makes no single claim → undefined. Exported for tests.
 */
export function parseMeasureText(
  text: string | undefined,
): { unit: ServingUnit; value: number } | undefined {
  if (!text) return undefined;
  const tokens = [...text.matchAll(/(\d+(?:[.,]\d+)?)\s*(ml|cl|l|g|kg)\b/gi)]
    .map((m) => toBaseUnit(Number(m[1].replace(',', '.')), m[2]))
    .filter((t): t is { unit: ServingUnit; value: number } => t !== undefined);
  if (tokens.length === 0) return undefined;
  const unit = tokens[0].unit;
  if (tokens.some((t) => t.unit !== unit)) return undefined;
  return { unit, value: tokens.reduce((sum, t) => sum + t.value, 0) };
}

/** Does the category list say this is drunk, not eaten? */
function isBeverage(tags: string[] | undefined): boolean {
  return (tags ?? []).some((t) => /beverage|drink|water|juice/i.test(t));
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
  const servingLabel = product.serving_size?.trim();

  // Structured measures. The unit is inferred from the strongest signal
  // available — explicit unit fields, then label/package text, then the
  // category (a beverage with no unit data is drunk in ml, not weighed
  // in grams). Grams only as the true last resort.
  const servingExplicit = toBaseUnit(sane(product.serving_quantity), product.serving_quantity_unit);
  const servingText = parseMeasureText(product.serving_size);
  const pkgExplicit = toBaseUnit(sane(product.product_quantity), product.product_quantity_unit);
  const pkgText = parseMeasureText(product.quantity);
  const unit: ServingUnit =
    servingExplicit?.unit ??
    servingText?.unit ??
    pkgExplicit?.unit ??
    pkgText?.unit ??
    (isBeverage(product.categories_tags) ? 'ml' : 'g');

  // Serving size in that unit. A bare serving_quantity (number, no unit
  // field at all) is read in the resolved unit; a junk unit ("portions")
  // makes the number unusable rather than guessed at.
  const servingQtyRaw = sane(product.serving_quantity);
  const hasServingUnitField = !!product.serving_quantity_unit?.trim();
  const servingQty =
    servingExplicit?.value ??
    (!hasServingUnitField ? servingQtyRaw : undefined) ??
    (servingText?.unit === unit ? servingText.value : undefined);
  const serving = servingQty !== undefined ? { unit, value: servingQty } : undefined;

  // Package size — same rules; kept only when it agrees with the unit,
  // so "200 ml serving of a 500 g package" nonsense can't reach the UI.
  const hasPkgUnitField = !!product.product_quantity_unit?.trim();
  const pkgQty =
    (pkgExplicit?.unit === unit ? pkgExplicit.value : undefined) ??
    (!hasPkgUnitField ? sane(product.product_quantity) : undefined) ??
    (pkgText?.unit === unit ? pkgText.value : undefined);
  const packageQuantity = pkgQty;

  // Per-serving path — the label's own numbers.
  if (servingKcal !== undefined) {
    // Prefer the explicit per-serving field; scale from per-100g when a
    // field is missing but the serving's size is known (the per-100
    // basis shares the product's unit, so g and ml both divide by 100).
    const scaled = (per100: number | undefined): number | undefined =>
      per100 !== undefined && serving !== undefined
        ? (per100 * serving.value) / 100
        : undefined;
    const pick = (perServing: number | undefined, per100: number | undefined) =>
      round1(perServing !== undefined ? perServing : scaled(per100));

    const sodiumG = pick(sane(n.sodium_serving), sane(n.sodium_100g));
    return {
      name,
      brand,
      servingDescription:
        servingLabel ||
        (serving !== undefined ? `${serving.value} ${serving.unit}` : '1 serving'),
      servingUnit: unit,
      servingQuantity: serving?.value,
      packageQuantity,
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

  // Per-100 path — products without per-serving data. The nutriment
  // basis is per 100 g for solids and per 100 ml for drinks (OFF keys
  // both as _100g), so the "serving" here is 100 of the product's unit.
  const calories = sane(n['energy-kcal_100g']);
  if (calories === undefined) return null;
  const per100Unit = unit ?? 'g';
  const sodium100 = sane(n.sodium_100g);
  return {
    name,
    brand,
    servingDescription: `100 ${per100Unit}`,
    servingUnit: per100Unit,
    servingQuantity: 100,
    packageQuantity,
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
    '&search_simple=1&action=process&json=1&page_size=20&fields=product_name,brands,code,serving_size,serving_quantity,serving_quantity_unit,product_quantity,product_quantity_unit,quantity,categories_tags,nutriments';
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
  const url = `${PRODUCT_URL}/${encodeURIComponent(barcode)}.json?fields=product_name,brands,code,serving_size,serving_quantity,serving_quantity_unit,product_quantity,product_quantity_unit,quantity,categories_tags,nutriments`;
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
