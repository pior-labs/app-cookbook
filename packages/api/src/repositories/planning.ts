import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import {
  categories,
  groceryItems,
  groceryLists,
  mealPlanItems,
  mealPlans,
  recipeImages,
  recipes,
} from '../db/schema.js';
import type { DbExecutor } from './shared.js';
import type {
  DismissedItem,
  GeneratedItem,
  MealPlanStatus,
  MergeDecision,
  MergeSuggestion,
} from '@cookbook/domain';

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
// The joins past `recipes` are what let a planned meal be drawn as a recipe
// card rather than a line of text. They are all left joins off an already-left-
// joined recipe, so a meal whose recipe was trashed still returns its row with
// the stored name and no card furniture.
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
      categoryName: categories.name,
      prepMinutes: recipes.prepMinutes,
      cookMinutes: recipes.cookMinutes,
      hasImage: sql<boolean>`${recipeImages.recipeId} is not null`,
    })
    .from(mealPlanItems)
    .leftJoin(recipes, eq(mealPlanItems.recipeId, recipes.id))
    .leftJoin(categories, eq(recipes.categoryId, categories.id))
    .leftJoin(recipeImages, eq(recipeImages.recipeId, recipes.id))
    .where(eq(mealPlanItems.mealPlanId, id))
    .orderBy(mealPlanItems.position, mealPlanItems.id);
}
// A plan has at most one list, and the unique index says so.
export async function planList(exec: DbExecutor, planId: number, lock = false) {
  const query = exec.select().from(groceryLists).where(eq(groceryLists.mealPlanId, planId));
  return (await (lock ? query.for('update') : query))[0];
}
export async function setPlanState(
  exec: DbExecutor,
  id: number,
  state: {
    status: MealPlanStatus;
    confirmedAt?: Date | null;
    completedAt?: Date | null;
  },
) {
  await exec.update(mealPlans).set(state).where(eq(mealPlans.id, id));
}
export async function insertPlan(exec: DbExecutor, name: string, userId: number) {
  return (
    await exec
      .insert(mealPlans)
      .values({ name, createdByUserId: userId, updatedByUserId: userId })
      .returning()
  )[0];
}
export async function setPlanName(exec: DbExecutor, id: number, name: string) {
  await exec.update(mealPlans).set({ name }).where(eq(mealPlans.id, id));
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
// Grocery items cascade off their list, and meal plan items cascade off the
// plan, so these two statements take the whole tree.
export async function deletePlanLists(exec: DbExecutor, planId: number) {
  await exec.delete(groceryLists).where(eq(groceryLists.mealPlanId, planId));
}
export async function deletePlan(exec: DbExecutor, id: number) {
  await exec.delete(mealPlans).where(eq(mealPlans.id, id));
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
export async function setCarry(
  exec: DbExecutor,
  id: number,
  carry: { mergeDecisions?: MergeDecision[]; dismissed?: DismissedItem[] },
) {
  await exec.update(groceryLists).set(carry).where(eq(groceryLists.id, id));
}
// A rebuild rewrites the plan's one list in place, so its id - and every link
// and open tab pointing at it - stays good. The version still moves, so anyone
// holding the old items gets a conflict rather than editing rows that are gone.
export async function rewriteList(
  exec: DbExecutor,
  id: number,
  value: { planVersion: number; normalization: 'llm' | 'fallback'; userId: number },
) {
  await exec.delete(groceryItems).where(eq(groceryItems.groceryListId, id));
  await exec
    .update(groceryLists)
    .set({
      planVersion: value.planVersion,
      normalization: value.normalization,
      version: sql`${groceryLists.version} + 1`,
      updatedAt: new Date(),
      updatedByUserId: value.userId,
    })
    .where(eq(groceryLists.id, id));
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
