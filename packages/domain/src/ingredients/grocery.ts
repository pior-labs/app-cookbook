import type { Fraction } from './fractions.js';
import { formatQuantity } from './format.js';
import { normalizeName } from '../text/normalize.js';
import type { GroceryItem, IngredientSource } from '../planning.js';

// BigInt intermediates prevent cross-multiplication from losing precision.
// JSON stays ordinary numbers, but an unrepresentable result fails explicitly.
function exact(n: bigint, d: bigint): Fraction {
  let a = n;
  let b = d;
  while (b) {
    [a, b] = [b, a % b];
  }
  n /= a;
  d /= a;
  if (n > BigInt(Number.MAX_SAFE_INTEGER) || d > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError('Grocery quantity is too large to represent exactly.');
  }
  return { numerator: Number(n), denominator: Number(d) };
}
export function addQuantities(a: Fraction, b: Fraction): Fraction {
  return exact(
    BigInt(a.numerator) * BigInt(b.denominator) + BigInt(b.numerator) * BigInt(a.denominator),
    BigInt(a.denominator) * BigInt(b.denominator),
  );
}
function multiply(q: Fraction, n: number, d = 1): Fraction {
  return exact(BigInt(q.numerator) * BigInt(n), BigInt(q.denominator) * BigInt(d));
}

// Cups have regional definitions and existing recipes do not record which one
// was used. Keep cups separate. Spoon-to-spoon and metric conversions are safe
// without inventing a convention or ingredient density (ADR 0008).
const CONVERSIONS: Record<string, [string, number, number]> = {
  mg: ['g', 1, 1000],
  g: ['g', 1, 1],
  kg: ['g', 1000, 1],
  oz: ['oz', 1, 1],
  lb: ['oz', 16, 1],
  ml: ['ml', 1, 1],
  l: ['ml', 1000, 1],
  tsp: ['tsp', 1, 1],
  tbsp: ['tsp', 3, 1],
};
export function convertedMeasure(source: Pick<GroceryItem, 'quantity' | 'unitCode' | 'unitText'>) {
  const conversion = source.unitCode ? CONVERSIONS[source.unitCode] : undefined;
  return {
    quantity:
      source.quantity && conversion
        ? multiply(source.quantity, conversion[1], conversion[2])
        : source.quantity,
    unitCode: conversion?.[0] ?? source.unitCode,
    unitText: source.unitText,
  };
}
export function measureKey(item: Pick<GroceryItem, 'quantity' | 'unitCode' | 'unitText'>): string {
  return JSON.stringify([
    item.unitCode,
    item.unitText == null ? null : normalizeName(item.unitText),
    item.quantity == null,
  ]);
}
export type GeneratedItem = Omit<GroceryItem, 'id'>;
export function aggregateIngredients(
  sources: IngredientSource[],
  identities: Map<string, string>,
): GeneratedItem[] {
  const groups = new Map<string, GeneratedItem>();
  for (const source of sources) {
    const name = identities.get(normalizeName(source.name)) ?? normalizeName(source.name);
    const measure = convertedMeasure(source);
    // An unmeasured line never disappears into a measured total. Preparation
    // remains in provenance, not in the shopping identity.
    const key = JSON.stringify([name, measureKey(measure)]);
    const previous = groups.get(key);
    if (previous) {
      if (previous.quantity && measure.quantity)
        previous.quantity = addQuantities(previous.quantity, measure.quantity);
      previous.sources.push(source);
    } else groups.set(key, { name, ...measure, checked: false, edited: false, sources: [source] });
  }
  return [...groups.values()];
}
export function groceryItemText(
  item: Pick<GroceryItem, 'name' | 'quantity' | 'unitCode' | 'unitText'>,
): string {
  return [
    item.quantity ? formatQuantity(item.quantity) : '',
    item.unitCode ?? item.unitText ?? '',
    item.name,
  ]
    .filter(Boolean)
    .join(' ');
}
export function groceryListText(items: GroceryItem[]): string {
  return `Grocery List\n\n${items.map((item) => `- [${item.checked ? 'x' : ' '}] ${groceryItemText(item)}`).join('\n')}`;
}
