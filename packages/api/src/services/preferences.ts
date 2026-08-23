import type { RecipePreferences } from '@cookbook/domain';
import { db } from '../db/index.js';
import { recipeNotFound } from '../errors.js';
import {
  addFavorite,
  findActiveRecipeVersion,
  findRatingSummary,
  findUserRecipeState,
  removeFavorite,
  removeRating,
  setRating,
  touchRecentlyViewed,
  type DbExecutor,
} from '../repositories/index.js';

// Favorites, ratings, and recently viewed for the acting user
// (technical design sections 4.6 and 7.2). The user always comes from the
// session; nothing here accepts a user ID from the client.

// A trashed recipe is not a thing a cook can act on, so preferring one is a
// 404 rather than a silent write. The existing rows survive the soft delete
// and come back with the recipe (section 10).
async function assertActive(exec: DbExecutor, recipeId: number): Promise<void> {
  if ((await findActiveRecipeVersion(exec, recipeId)) == null) {
    throw recipeNotFound();
  }
}

async function preferences(
  exec: DbExecutor,
  recipeId: number,
  userId: number,
): Promise<RecipePreferences> {
  const [userState, rating] = await Promise.all([
    findUserRecipeState(exec, recipeId, userId),
    findRatingSummary(exec, recipeId),
  ]);

  return { userState, rating };
}

// Each change and the state it returns run in one transaction, so the answer
// describes the database as it stands after the write rather than a moment
// that may already have moved.
function change(
  recipeId: number,
  userId: number,
  apply: (exec: DbExecutor) => Promise<void>,
): Promise<RecipePreferences> {
  return db.transaction(async (tx) => {
    await assertActive(tx, recipeId);
    await apply(tx);

    return preferences(tx, recipeId, userId);
  });
}

export function favoriteRecipe(recipeId: number, userId: number): Promise<RecipePreferences> {
  return change(recipeId, userId, (tx) => addFavorite(tx, recipeId, userId));
}

export function unfavoriteRecipe(recipeId: number, userId: number): Promise<RecipePreferences> {
  return change(recipeId, userId, (tx) => removeFavorite(tx, recipeId, userId));
}

export function rateRecipe(
  recipeId: number,
  userId: number,
  rating: number,
): Promise<RecipePreferences> {
  return change(recipeId, userId, (tx) => setRating(tx, recipeId, userId, rating));
}

export function clearRating(recipeId: number, userId: number): Promise<RecipePreferences> {
  return change(recipeId, userId, (tx) => removeRating(tx, recipeId, userId));
}

// Recording a view is a side effect of reading, not an action a cook takes, so
// it answers with nothing.
export async function recordView(recipeId: number, userId: number): Promise<void> {
  await db.transaction(async (tx) => {
    await assertActive(tx, recipeId);
    await touchRecentlyViewed(tx, recipeId, userId);
  });
}
