import { and, eq, sql } from 'drizzle-orm';
import { recentlyViewedRecipes, userFavorites, userRatings } from '../db/schema.js';
import type { DbExecutor } from './shared.js';

// Per-user recipe state: favorites, ratings, and recently viewed. Recipes are
// shared household data, but all three of these belong to one person, so every
// statement here is keyed by user as well as by recipe (technical design
// section 4.6).

// Favoriting twice is the same as favoriting once. The composite primary key
// makes that a conflict, and ignoring it is what "idempotent" means here
// (section 7.2).
export async function addFavorite(
  exec: DbExecutor,
  recipeId: number,
  userId: number,
): Promise<void> {
  await exec.insert(userFavorites).values({ userId, recipeId }).onConflictDoNothing();
}

export async function removeFavorite(
  exec: DbExecutor,
  recipeId: number,
  userId: number,
): Promise<void> {
  await exec
    .delete(userFavorites)
    .where(and(eq(userFavorites.recipeId, recipeId), eq(userFavorites.userId, userId)));
}

// A person has one rating per recipe, so re-rating replaces rather than
// appends. `created_at` deliberately survives the update: it records when this
// person first rated the recipe.
export async function setRating(
  exec: DbExecutor,
  recipeId: number,
  userId: number,
  rating: number,
): Promise<void> {
  await exec
    .insert(userRatings)
    .values({ userId, recipeId, rating })
    .onConflictDoUpdate({
      target: [userRatings.userId, userRatings.recipeId],
      set: { rating, updatedAt: new Date() },
    });
}

export async function removeRating(
  exec: DbExecutor,
  recipeId: number,
  userId: number,
): Promise<void> {
  await exec
    .delete(userRatings)
    .where(and(eq(userRatings.recipeId, recipeId), eq(userRatings.userId, userId)));
}

// Recently viewed is one row per person per recipe, not a log: opening the same
// recipe twice moves it back to the top rather than filling the list with one
// recipe. The timestamp comes from the database so it cannot drift with a
// client clock.
export async function touchRecentlyViewed(
  exec: DbExecutor,
  recipeId: number,
  userId: number,
): Promise<void> {
  await exec
    .insert(recentlyViewedRecipes)
    .values({ userId, recipeId })
    .onConflictDoUpdate({
      target: [recentlyViewedRecipes.userId, recentlyViewedRecipes.recipeId],
      set: { lastViewedAt: sql`now()` },
    });
}
