import { describe, expect, it } from 'vitest';
import { MAX_INT32, idParamSchema, idSchema, quantitySchema } from './primitives.js';
import { createRecipeSchema, updateRecipeSchema } from './recipe.js';

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Lemon Pasta',
    description: 'Bright and quick.',
    baseServings: 4,
    prepMinutes: 10,
    cookMinutes: 15,
    notes: null,
    categoryId: 3,
    ingredients: [{ name: 'Spaghetti', quantity: '1/2', unitCode: 'kg' }],
    instructions: [{ body: 'Boil the pasta.' }],
    tagIds: [1, 2],
    ...overrides,
  };
}

describe('createRecipeSchema', () => {
  it('accepts a valid recipe and parses the quantity into a fraction', () => {
    const result = createRecipeSchema.safeParse(baseInput());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ingredients[0].quantity).toEqual({ numerator: 1, denominator: 2 });
      expect(result.data.ingredients[0].unitText).toBeNull();
      expect(result.data.sourceUrl).toBeNull();
    }
  });

  it('treats an empty quantity as no quantity', () => {
    const result = createRecipeSchema.safeParse(
      baseInput({ ingredients: [{ name: 'Salt', quantity: '' }] }),
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ingredients[0].quantity).toBeNull();
    }
  });

  it('rejects an ingredient with both a known and a custom unit', () => {
    const result = createRecipeSchema.safeParse(
      baseInput({ ingredients: [{ name: 'Garlic', quantity: '2', unitCode: 'g', unitText: 'clove' }] }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects both a source url and source text', () => {
    const result = createRecipeSchema.safeParse(
      baseInput({ sourceUrl: 'https://example.com', sourceText: 'From a friend' }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects duplicate tag ids', () => {
    const result = createRecipeSchema.safeParse(baseInput({ tagIds: [1, 1] }));
    expect(result.success).toBe(false);
  });

  it('requires at least one ingredient and one instruction', () => {
    expect(createRecipeSchema.safeParse(baseInput({ ingredients: [] })).success).toBe(false);
    expect(createRecipeSchema.safeParse(baseInput({ instructions: [] })).success).toBe(false);
  });

  it('enforces the name length bound', () => {
    expect(createRecipeSchema.safeParse(baseInput({ name: '' })).success).toBe(false);
    expect(createRecipeSchema.safeParse(baseInput({ name: 'x'.repeat(161) })).success).toBe(false);
  });

  it('rejects unknown fields', () => {
    expect(createRecipeSchema.safeParse(baseInput({ surprise: true })).success).toBe(false);
  });

  it('defaults tagIds to an empty array when omitted', () => {
    const input = baseInput();
    delete (input as Record<string, unknown>).tagIds;
    const result = createRecipeSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tagIds).toEqual([]);
    }
  });
});

describe('updateRecipeSchema', () => {
  it('requires a version', () => {
    expect(updateRecipeSchema.safeParse(baseInput()).success).toBe(false);
    expect(updateRecipeSchema.safeParse(baseInput({ version: 2 })).success).toBe(true);
  });
});

describe('storable bounds', () => {
  it('rejects a quantity whose reduced numerator exceeds the integer column', () => {
    expect(quantitySchema.safeParse(String(MAX_INT32)).success).toBe(true);
    expect(quantitySchema.safeParse(String(MAX_INT32 + 1)).success).toBe(false);
    // A mixed number reduces to a numerator far larger than either written part.
    expect(quantitySchema.safeParse('215000 1/10000').success).toBe(false);
  });

  it('rejects ids beyond the serial column', () => {
    expect(idSchema.safeParse(MAX_INT32).success).toBe(true);
    expect(idSchema.safeParse(MAX_INT32 + 1).success).toBe(false);
    expect(idParamSchema.safeParse(String(MAX_INT32 + 1)).success).toBe(false);
  });

  it('accepts only plain decimal ids in a route parameter', () => {
    expect(idParamSchema.safeParse('12').data).toBe(12);

    for (const alias of ['0x1', '1e0', '+1', '01', '1.0', ' 1 ', '', '0']) {
      expect(idParamSchema.safeParse(alias).success).toBe(false);
    }
  });
});
