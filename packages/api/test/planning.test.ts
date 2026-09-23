import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GroceryList, MealPlan, RecipeDetail } from '@cookbook/domain';
import { closeDatabase } from '../src/db/index.js';
import {
  asUser,
  categoryIdByName,
  createTestApp,
  createUser,
  resetDatabase,
  softDeleteRecipe,
} from './helpers.js';
import * as planning from '../src/services/planning.js';
import * as recipeService from '../src/services/recipes.js';
import { recommendMeals } from '../src/services/recommendations.js';
import type { ModelProvider } from '../src/ai/provider.js';

const app = createTestApp();
let user: { id: number };
let recipe: RecipeDetail;
const unavailable: ModelProvider = async () => {
  throw new Error('offline');
};
const output =
  (value: unknown): ModelProvider =>
  async () => ({ value, model: 'fixture', latencyMs: 1, inputTokens: 1, outputTokens: 1 });
beforeEach(async () => {
  await resetDatabase();
  user = await createUser();
  const response = await asUser(app, user.id).post('/api/recipes', {
    name: 'Soup',
    description: '',
    baseServings: 4,
    categoryId: await categoryIdByName('Dinner'),
    prepMinutes: 10,
    cookMinutes: 15,
    ingredients: [
      { name: 'scallion', quantity: '2' },
      { name: 'green onions', quantity: '4' },
      { name: 'salt' },
      { name: 'chicken breast', quantity: '1/2', unitCode: 'kg' },
    ],
    instructions: [{ body: 'Simmer.' }],
  });
  expect(response.status).toBe(201);
  recipe = (await response.json()) as RecipeDetail;
});
afterAll(closeDatabase);
// Saving returns the plan; the one list it built hangs off the plan.
async function save(plan: MealPlan, provider: ModelProvider = unavailable) {
  const saved = await planning.confirmMealPlan(plan.id, plan.version, user.id, provider);
  return { plan: saved, list: await planning.getGroceryList(saved.groceryListId!) };
}
async function planWithMeal() {
  const plan = await planning.createMealPlan({}, user.id);
  return planning.addRecipeToMealPlan(
    plan.id,
    { version: plan.version, recipeId: recipe.id, servings: 2 },
    user.id,
  );
}
describe('persisted planning and grocery services', () => {
  it('shares plans between household users, permits duplicate recipes, and tracks attribution', async () => {
    const first = await planWithMeal();
    const other = await createUser();
    const second = await planning.addRecipeToMealPlan(
      first.id,
      { version: first.version, recipeId: recipe.id, servings: 3 },
      other.id,
    );
    expect(second.items.map((i) => i.servings)).toEqual([2, 3]);
    expect(second.createdByUserId).toBe(user.id);
    expect(second.updatedByUserId).toBe(other.id);
    expect(await planning.getMealPlan(first.id)).toEqual(second);
    const reordered = await planning.updateMealPlanItem(
      second.id,
      second.items[1].id,
      { version: second.version, position: 0 },
      user.id,
    );
    expect(reordered.items.map((i) => i.servings)).toEqual([3, 2]);
    const removed = await planning.removeRecipeFromMealPlan(
      second.id,
      second.items[0].id,
      reordered.version,
      user.id,
    );
    expect(removed.items).toHaveLength(1);
    expect(removed.items[0].position).toBe(0);
  });
  it('serializes concurrent edits and rejects stale versions', async () => {
    const plan = await planWithMeal();
    const results = await Promise.allSettled(
      [2, 3].map((servings) =>
        planning.updateMealPlanItem(
          plan.id,
          plan.items[0].id,
          { version: plan.version, servings },
          user.id,
        ),
      ),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
  });
  it('renames a plan, keeps its meals, allows an untitled name and rejects a stale version', async () => {
    const plan = await planWithMeal();
    const renamed = await planning.renameMealPlan(
      plan.id,
      { version: plan.version, name: '  Dinners this week  ' },
      user.id,
    );
    // Trimmed on the way in, and the meals are untouched by a rename.
    expect(renamed.name).toBe('Dinners this week');
    expect(renamed.items).toHaveLength(1);
    expect(renamed.version).toBeGreaterThan(plan.version);

    // Going back to untitled is a legitimate edit, not a validation failure.
    const cleared = await planning.renameMealPlan(
      plan.id,
      { version: renamed.version, name: '' },
      user.id,
    );
    expect(cleared.name).toBe('');

    await expect(
      planning.renameMealPlan(plan.id, { version: plan.version, name: 'Too late' }, user.id),
    ).rejects.toThrow();
    await expect(
      planning.renameMealPlan(plan.id, { version: cleared.version, name: 'x'.repeat(161) }, user.id),
    ).rejects.toThrow();
  });
  it('deletes a plan with its grocery lists, leaves recipes alone and rejects a stale version', async () => {
    const { plan: saved, list } = await save(await planWithMeal());
    const edited = await planning.renameMealPlan(
      saved.id,
      { version: saved.version, name: 'Edited elsewhere' },
      user.id,
    );

    // A stale version is refused here exactly as it is for any other write, so
    // a plan someone else has just edited is not deleted out from under them.
    await expect(planning.deleteMealPlan(saved.id, saved.version, user.id)).rejects.toThrow();
    const plan = saved;

    await planning.deleteMealPlan(plan.id, edited.version, user.id);
    await expect(planning.getMealPlan(plan.id)).rejects.toThrow();

    // `grocery_lists.meal_plan_id` is `restrict`, so this only passes because
    // the service takes the lists down deliberately and first.
    await expect(planning.getGroceryList(list.id)).rejects.toThrow();

    // The recipes the plan pointed at are untouched.
    const still = await recipeService.getRecipe(recipe.id, user.id);
    expect(still.name).toBe(recipe.name);
  });
  it('moves a plan through draft, saved and done, and refuses a transition from the wrong state', async () => {
    const wrong = { status: 409, code: 'meal_plan_locked' };
    let plan = await planWithMeal();
    expect(plan).toMatchObject({ status: 'draft', confirmedAt: null, groceryListId: null });
    await expect(planning.reopenMealPlan(plan.id, plan.version, user.id)).rejects.toMatchObject(wrong);
    await expect(planning.completeMealPlan(plan.id, plan.version, user.id)).rejects.toMatchObject(wrong);

    ({ plan } = await save(plan));
    expect(plan.status).toBe('confirmed');
    expect(plan.confirmedAt).not.toBeNull();
    expect(plan.groceryListId).toEqual(expect.any(Number));
    await expect(
      planning.confirmMealPlan(plan.id, plan.version, user.id, unavailable),
    ).rejects.toMatchObject(wrong);
    await expect(planning.resumeMealPlan(plan.id, plan.version, user.id)).rejects.toMatchObject(wrong);

    plan = await planning.completeMealPlan(plan.id, plan.version, user.id);
    expect(plan.status).toBe('done');
    expect(plan.completedAt).not.toBeNull();
    plan = await planning.resumeMealPlan(plan.id, plan.version, user.id);
    expect(plan).toMatchObject({ status: 'confirmed', completedAt: null });

    const listId = plan.groceryListId;
    plan = await planning.reopenMealPlan(plan.id, plan.version, user.id);
    // Reopening keeps the list: it stays usable while the meals are edited.
    expect(plan).toMatchObject({ status: 'draft', confirmedAt: null, groceryListId: listId });
  });
  it('closes the meals once saved and the list once done, and always allows rename and delete', async () => {
    const locked = { status: 409, code: 'meal_plan_locked' };
    let { plan, list } = await save(await planWithMeal());

    await expect(
      planning.addRecipeToMealPlan(
        plan.id,
        { version: plan.version, recipeId: recipe.id, servings: 2 },
        user.id,
      ),
    ).rejects.toMatchObject(locked);
    await expect(
      planning.updateMealPlanItem(
        plan.id,
        plan.items[0].id,
        { version: plan.version, servings: 5 },
        user.id,
      ),
    ).rejects.toMatchObject(locked);
    await expect(
      planning.removeRecipeFromMealPlan(plan.id, plan.items[0].id, plan.version, user.id),
    ).rejects.toMatchObject(locked);
    await expect(
      planning.applyMealProposal(
        plan.id,
        { version: plan.version, meals: [{ recipeId: recipe.id, servings: 2 }] },
        user.id,
      ),
    ).rejects.toMatchObject(locked);

    // The list is for shopping from, so saving does not close it.
    list = await planning.checkGroceryListItem(list.id, list.items[0].id, list.version, true, user.id);
    plan = await planning.renameMealPlan(plan.id, { version: plan.version, name: 'Saved' }, user.id);

    plan = await planning.completeMealPlan(plan.id, plan.version, user.id);
    await expect(
      planning.checkGroceryListItem(list.id, list.items[0].id, list.version, false, user.id),
    ).rejects.toMatchObject(locked);
    await expect(
      planning.addGroceryListItem(list.id, { version: list.version, name: 'Milk' }, user.id),
    ).rejects.toMatchObject(locked);
    plan = await planning.renameMealPlan(plan.id, { version: plan.version, name: 'Done' }, user.id);

    // One person may reopen the plan while the other is still in the shop.
    plan = await planning.resumeMealPlan(plan.id, plan.version, user.id);
    plan = await planning.reopenMealPlan(plan.id, plan.version, user.id);
    list = await planning.checkGroceryListItem(list.id, list.items[0].id, list.version, false, user.id);
    expect(list.items[0].checked).toBe(false);

    await planning.deleteMealPlan(plan.id, plan.version, user.id);
  });
  it('carries ticks, removals, hand-added items and merge answers across a save, and says what the meals changed', async () => {
    const provider = output({
      groups: [
        { ids: [0, 1], canonicalName: 'green onion', confidence: 0.6, reason: 'possibly equivalent' },
        { ids: [2], canonicalName: 'salt', confidence: 1, reason: '' },
        { ids: [3], canonicalName: 'chicken breast', confidence: 1, reason: '' },
      ],
    });
    let { plan, list } = await save(await planWithMeal(), provider);
    const listId = list.id;
    list = await planning.resolveGroceryMerge(list.id, list.suggestions[0].id, list.version, true, user.id);
    const named = (name: string) => list.items.find((i) => i.name === name)!;
    list = await planning.checkGroceryListItem(list.id, named('green onion').id, list.version, true, user.id);
    list = await planning.removeGroceryListItem(list.id, named('chicken breast').id, list.version, user.id);
    list = await planning.addGroceryListItem(list.id, { version: list.version, name: 'Paper towels' }, user.id);

    // Reopened and saved with nothing changed: everything the person did holds,
    // and the merge they answered is not asked again.
    plan = await planning.reopenMealPlan(plan.id, plan.version, user.id);
    ({ plan, list } = await save(plan, provider));
    expect(list.id).toBe(listId);
    expect(list.suggestions).toEqual([]);
    expect(list.items.map((i) => i.name).sort()).toEqual(['Paper towels', 'green onion', 'salt']);
    expect(named('green onion').checked).toBe(true);
    expect(list.items.every((i) => i.changedSince === undefined)).toBe(true);

    // Twice the servings: the ticked onions no longer cover it, and the chicken
    // that was removed is needed in a new amount.
    plan = await planning.reopenMealPlan(plan.id, plan.version, user.id);
    plan = await planning.updateMealPlanItem(
      plan.id,
      plan.items[0].id,
      { version: plan.version, servings: 4 },
      user.id,
    );
    ({ plan, list } = await save(plan, provider));
    expect(named('green onion')).toMatchObject({
      checked: false,
      changedSince: 'ticked',
      quantity: { numerator: 6, denominator: 1 },
    });
    expect(named('chicken breast')).toMatchObject({ changedSince: 'removed' });
    // Salt is unmeasured, so doubling the servings asks for nothing new.
    expect(named('salt').changedSince).toBeUndefined();
    expect(named('Paper towels')).toMatchObject({ sources: [] });

    // Acting on a flagged item answers it.
    list = await planning.checkGroceryListItem(list.id, named('green onion').id, list.version, true, user.id);
    expect(named('green onion').changedSince).toBeUndefined();
  });
  it('uses LLM identity with deterministic scaling, conversion, arithmetic and provenance', async () => {
    const { list } = await save(
      await planWithMeal(),
      output({
        groups: [
          { ids: [0, 1], canonicalName: 'green onion', confidence: 0.99, reason: 'same vegetable' },
          { ids: [2], canonicalName: 'salt', confidence: 1, reason: '' },
          { ids: [3], canonicalName: 'chicken breast', confidence: 1, reason: '' },
        ],
      }),
    );
    expect(list.normalization).toBe('llm');
    expect(list.items).toHaveLength(3);
    expect(list.items[0].quantity).toEqual({ numerator: 3, denominator: 1 });
    expect(list.items[0].sources).toHaveLength(2);
    expect(list.items[2]).toMatchObject({
      unitCode: 'g',
      quantity: { numerator: 250, denominator: 1 },
    });
    expect(await planning.getGroceryList(list.id)).toEqual(list);
    const unchanged = await asUser(app, user.id).get(`/api/recipes/${recipe.id}`);
    expect((await unchanged.json()).ingredients[0].quantity).toEqual({
      numerator: 2,
      denominator: 1,
    });
  });
  it('rebuilds the one list in place when a reopened plan is saved again', async () => {
    const first = await save(await planWithMeal());
    expect(first.list.normalization).toBe('fallback');
    expect(first.list.items).toHaveLength(4);
    const reopened = await planning.reopenMealPlan(first.plan.id, first.plan.version, user.id);
    const changed = await planning.updateMealPlanItem(
      reopened.id,
      reopened.items[0].id,
      { version: reopened.version, servings: 8 },
      user.id,
    );
    const second = await save(changed);
    // Same row, so every link and open tab still points at the list; a new
    // version, so anyone holding the old items gets a conflict.
    expect(second.list.id).toBe(first.list.id);
    expect(second.list.version).toBeGreaterThan(first.list.version);
    expect(second.list.items[0].quantity).toEqual({ numerator: 4, denominator: 1 });
  });
  it('rejects a save if the plan changes while the model is running', async () => {
    const plan = await planWithMeal();
    const delayed: ModelProvider = async (request) => {
      await planning.updateMealPlanItem(
        plan.id,
        plan.items[0].id,
        { version: plan.version, servings: 3 },
        user.id,
      );
      return unavailable(request);
    };
    await expect(
      planning.confirmMealPlan(plan.id, plan.version, user.id, delayed),
    ).rejects.toMatchObject({ status: 409 });
    const after = await planning.getMealPlan(plan.id);
    expect(after).toMatchObject({ status: 'draft', groceryListId: null });
  });
  it('keeps the list when a recipe is trashed and refuses to save around an unavailable recipe', async () => {
    const { plan, list } = await save(await planWithMeal());
    await softDeleteRecipe(recipe.id, user.id);
    expect((await planning.getMealPlan(plan.id)).items[0].unavailable).toBe(true);
    const reopened = await planning.reopenMealPlan(plan.id, plan.version, user.id);
    await expect(
      planning.confirmMealPlan(plan.id, reopened.version, user.id, unavailable),
    ).rejects.toMatchObject({ status: 400 });
    // The list is what was shopped from, and a failed save does not touch it.
    expect(await planning.getGroceryList(list.id)).toEqual(list);
  });
  it('supports manual edits, checking and removal while retaining provenance', async () => {
    let { list } = await save(await planWithMeal());
    const original = list.items[0];
    list = await planning.updateGroceryListItem(
      list.id,
      original.id,
      { version: list.version, name: 'onions', quantity: '1/2' },
      user.id,
    );
    expect(list.items[0].sources).toEqual(original.sources);
    expect(list.items[0].edited).toBe(true);
    list = await planning.checkGroceryListItem(list.id, original.id, list.version, true, user.id);
    expect(list.items[0].checked).toBe(true);
    list = await planning.addGroceryListItem(
      list.id,
      { version: list.version, name: 'Paper towels' },
      user.id,
    );
    expect(list.items.at(-1)).toMatchObject({ name: 'Paper towels', quantity: null, sources: [] });
    list = await planning.removeGroceryListItem(list.id, original.id, list.version, user.id);
    expect(list.items.some((i) => i.id === original.id)).toBe(false);
  });
  it('requires explicit review for uncalibrated equivalences and merges only on acceptance', async () => {
    let { list } = await save(
      await planWithMeal(),
      output({
        groups: [
          {
            ids: [0, 1],
            canonicalName: 'green onion',
            confidence: 0.6,
            reason: 'possibly equivalent',
          },
          { ids: [2], canonicalName: 'salt', confidence: 1, reason: '' },
          { ids: [3], canonicalName: 'chicken breast', confidence: 1, reason: '' },
        ],
      }),
    );
    expect(list.items).toHaveLength(4);
    expect(list.suggestions).toHaveLength(1);
    list = await planning.resolveGroceryMerge(
      list.id,
      list.suggestions[0].id,
      list.version,
      true,
      user.id,
    );
    expect(list.items).toHaveLength(3);
    expect(list.suggestions).toEqual([]);
    expect(list.items[0].quantity).toEqual({ numerator: 3, denominator: 1 });
  });
  it('does not apply a recommendation until accepted and validates recipe IDs at acceptance', async () => {
    const plan = await planWithMeal();
    const proposal = await recommendMeals(
      { count: 1, servings: 3 },
      user.id,
      output({ recipeIds: [recipe.id], explanation: 'A quick dinner.' }),
    );
    expect(proposal.mode).toBe('llm');
    expect(await planning.getMealPlan(plan.id)).toEqual(plan);
    const accepted = await planning.applyMealProposal(
      plan.id,
      {
        version: plan.version,
        meals: proposal.meals.map(({ recipeId, servings }) => ({ recipeId, servings })),
      },
      user.id,
    );
    expect(accepted.items[0].servings).toBe(3);
    await expect(
      planning.applyMealProposal(
        plan.id,
        { version: accepted.version, meals: [{ recipeId: 999999, servings: 2 }] },
        user.id,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(await planning.getMealPlan(plan.id)).toEqual(accepted);
  });
  it('rejects invented recommendations and uses bounded deterministic fallback with honest explanation', async () => {
    const proposal = await recommendMeals(
      { count: 1, preference: 'no pasta' },
      user.id,
      output({ recipeIds: [999999], explanation: 'Invented' }),
    );
    expect(proposal.mode).toBe('fallback');
    expect(proposal.meals[0].recipeId).toBe(recipe.id);
    expect(proposal.explanation).toContain('not been interpreted');
    const empty = await recommendMeals({ maxTotalMinutes: 1 }, user.id, unavailable);
    expect(empty.meals).toEqual([]);
    await planWithMeal();
    expect((await recommendMeals({ avoidRecentlyUsed: true }, user.id, unavailable)).meals).toEqual(
      [],
    );
  });
});
describe('planning HTTP boundary', () => {
  it('authenticates reads and writes and returns validation errors', async () => {
    const guest = asUser(app, null);
    const client = asUser(app, user.id);
    expect((await guest.get('/api/meal-plans')).status).toBe(401);
    expect((await guest.post('/api/meal-plans', {})).status).toBe(401);
    expect((await guest.get('/api/grocery-lists/1')).status).toBe(401);
    expect((await client.post('/api/meal-plans', { userId: 999 })).status).toBe(400);
    expect((await client.post('/api/meal-plans', '{')).status).toBe(400);
    const response = await client.post('/api/meal-plans', {});
    const plan = (await response.json()) as MealPlan;
    expect(response.status).toBe(201);
    expect(
      (
        await client.post(`/api/meal-plans/${plan.id}/items`, {
          version: plan.version,
          recipeId: recipe.id,
          servings: 0,
        })
      ).status,
    ).toBe(400);
  });
  it('uses the same persisted data through HTTP and services', async () => {
    const client = asUser(app, user.id);
    const plan = await planWithMeal();
    // Network calls are fixture-controlled; CI must never spend tokens.
    const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    try {
      const response = await client.post(`/api/meal-plans/${plan.id}/confirm`, {
        version: plan.version,
      });
      expect(response.status).toBe(200);
      const saved = (await response.json()) as MealPlan;
      expect(saved.status).toBe('confirmed');
      expect(await planning.getMealPlan(plan.id)).toEqual(saved);
      const list = (await (
        await client.get(`/api/grocery-lists/${saved.groceryListId}`)
      ).json()) as GroceryList;
      expect(await planning.getGroceryList(list.id)).toEqual(list);
      const changed = await client.post(`/api/grocery-lists/${list.id}/items`, {
        version: list.version,
        name: 'Milk',
        quantity: '1/2',
        unitCode: 'l',
      });
      expect(changed.status).toBe(200);
      expect((await changed.json()).items.at(-1).quantity).toEqual({
        numerator: 1,
        denominator: 2,
      });
    } finally {
      network.mockRestore();
    }
  });
});
