import { afterAll, beforeEach, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { closeDatabase } from '@cookbook/api/db';
import type { GroceryList, MealPlan } from '@cookbook/domain';
import {
  asUser,
  categoryIdByName,
  createTestApp,
  createUser,
  resetDatabase,
} from '../../api/test/helpers.js';
import { createServer } from '../src/server.js';
import { createLogger } from '../src/logger.js';

beforeEach(resetDatabase);
afterAll(closeDatabase);
it('chains MCP mutations into the same data visible to the UI, with configured-user attribution', async () => {
  const user = await createUser();
  const app = createTestApp();
  const http = asUser(app, user.id);
  const response = await http.post('/api/recipes', {
    name: 'MCP Soup',
    description: '',
    baseServings: 4,
    categoryId: await categoryIdByName('Dinner'),
    ingredients: [{ name: 'Onion', quantity: '2' }],
    instructions: [{ body: 'Simmer.' }],
  });
  const recipe = await response.json();
  const { server } = createServer(user, createLogger('error'));
  const client = new Client({ name: 'planning-integration', version: '1' });
  const [left, right] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(left), server.connect(right)]);
  const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
  async function call<T>(name: string, args: Record<string, unknown>): Promise<T> {
    const result = await client.callTool({ name, arguments: args });
    expect(result.isError).not.toBe(true);
    return result.structuredContent as T;
  }
  try {
    let plan = await call<MealPlan>('create_meal_plan', { name: 'MCP dinners' });
    expect(plan.createdByUserId).toBe(user.id);
    plan = await call<MealPlan>('add_recipe_to_meal_plan', {
      mealPlanId: plan.id,
      version: plan.version,
      recipeId: recipe.id,
      servings: 2,
    });
    expect(await (await http.get(`/api/meal-plans/${plan.id}`)).json()).toEqual(plan);
    plan = await call<MealPlan>('update_meal_plan_item', {
      mealPlanId: plan.id,
      itemId: plan.items[0].id,
      version: plan.version,
      servings: 3,
    });
    plan = await call<MealPlan>('confirm_meal_plan', {
      mealPlanId: plan.id,
      version: plan.version,
    });
    expect(plan.status).toBe('confirmed');
    let list = await call<GroceryList>('get_grocery_list', { groceryListId: plan.groceryListId });
    expect(list.items[0].quantity).toEqual({ numerator: 3, denominator: 2 });
    expect(await (await http.get(`/api/grocery-lists/${list.id}`)).json()).toEqual(list);
    list = await call<GroceryList>('add_grocery_list_item', {
      groceryListId: list.id,
      version: list.version,
      name: 'Milk',
      quantity: '1/2',
      unitCode: 'l',
    });
    expect(list.items.at(-1)?.quantity).toEqual({ numerator: 1, denominator: 2 });
    list = await call<GroceryList>('update_grocery_list_item', {
      groceryListId: list.id,
      itemId: list.items.at(-1)!.id,
      version: list.version,
      name: 'Milk',
      quantity: '1',
      unitCode: 'l',
      checked: false,
    });
    list = await call<GroceryList>('check_grocery_list_item', {
      groceryListId: list.id,
      itemId: list.items[0].id,
      version: list.version,
      checked: true,
    });
    expect(list.items[0].checked).toBe(true);
    const stale = await client.callTool({
      name: 'check_grocery_list_item',
      arguments: { groceryListId: list.id, itemId: list.items[0].id, version: 1, checked: false },
    });
    expect(stale.isError).toBe(true);
    list = await call<GroceryList>('remove_grocery_list_item', {
      groceryListId: list.id,
      itemId: list.items.at(-1)!.id,
      version: list.version,
    });
    expect(list.items).toHaveLength(1);
    expect(await call<GroceryList>('get_grocery_list', { groceryListId: list.id })).toEqual(list);
    // A saved plan's meals are closed to MCP exactly as they are to the UI:
    // the lock lives in the service both of them call.
    const closed = await client.callTool({
      name: 'remove_recipe_from_meal_plan',
      arguments: { mealPlanId: plan.id, itemId: plan.items[0].id, version: plan.version },
    });
    expect(closed.isError).toBe(true);
    plan = await call<MealPlan>('reopen_meal_plan', { mealPlanId: plan.id, version: plan.version });
    expect(plan.status).toBe('draft');
    plan = await call<MealPlan>('remove_recipe_from_meal_plan', {
      mealPlanId: plan.id,
      itemId: plan.items[0].id,
      version: plan.version,
    });
    expect(plan.items).toEqual([]);
    expect((await call<MealPlan>('get_meal_plan', { mealPlanId: plan.id })).items).toEqual([]);
    const invalid = await client.callTool({
      name: 'add_recipe_to_meal_plan',
      arguments: { mealPlanId: plan.id, version: plan.version, recipeId: recipe.id, servings: 0 },
    });
    expect(invalid.isError).toBe(true);
  } finally {
    fetch.mockRestore();
    await client.close();
    await server.close();
  }
});
