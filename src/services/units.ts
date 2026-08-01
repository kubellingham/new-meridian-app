/**
 * Body-measurement unit conversions for input surfaces. The stores are
 * metric-only (height cm, weight kg) — these translate what the user
 * types in imperial at the edge, so no reader anywhere else changes.
 */

const CM_PER_INCH = 2.54;
const KG_PER_LB = 0.45359237;

/** Feet + inches → whole centimetres. */
export function cmFromFtIn(ft: number, inches: number): number {
  return Math.round((ft * 12 + inches) * CM_PER_INCH);
}

/** Centimetres → feet + inches (inches rounded, carried into feet at 12). */
export function ftInFromCm(cm: number): { ft: number; inches: number } {
  const totalInches = cm / CM_PER_INCH;
  let ft = Math.floor(totalInches / 12);
  let inches = Math.round(totalInches - ft * 12);
  if (inches === 12) {
    ft += 1;
    inches = 0;
  }
  return { ft, inches };
}

/** Pounds → kilograms, 0.1 kg precision. */
export function kgFromLb(lb: number): number {
  return Math.round(lb * KG_PER_LB * 10) / 10;
}

/** Kilograms → pounds, 0.1 lb precision. */
export function lbFromKg(kg: number): number {
  return Math.round((kg / KG_PER_LB) * 10) / 10;
}
