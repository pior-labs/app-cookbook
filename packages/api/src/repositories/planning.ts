import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { groceryItems, groceryLists, mealPlanItems, mealPlans, recipes } from '../db/schema.js';
import type { DbExecutor } from './shared.js';
import type { GeneratedItem, MergeSuggestion } from '@cookbook/domain';

export async function findPlan(exec: DbExecutor, id: number, lock = false) {
  const query = exec.select().from(mealPlans).where(eq(mealPlans.id, id));
  return (await (lock ? query.for('update') : query))[0];
}
export async function listPlans(exec: DbExecutor) {
  return exec
    .select()
    .from(mealPlans)
    .orderBy(desc(mealPlans.updatedAt), desc(mealPlans.id))
    .limit(100);
}
export async function planItems(exec: DbExecutor, id: number) {
  return exec
    .select({
      id: mealPlanItems.id,
      recipeId: mealPlanItems.recipeId,
      recipeName: mealPlanItems.recipeName,
      servings: mealPlanItems.servings,
      position: mealPlanItems.position,
      currentName: recipes.name,
      deletedAt: recipes.deletedAt,
    })
    .from(mealPlanItems)
    .leftJoin(recipes, eq(mealPlanItems.recipeId, recipes.id))
    .where(eq(mealPlanItems.mealPlanId, id))
    .orderBy(mealPlanItems.position, mealPlanItems.id);
}
export async function planLists(exec: DbExecutor, id: number) {
  return exec
    .select({ id: groceryLists.id })
    .from(groceryLists)
    .where(eq(groceryLists.mealPlanId, id))
    .orderBy(desc(groceryLists.id));
}
export async function insertPlan(exec: DbExecutor, name: string, userId: number) {
  return (
    await exec
      .insert(mealPlans)
      .values({ name, createdByUserId: userId, updatedByUserId: userId })
      .returning()
  )[0];
}
export async function touchPlan(exec: DbExecutor, id: number, userId: number) {
  await exec
    .update(mealPlans)
    .set({ version: sql`${mealPlans.version} + 1`, updatedAt: new Date(), updatedByUserId: userId })
    .where(eq(mealPlans.id, id));
}
export async function activeMealRecipe(exec: DbExecutor, id: number) {
  // Lock the parent for a consistent ingredient read and to serialize against
  // recipe edit/trash while accepting a meal. No locks span a provider call.
  return (
    await exec
      .select({
        id: recipes.id,
        name: recipes.name,
        version: recipes.version,
        baseServings: recipes.baseServings,
      })
      .from(recipes)
      .where(and(eq(recipes.id, id), isNull(recipes.deletedAt)))
      .for('share')
  )[0];
}
export async function insertMeal(
  exec: DbExecutor,
  planId: number,
  value: { recipeId: number; recipeName: string; servings: number; position: number },
) {
  return (
    await exec
      .insert(mealPlanItems)
      .values({ mealPlanId: planId, ...value })
      .returning()
  )[0];
}
export async function changeMeal(
  exec: DbExecutor,
  id: number,
  value: Partial<{ recipeId: number; recipeName: string; servings: number; position: number }>,
) {
  await exec.update(mealPlanItems).set(value).where(eq(mealPlanItems.id, id));
}
export async function deleteMeal(exec: DbExecutor, id: number) {
  await exec.delete(mealPlanItems).where(eq(mealPlanItems.id, id));
}
export async function clearMeals(exec: DbExecutor, id: number) {
  await exec.delete(mealPlanItems).where(eq(mealPlanItems.mealPlanId, id));
}
export async function recentlyPlannedRecipeIds(exec: DbExecutor) {
  const recent = await exec
    .select({ id: mealPlans.id })
    .from(mealPlans)
    .orderBy(desc(mealPlans.updatedAt))
    .limit(5);
  const ids = new Set<number>();
  for (const plan of recent)
    for (const item of await planItems(exec, plan.id)) if (item.recipeId) ids.add(item.recipeId);
  return ids;
}
export async function findList(exec: DbExecutor, id: number, lock = false) {
  const query = exec.select().from(groceryLists).where(eq(groceryLists.id, id));
  return (await (lock ? query.for('update') : query))[0];
}
export async function listItems(exec: DbExecutor, id: number) {
  return (
    await exec
      .select()
      .from(groceryItems)
      .where(eq(groceryItems.groceryListId, id))
      .orderBy(groceryItems.id)
  ).map((row) => ({ id: row.id, ...row.data }));
}
export async function insertList(
  exec: DbExecutor,
  planId: number,
  planVersion: number,
  normalization: 'llm' | 'fallback',
  userId: number,
) {
  return (
    await exec
      .insert(groceryLists)
      .values({
        mealPlanId: planId,
        planVersion,
        normalization,
        createdByUserId: userId,
        updatedByUserId: userId,
      })
      .returning()
  )[0];
}
export async function setSuggestions(exec: DbExecutor, id: number, suggestions: MergeSuggestion[]) {
  await exec.update(groceryLists).set({ suggestions }).where(eq(groceryLists.id, id));
}
export async function touchList(exec: DbExecutor, id: number, userId: number) {
  await exec
    .update(groceryLists)
    .set({
      version: sql`${groceryLists.version} + 1`,
      updatedAt: new Date(),
      updatedByUserId: userId,
    })
    .where(eq(groceryLists.id, id));
}
export async function insertGroceryItem(exec: DbExecutor, listId: number, data: GeneratedItem) {
  return (await exec.insert(groceryItems).values({ groceryListId: listId, data }).returning())[0];
}
export async function changeGroceryItem(exec: DbExecutor, id: number, data: GeneratedItem) {
  await exec.update(groceryItems).set({ data }).where(eq(groceryItems.id, id));
}
export async function deleteGroceryItem(exec: DbExecutor, id: number) {
  await exec.delete(groceryItems).where(eq(groceryItems.id, id));
}
