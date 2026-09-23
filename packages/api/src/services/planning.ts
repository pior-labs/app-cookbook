import { z } from 'zod';
import {
  addMealSchema,
  applyMealsSchema,
  createMealPlanSchema,
  renameMealPlanSchema,
  idSchema,
  updateMealSchema,
  versionSchema,
  aggregateIngredients,
  scaleQuantity,
  normalizeName,
  groceryItemInputSchema,
  addQuantities,
  measureKey,
  totalMinutes,
  type GroceryList,
  type MealPlan,
  type IngredientSource,
  type MergeSuggestion,
  type MealPlanStatus,
  carryForward,
  dismissalFor,
  mergeDecisionFor,
  type DraftSuggestion,
  type PriorList,
} from '@cookbook/domain';
import { db } from '../db/index.js';
import { conflictError, notFoundError, validationError, zodValidationError } from '../errors.js';
import * as repo from '../repositories/planning.js';
import { findRecipeAggregate, type DbExecutor } from '../repositories/index.js';
import { normalizeIngredients } from '../ai/normalization.js';
import type { ModelProvider } from '../ai/provider.js';

// Every entry point validates, including calls made outside HTTP. Identity is
// supplied by the authenticated adapter, never by a model/request body.
function parse<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) throw zodValidationError(result.error);
  return result.data;
}
const missing = () =>
  notFoundError('planning_not_found', 'This plan, list, or item no longer exists.');
const stale = () =>
  conflictError(
    'planning_version_conflict',
    'This changed since you opened it. Reload and try again.',
  );
async function lockPlan(tx: DbExecutor, id: number, version: number) {
  parse(idSchema, id);
  parse(versionSchema, version);
  const row = await repo.findPlan(tx, id, true);
  if (!row) throw missing();
  if (row.version !== version) throw stale();
  return row;
}

// The lock is enforced here rather than only hidden in the UI, because MCP calls
// these same services and has no UI to hide anything in (ADR 0010).
const lockedMessages: Record<MealPlanStatus, string> = {
  draft: 'This plan is still being planned. Save it first.',
  confirmed: 'This plan is saved. Choose Edit plan to change its meals.',
  done: 'This plan is done. Move it back to shopping to change it.',
};
function requireStatus(row: { status: MealPlanStatus }, ...allowed: MealPlanStatus[]) {
  if (!allowed.includes(row.status))
    throw conflictError('meal_plan_locked', lockedMessages[row.status]);
}
// Meals change only while the plan is a draft.
async function lockDraft(tx: DbExecutor, id: number, version: number) {
  const row = await lockPlan(tx, id, version);
  requireStatus(row, 'draft');
  return row;
}
async function readPlan(tx: DbExecutor, id: number): Promise<MealPlan> {
  const row = await repo.findPlan(tx, parse(idSchema, id));
  if (!row) throw missing();
  const items = await repo.planItems(tx, id);
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    items: items.map((item) => {
      // A meal whose recipe was deleted keeps the name it was planned under,
      // and loses the rest: there is no card to draw for a recipe that is not
      // there, and showing its last known photo would imply it still is.
      const unavailable = !item.recipeId || item.deletedAt != null;
      return {
        id: item.id,
        recipeId: item.recipeId,
        recipeName: item.currentName ?? item.recipeName,
        servings: item.servings,
        position: item.position,
        unavailable,
        categoryName: unavailable ? null : item.categoryName,
        totalMinutes: unavailable ? null : totalMinutes(item.prepMinutes, item.cookMinutes),
        hasImage: unavailable ? false : item.hasImage,
      };
    }),
    groceryListId: (await repo.planList(tx, id))?.id ?? null,
  };
}
export async function getMealPlan(id: number): Promise<MealPlan> {
  return db.transaction((tx) => readPlan(tx, id), {
    isolationLevel: 'repeatable read',
    accessMode: 'read only',
  });
}
export async function listMealPlans(): Promise<MealPlan[]> {
  return db.transaction(
    async (tx) => {
      const rows = await repo.listPlans(tx);
      const plans: MealPlan[] = [];
      for (const row of rows) plans.push(await readPlan(tx, row.id));
      return plans;
    },
    { isolationLevel: 'repeatable read', accessMode: 'read only' },
  );
}
export async function createMealPlan(input: unknown, userId: number): Promise<MealPlan> {
  const value = parse(createMealPlanSchema, input);
  parse(idSchema, userId);
  return db.transaction(async (tx) =>
    readPlan(tx, (await repo.insertPlan(tx, value.name, userId)).id),
  );
}
// Renaming takes the plan's version like every other write to it, so two people
// editing the same plan from two phones get the same stale-version answer they
// would get for any other change rather than one silently overwriting the other.
export async function renameMealPlan(
  id: number,
  input: unknown,
  userId: number,
): Promise<MealPlan> {
  const value = parse(renameMealPlanSchema, input);
  parse(idSchema, userId);
  return db.transaction(async (tx) => {
    await lockPlan(tx, id, value.version);
    await repo.setPlanName(tx, id, value.name);
    await repo.touchPlan(tx, id, userId);
    return readPlan(tx, id);
  });
}
// A plan goes stale - a week passes, the meals were cooked - and there is no
// value in keeping it. Unlike a recipe, which ADR 0005 makes recoverable
// because it is written once and hard to reproduce, a plan is a handful of
// pointers and a serving count, so this destroys it outright.
//
// `grocery_lists.meal_plan_id` is `restrict` on purpose: ADR 0008 protects a
// list's manual shopping edits from being destroyed as a side effect of a plan
// operation. Deleting the lists here, explicitly and first, is the deliberate
// exception - and leaving the constraint in place keeps it a guard, so no
// future path can take a shopping list down with a plan without saying so.
export async function deleteMealPlan(
  id: number,
  version: number,
  userId: number,
): Promise<void> {
  parse(idSchema, userId);
  await db.transaction(async (tx) => {
    await lockPlan(tx, id, version);
    await repo.deletePlanLists(tx, id);
    await repo.deletePlan(tx, id);
  });
}
async function addSelectedMeal(
  tx: DbExecutor,
  planId: number,
  recipeId: number,
  servings: number,
  position: number,
) {
  const recipe = await repo.activeMealRecipe(tx, recipeId);
  if (!recipe) throw validationError('Choose an available recipe.');
  await repo.insertMeal(tx, planId, { recipeId, recipeName: recipe.name, servings, position });
}
export async function addRecipeToMealPlan(
  id: number,
  input: unknown,
  userId: number,
): Promise<MealPlan> {
  const value = parse(addMealSchema, input);
  parse(idSchema, userId);
  return db.transaction(async (tx) => {
    await lockDraft(tx, id, value.version);
    const items = await repo.planItems(tx, id);
    if (items.length >= 50) throw validationError('A plan can contain up to 50 meals.');
    await addSelectedMeal(tx, id, value.recipeId, value.servings, items.length);
    await repo.touchPlan(tx, id, userId);
    return readPlan(tx, id);
  });
}
export async function updateMealPlanItem(
  id: number,
  itemId: number,
  input: unknown,
  userId: number,
): Promise<MealPlan> {
  const value = parse(updateMealSchema, input);
  parse(idSchema, itemId);
  parse(idSchema, userId);
  return db.transaction(async (tx) => {
    await lockDraft(tx, id, value.version);
    const items = await repo.planItems(tx, id);
    const item = items.find((row) => row.id === itemId);
    if (!item) throw missing();
    if (value.recipeId != null) {
      const recipe = await repo.activeMealRecipe(tx, value.recipeId);
      if (!recipe) throw validationError('Choose an available recipe.');
      await repo.changeMeal(tx, itemId, { recipeId: recipe.id, recipeName: recipe.name });
    }
    if (value.servings != null) await repo.changeMeal(tx, itemId, { servings: value.servings });
    if (value.position != null) {
      if (value.position >= items.length)
        throw validationError('Choose a position within this plan.');
      const ordered = items.filter((row) => row.id !== itemId);
      ordered.splice(value.position, 0, item);
      for (const [position, row] of ordered.entries())
        await repo.changeMeal(tx, row.id, { position });
    }
    await repo.touchPlan(tx, id, userId);
    return readPlan(tx, id);
  });
}
export async function removeRecipeFromMealPlan(
  id: number,
  itemId: number,
  version: number,
  userId: number,
): Promise<MealPlan> {
  parse(idSchema, itemId);
  parse(idSchema, userId);
  return db.transaction(async (tx) => {
    await lockDraft(tx, id, version);
    const items = await repo.planItems(tx, id);
    if (!items.some((item) => item.id === itemId)) throw missing();
    await repo.deleteMeal(tx, itemId);
    for (const [position, item] of items.filter((item) => item.id !== itemId).entries())
      await repo.changeMeal(tx, item.id, { position });
    await repo.touchPlan(tx, id, userId);
    return readPlan(tx, id);
  });
}
export async function applyMealProposal(
  id: number,
  input: unknown,
  userId: number,
): Promise<MealPlan> {
  const value = parse(applyMealsSchema, input);
  parse(idSchema, userId);
  return db.transaction(async (tx) => {
    await lockDraft(tx, id, value.version);
    await repo.clearMeals(tx, id);
    for (const [position, meal] of value.meals.entries())
      await addSelectedMeal(tx, id, meal.recipeId, meal.servings, position);
    await repo.touchPlan(tx, id, userId);
    return readPlan(tx, id);
  });
}
async function readList(tx: DbExecutor, id: number): Promise<GroceryList> {
  const found = await repo.findList(tx, parse(idSchema, id));
  if (!found) throw missing();
  // What a rebuild carries forward is bookkeeping for the next save, not part
  // of the list anyone reads.
  const { mergeDecisions: _decisions, dismissed: _dismissed, ...row } = found;
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    items: await repo.listItems(tx, id),
  };
}
export async function getGroceryList(id: number): Promise<GroceryList> {
  return db.transaction((tx) => readList(tx, id), {
    isolationLevel: 'repeatable read',
    accessMode: 'read only',
  });
}
// Saving a plan closes its meals and builds its one grocery list. Saving it again
// after Edit plan rebuilds that same list and carries forward what people did
// to it - ticks, edits, removals, merges - so reopening a plan to add a dinner
// never throws away a shop that is half done (ADR 0010).
export async function confirmMealPlan(
  id: number,
  version: number,
  userId: number,
  provider?: ModelProvider,
): Promise<MealPlan> {
  parse(idSchema, userId);
  // Capture a consistent recipe/plan snapshot, release the connection during
  // network work, then recheck versions under locks before persisting. A slow
  // model must never keep household edits waiting on a database transaction.
  const captured = await db.transaction(async (tx) => {
    await lockDraft(tx, id, version);
    const items = await repo.planItems(tx, id);
    if (!items.length) throw validationError('Add a recipe before saving this plan.');
    const sources: IngredientSource[] = [];
    const versions = new Map<number, number>();
    for (const item of items) {
      if (!item.recipeId) throw validationError('Remove or replace unavailable recipes first.');
      const parent = await repo.activeMealRecipe(tx, item.recipeId);
      const recipe = parent && (await findRecipeAggregate(tx, item.recipeId));
      if (!recipe) throw validationError('Remove or replace unavailable recipes first.');
      versions.set(recipe.id, recipe.version);
      for (const ingredient of recipe.ingredients)
        sources.push({
          key: `${item.id}:${ingredient.id}`,
          recipeId: recipe.id,
          recipeName: recipe.name,
          recipeVersion: recipe.version,
          mealItemId: item.id,
          name: ingredient.name,
          preparation: ingredient.preparation,
          quantity:
            ingredient.quantityNumerator != null && ingredient.quantityDenominator != null
              ? scaleQuantity(
                  {
                    numerator: ingredient.quantityNumerator,
                    denominator: ingredient.quantityDenominator,
                  },
                  recipe.baseServings,
                  item.servings,
                )
              : null,
          unitCode: ingredient.unitCode,
          unitText: ingredient.unitText,
        });
    }
    return { sources, versions };
  });
  const normalized = await normalizeIngredients(
    captured.sources.map((s) => s.name),
    provider,
  );
  let generated;
  try {
    generated = aggregateIngredients(captured.sources, normalized.identities);
  } catch {
    throw validationError(
      'These quantities are too large to combine exactly. Reduce planned servings.',
    );
  }
  const suggested: DraftSuggestion[] = [];
  for (const candidate of normalized.suggestions) {
    // One semantic group may span incompatible measures. Review only offers
    // groups whose actual quantities can be combined deterministically.
    const compatible = new Map<string, number[]>();
    generated.forEach((item, index) => {
      if (item.sources.some((s) => candidate.names.includes(normalizeName(s.name)))) {
        const key = measureKey(item);
        compatible.set(key, [...(compatible.get(key) ?? []), index]);
      }
    });
    for (const indices of compatible.values())
      if (indices.length > 1)
        suggested.push({ canonicalName: candidate.canonicalName, indices, reason: candidate.reason });
  }
  return db.transaction(async (tx) => {
    await lockDraft(tx, id, version);
    for (const [recipeId, expected] of [...captured.versions].sort(([a], [b]) => a - b)) {
      const recipe = await repo.activeMealRecipe(tx, recipeId);
      if (!recipe || recipe.version !== expected) throw stale();
    }
    // Read under lock, and only now: anything ticked on the old list while the
    // model was working is still carried forward.
    const existing = await repo.planList(tx, id, true);
    const prior: PriorList = existing
      ? {
          items: await repo.listItems(tx, existing.id),
          mergeDecisions: existing.mergeDecisions,
          dismissed: existing.dismissed,
        }
      : { items: [], mergeDecisions: [], dismissed: [] };
    const carried = carryForward(generated, suggested, prior);

    let listId: number;
    if (existing) {
      await repo.rewriteList(tx, existing.id, {
        planVersion: version,
        normalization: normalized.mode,
        userId,
      });
      listId = existing.id;
    } else {
      listId = (await repo.insertList(tx, id, version, normalized.mode, userId)).id;
    }
    const ids: number[] = [];
    for (const item of carried.items)
      ids.push((await repo.insertGroceryItem(tx, listId, item)).id);
    await repo.setSuggestions(
      tx,
      listId,
      carried.suggestions.map((s, index) => ({
        id: index + 1,
        canonicalName: s.canonicalName,
        itemIds: s.indices.map((i) => ids[i]),
        reason: s.reason,
      })),
    );
    await repo.setCarry(tx, listId, { dismissed: carried.dismissed });
    await repo.setPlanState(tx, id, { status: 'confirmed', confirmedAt: new Date() });
    await repo.touchPlan(tx, id, userId);
    return readPlan(tx, id);
  });
}

// The other three transitions. None asks for confirmation in the UI, because
// none loses anything: a reopened plan keeps its list usable and carries its
// edits forward on the next save, and done can be undone.
async function transition(
  id: number,
  version: number,
  userId: number,
  from: MealPlanStatus,
  to: { status: MealPlanStatus; confirmedAt?: Date | null; completedAt?: Date | null },
): Promise<MealPlan> {
  parse(idSchema, userId);
  return db.transaction(async (tx) => {
    const row = await lockPlan(tx, id, version);
    requireStatus(row, from);
    await repo.setPlanState(tx, id, to);
    await repo.touchPlan(tx, id, userId);
    return readPlan(tx, id);
  });
}
export const reopenMealPlan = (id: number, version: number, userId: number) =>
  transition(id, version, userId, 'confirmed', { status: 'draft', confirmedAt: null });
export const completeMealPlan = (id: number, version: number, userId: number) =>
  transition(id, version, userId, 'confirmed', { status: 'done', completedAt: new Date() });
export const resumeMealPlan = (id: number, version: number, userId: number) =>
  transition(id, version, userId, 'done', { status: 'confirmed', completedAt: null });

// A list stays usable while its plan is a draft - one person may reopen the plan
// while the other is standing in the shop - and closes once the plan is done.
async function mutateList(
  id: number,
  version: number,
  userId: number,
  action: (
    tx: DbExecutor,
    list: GroceryList,
    row: NonNullable<Awaited<ReturnType<typeof repo.findList>>>,
  ) => Promise<void>,
): Promise<GroceryList> {
  parse(idSchema, id);
  parse(versionSchema, version);
  parse(idSchema, userId);
  return db.transaction(async (tx) => {
    const row = await repo.findList(tx, id, true);
    if (!row) throw missing();
    if (row.version !== version) throw stale();
    const plan = await repo.findPlan(tx, row.mealPlanId);
    if (!plan) throw missing();
    requireStatus(plan, 'draft', 'confirmed');
    await action(tx, await readList(tx, id), row);
    await repo.touchList(tx, id, userId);
    return readList(tx, id);
  });
}
export async function addGroceryListItem(
  id: number,
  input: unknown,
  userId: number,
): Promise<GroceryList> {
  const { version, ...value } = parse(groceryItemInputSchema, input);
  return mutateList(id, version, userId, async (tx) => {
    if ((await repo.listItems(tx, id)).length >= 10000) throw validationError('This list is full.');
    await repo.insertGroceryItem(tx, id, { ...value, sources: [], edited: true });
  });
}
export async function updateGroceryListItem(
  id: number,
  itemId: number,
  input: unknown,
  userId: number,
): Promise<GroceryList> {
  parse(idSchema, itemId);
  const { version, ...value } = parse(groceryItemInputSchema, input);
  return mutateList(id, version, userId, async (tx, list) => {
    const item = list.items.find((i) => i.id === itemId);
    if (!item) throw missing();
    // Writing the item fresh drops any rebuild reason on it: an edit is the
    // person answering it.
    await repo.changeGroceryItem(tx, itemId, { ...value, sources: item.sources, edited: true });
    await repo.setSuggestions(
      tx,
      id,
      list.suggestions.filter((s) => !s.itemIds.includes(itemId)),
    );
  });
}
export async function checkGroceryListItem(
  id: number,
  itemId: number,
  version: number,
  checked: boolean,
  userId: number,
): Promise<GroceryList> {
  parse(idSchema, itemId);
  parse(z.boolean(), checked);
  return mutateList(id, version, userId, async (tx, list) => {
    const item = list.items.find((i) => i.id === itemId);
    if (!item) throw missing();
    // A tick is the person answering a rebuild's reason, too.
    const { id: _id, changedSince: _reason, ...data } = item;
    await repo.changeGroceryItem(tx, itemId, { ...data, checked });
  });
}
export async function removeGroceryListItem(
  id: number,
  itemId: number,
  version: number,
  userId: number,
): Promise<GroceryList> {
  parse(idSchema, itemId);
  return mutateList(id, version, userId, async (tx, list, row) => {
    const item = list.items.find((i) => i.id === itemId);
    if (!item) throw missing();
    // Removing salt because there is salt in the cupboard should survive the
    // next save. A hand-added item has nothing to regenerate it, so there is
    // nothing to remember.
    if (item.sources.length)
      await repo.setCarry(tx, id, { dismissed: [...row.dismissed, dismissalFor(item)] });
    await repo.deleteGroceryItem(tx, itemId);
    await repo.setSuggestions(
      tx,
      id,
      list.suggestions.filter((s) => !s.itemIds.includes(itemId)),
    );
  });
}
export async function resolveGroceryMerge(
  id: number,
  suggestionId: number,
  version: number,
  merge: boolean,
  userId: number,
): Promise<GroceryList> {
  parse(idSchema, suggestionId);
  parse(z.boolean(), merge);
  return mutateList(id, version, userId, async (tx, list, row) => {
    const suggestion = list.suggestions.find((s) => s.id === suggestionId);
    if (!suggestion) throw missing();
    // Recorded either way: a rejected merge leaves no other trace, and a
    // rebuild should not ask the same question twice.
    const covered = list.items.filter((i) => suggestion.itemIds.includes(i.id));
    if (covered.length === suggestion.itemIds.length)
      await repo.setCarry(tx, id, {
        mergeDecisions: [
          ...row.mergeDecisions,
          mergeDecisionFor(covered, suggestion.canonicalName, merge),
        ],
      });
    if (merge) {
      const items = covered;
      if (items.length !== suggestion.itemIds.length || new Set(items.map(measureKey)).size !== 1)
        throw stale();
      const [first, ...rest] = items;
      const { id: firstId, ...data } = first;
      for (const item of rest) {
        if (data.quantity && item.quantity)
          data.quantity = addQuantities(data.quantity, item.quantity);
        data.sources = [...data.sources, ...item.sources];
        data.checked = data.checked && item.checked;
        await repo.deleteGroceryItem(tx, item.id);
      }
      await repo.changeGroceryItem(tx, firstId, { ...data, name: suggestion.canonicalName });
    }
    await repo.setSuggestions(
      tx,
      id,
      list.suggestions.filter((s) => s.id !== suggestionId),
    );
  });
}
