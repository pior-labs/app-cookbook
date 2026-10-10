import { afterAll, afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { closeDatabase, db } from '@cookbook/api/db';
import {
  asUser,
  categoryIdByName,
  createTestApp,
  createUser,
  resetDatabase,
} from '../../api/test/helpers.js';
import { createServer } from '../src/server.js';
import { createLogger } from '../src/logger.js';
import type { RecipeImportDraft, RecipeDetail, MealPlan, GroceryList } from '@cookbook/domain';
const ai = vi.hoisted(() => vi.fn());
vi.mock('../../api/src/ai/provider.js', () => ({ openAIProvider: ai, aiEvent: vi.fn() }));
beforeEach(resetDatabase);
afterEach(() => vi.resetAllMocks());
afterAll(closeDatabase);
it('previews without writes, creates after approval, then feeds a real meal plan and grocery list', async () => {
  const user = await createUser();
  const http = asUser(createTestApp(), user.id);
  const { server } = createServer(user, createLogger('error'));
  const client = new Client({ name: 'import-integration', version: '1' });
  const [left, right] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(left), server.connect(right)]);
  ai.mockResolvedValueOnce({
    value: {
      name: 'Imported soup',
      description: '',
      baseServings: 2,
      prepMinutes: null,
      cookMinutes: null,
      notes: null,
      ingredients: [
        {
          name: 'Onion',
          quantity: '1 1/2',
          unitCode: null,
          unitText: null,
          preparation: 'diced',
          originalText: '1 1/2 onions, diced',
          section: 'Sauce',
        },
      ],
      instructions: [{ body: 'Simmer.', section: 'Simmer' }, { body: 'Pour.', section: 'Serve' }],
      warnings: [],
    },
  });
  async function call<T>(name: string, args: Record<string, unknown>): Promise<T> {
    const result = await client.callTool({ name, arguments: args });
    expect(result.isError, JSON.stringify(result.content)).not.toBe(true);
    return result.structuredContent as T;
  }
  try {
    const { draft } = await call<{ draft: RecipeImportDraft }>('preview_recipe_import', {
      text: 'Imported soup. Serves 2. 1 1/2 onions, diced. Simmer.',
    });
    expect(await db.query.recipes.findMany()).toHaveLength(0);
    const { warnings: _warnings, duplicates: _duplicates, photoDataUrl: _photo, ...recipe } = draft;
    const { recipe: saved } = await call<{ recipe: RecipeDetail }>('create_recipe', {
      confirmed: true,
      recipe: { ...recipe, categoryId: await categoryIdByName('Dinner') },
    });
    expect(saved.createdByUserId).toBe(user.id);
    expect(saved.importMethod).toBe('text');
    expect(saved.ingredients[0].section).toBe('Sauce');
    expect(saved.instructions.map(row => row.section)).toEqual(['Simmer', 'Serve']);
    expect(await (await http.get(`/api/recipes/${saved.id}`)).json()).toEqual(saved);
    const detail = await call<{ recipe: { ingredients: { section: string; quantity: string }[]; instructions: { section: string; position: number }[] } }>('get_recipe', { recipeId: saved.id, servings: 4 });
    expect(detail.recipe.ingredients[0]).toMatchObject({ section: 'Sauce', quantity: '3' });
    expect(detail.recipe.instructions).toEqual([
      expect.objectContaining({ section: 'Simmer', position: 0 }),
      expect.objectContaining({ section: 'Serve', position: 1 }),
    ]);
    const scaled = await call<{ ingredients: { section: string; quantity: string }[] }>('scale_recipe', { recipeId: saved.id, servings: 4 });
    expect(scaled.ingredients[0]).toMatchObject({ section: 'Sauce', quantity: '3' });
    const rendered = await client.callTool({ name: 'get_recipe', arguments: { recipeId: saved.id } });
    expect(JSON.stringify(rendered.content)).toContain('### Sauce');
    expect(JSON.stringify(rendered.content)).toContain('2. Pour.');
    const invalid = await client.callTool({ name: 'create_recipe', arguments: {
      confirmed: true,
      recipe: { ...recipe, categoryId: await categoryIdByName('Dinner'), instructions: [
        { body: 'Mix.', section: 'Mix' }, { body: 'Pour.', section: null },
      ] },
    } });
    expect(invalid.isError).toBe(true);
    expect(JSON.stringify(invalid.content)).toContain('instructions.1.section');
    expect(await db.query.recipes.findMany()).toHaveLength(1);
    ai.mockRejectedValue(new Error('offline'));
    let plan = await call<MealPlan>('create_meal_plan', {});
    plan = await call<MealPlan>('add_recipe_to_meal_plan', {
      mealPlanId: plan.id,
      version: plan.version,
      recipeId: saved.id,
      servings: 4,
    });
    plan = await call<MealPlan>('confirm_meal_plan', {
      mealPlanId: plan.id,
      version: plan.version,
    });
    const list = await call<GroceryList>('get_grocery_list', { groceryListId: plan.groceryListId });
    expect(list.items[0].quantity).toEqual({ numerator: 3, denominator: 1 });
  } finally {
    await client.close();
    await server.close();
  }
});
