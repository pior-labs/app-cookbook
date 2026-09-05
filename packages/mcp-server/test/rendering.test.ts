import { makeFraction, type RecipeIngredient, type RecipeSummary } from '@cookbook/domain';
import { describe, expect, it } from 'vitest';
import {
  formatIngredient,
  formatSummaryLine,
  formatSummaryList,
  toScaledIngredient,
} from '../src/tools/helpers.js';

// What a tool hands back is read aloud to a person, so these cover the
// rendering rather than the queries behind it - the queries are the API's own
// integration suite.

function ingredient(overrides: Partial<RecipeIngredient> = {}): RecipeIngredient {
  return {
    id: 1,
    position: 1,
    quantity: makeFraction(1, 2),
    unitCode: 'cup',
    unitText: null,
    name: 'onion',
    preparation: 'finely chopped',
    ...overrides,
  };
}

function summary(overrides: Partial<RecipeSummary> = {}): RecipeSummary {
  return {
    id: 7,
    name: 'Weeknight Green Curry',
    description: 'Fast and green.',
    categoryId: 2,
    categoryName: 'Dinner',
    prepMinutes: 10,
    cookMinutes: 25,
    totalMinutes: 35,
    rating: { average: null, count: 0 },
    hasImage: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    userState: { favorite: false, rating: null },
    ...overrides,
  };
}

describe('ingredient rendering', () => {
  it('reads as quantity, unit, ingredient, preparation', () => {
    expect(formatIngredient(ingredient(), 4, 4)).toBe('½ cups onion, finely chopped');
  });

  it('scales the quantity without touching the rest of the line', () => {
    expect(formatIngredient(ingredient(), 4, 8)).toBe('1 cup onion, finely chopped');
    expect(formatIngredient(ingredient(), 4, 2)).toBe('¼ cups onion, finely chopped');
  });

  it('keeps exact thirds as fractions rather than decimals', () => {
    const line = formatIngredient(ingredient({ quantity: makeFraction(1, 1) }), 3, 1);
    expect(line).toBe('⅓ cups onion, finely chopped');
  });

  // Recorded rather than asserted as desirable. `unitLabel` treats any amount
  // other than exactly 1 as plural - documented and unit-tested in
  // `@cookbook/domain` - which reads correctly for "0.5 cups" and awkwardly for
  // "½ cups". The recipe screen renders it the same way, so this is the
  // application's existing behavior and not something the MCP layer should
  // diverge from on its own.
  it('pluralizes a fractional unit exactly as the recipe screen does', () => {
    expect(formatIngredient(ingredient(), 4, 4)).toContain('cups');
    expect(formatIngredient(ingredient(), 4, 8)).toContain('1 cup ');
  });

  it('uses the custom unit text when the ingredient has no registered unit', () => {
    const line = formatIngredient(
      ingredient({ unitCode: null, unitText: 'handful', preparation: null }),
      4,
      4,
    );
    expect(line).toBe('½ handful onion');
  });

  it('renders an ingredient with no quantity as just its name', () => {
    const line = formatIngredient(
      ingredient({ quantity: null, unitCode: null, name: 'flaky sea salt', preparation: null }),
      4,
      4,
    );
    expect(line).toBe('flaky sea salt');
  });

  it('carries both a readable amount and a number for a caller doing its own arithmetic', () => {
    const scaled = toScaledIngredient(ingredient(), 4, 8);
    expect(scaled.quantity).toBe('1');
    expect(scaled.quantityDecimal).toBe(1);
    expect(scaled.display).toBe('1 cup onion, finely chopped');
  });

  it('leaves quantity null rather than inventing one when there is none', () => {
    const scaled = toScaledIngredient(ingredient({ quantity: null, unitCode: null }), 4, 8);
    expect(scaled.quantity).toBeNull();
    expect(scaled.quantityDecimal).toBeNull();
  });
});

describe('summary rendering', () => {
  it('names the recipe with the facts used to choose one', () => {
    expect(formatSummaryLine(summary())).toBe(
      '- [7] Weeknight Green Curry (Dinner, 35 min) - Fast and green.',
    );
  });

  it('renders long times in hours', () => {
    const line = formatSummaryLine(summary({ totalMinutes: 240, prepMinutes: 30, cookMinutes: 210 }));
    expect(line).toContain('4 hr');
  });

  it('reports the household average separately from the reader s own rating', () => {
    const line = formatSummaryLine(
      summary({ rating: { average: 4.5, count: 2 }, userState: { favorite: true, rating: 5 } }),
    );
    expect(line).toContain('rated 4.5/5 by 2 cooks');
    expect(line).toContain('favorited');
    expect(line).toContain('you rated it 5/5');
  });

  it('says nothing about a rating no one has given', () => {
    expect(formatSummaryLine(summary())).not.toContain('rated');
  });

  it('answers an empty result with the caller s own wording rather than a blank list', () => {
    expect(formatSummaryList('Found:', [], 'You have not favorited anything yet.')).toBe(
      'You have not favorited anything yet.',
    );
  });
});
