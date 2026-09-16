import { describe, expect, it } from 'vitest';
import {
  addQuantities,
  aggregateIngredients,
  convertedMeasure,
  groceryListText,
} from './grocery.js';
import type { IngredientSource } from '../planning.js';

const source = (overrides: Partial<IngredientSource> = {}): IngredientSource => ({
  key: '1:1',
  recipeId: 1,
  recipeName: 'Soup',
  recipeVersion: 1,
  mealItemId: 1,
  name: 'Onion',
  preparation: null,
  quantity: { numerator: 1, denominator: 3 },
  unitCode: null,
  unitText: null,
  ...overrides,
});
describe('grocery arithmetic', () => {
  it('adds fractions exactly using safe intermediates', () => {
    expect(
      addQuantities({ numerator: 1, denominator: 3 }, { numerator: 1, denominator: 6 }),
    ).toEqual({ numerator: 1, denominator: 2 });
    expect(
      addQuantities(
        { numerator: 9007199254740990, denominator: 3 },
        { numerator: 1, denominator: 3 },
      ),
    ).toEqual({ numerator: 9007199254740991, denominator: 3 });
    expect(() =>
      addQuantities(
        { numerator: Number.MAX_SAFE_INTEGER, denominator: 1 },
        { numerator: 1, denominator: 1 },
      ),
    ).toThrow(RangeError);
  });
  it('converts only established compatible measures', () => {
    expect(
      convertedMeasure(source({ quantity: { numerator: 1, denominator: 2 }, unitCode: 'kg' })),
    ).toMatchObject({ quantity: { numerator: 500, denominator: 1 }, unitCode: 'g' });
    expect(convertedMeasure(source({ unitCode: 'tbsp' }))).toMatchObject({
      quantity: { numerator: 1, denominator: 1 },
      unitCode: 'tsp',
    });
    expect(convertedMeasure(source({ unitCode: 'cup' }))).toMatchObject({ unitCode: 'cup' });
  });
  it('retains unmeasured, custom, volume and mass contributions separately', () => {
    const sources = [
      source(),
      source({ key: '1:2' }),
      source({ quantity: null }),
      source({ unitText: 'large' }),
      source({ unitCode: 'g' }),
      source({ unitCode: 'ml' }),
    ];
    const result = aggregateIngredients(sources, new Map());
    expect(result).toHaveLength(5);
    expect(result[0].quantity).toEqual({ numerator: 2, denominator: 3 });
    expect(result[0].sources).toHaveLength(2);
    expect(sources[0].quantity).toEqual({ numerator: 1, denominator: 3 });
  });
  it('only merges semantic names supplied by validated normalization', () => {
    const sources = [source({ name: 'scallion' }), source({ name: 'green onion' })];
    expect(aggregateIngredients(sources, new Map())).toHaveLength(2);
    const items = aggregateIngredients(sources, new Map([['scallion', 'green onion']]));
    expect(items).toHaveLength(1);
    const text = groceryListText(items.map((item, id) => ({ ...item, id })));
    expect(text).toContain('green onion');
    expect(text).not.toMatch(/recipeId|sources|confidence|Soup/);
  });
});
