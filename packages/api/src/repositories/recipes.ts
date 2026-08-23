import type { Fraction } from '@cookbook/domain';
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import {
  recipeIngredients,
  recipeInstructions,
  recipeTags,
  recipes,
  userFavorites,
  userRatings,
} from '../db/schema.js';
import { activeRecipe, normalizeName, type DbExecutor } from './shared.js';

// Database access for the recipe aggregate. Every read here is scoped to active
// recipes; Trash has its own explicit path (technical design section 10).
// Mapping to the API representation belongs to the service layer.

// The editable parent columns shared by create and update. Created-by,
// deleted-by, and `version` are never client-supplied.
export interface RecipeParentValues {
  name: string;
  description: string;
  baseServings: number;
  prepMinutes: number | null;
  cookMinutes: number | null;
  notes: string | null;
  categoryId: number;
  sourceUrl: string | null;
  sourceText: string | null;
}

export interface IngredientValues {
  name: string;
  quantity: Fraction | null;
  unitCode: string | null;
  unitText: string | null;
  preparation: string | null;
}

export interface InstructionValues {
  body: string;
}

export async function insertRecipe(
  exec: DbExecutor,
  values: RecipeParentValues,
  createdByUserId: number,
): Promise<number> {
  const [row] = await exec
    .insert(recipes)
    .values({ ...values, createdByUserId })
    .returning({ id: recipes.id });

  return row.id;
}

// Optimistic concurrency: the update only matches when the caller's observed
// version is still current, so a concurrent household edit is a conflict rather
// than a silent overwrite (section 4.3). Returns null when nothing matched.
export async function updateRecipeParent(
  exec: DbExecutor,
  recipeId: number,
  expectedVersion: number,
  values: RecipeParentValues,
): Promise<number | null> {
  const [row] = await exec
    .update(recipes)
    .set({ ...values, version: sql`${recipes.version} + 1`, updatedAt: new Date() })
    .where(
      and(eq(recipes.id, recipeId), eq(recipes.version, expectedVersion), activeRecipe()),
    )
    .returning({ version: recipes.version });

  return row?.version ?? null;
}

export async function findActiveRecipeVersion(
  exec: DbExecutor,
  recipeId: number,
): Promise<number | null> {
  const [row] = await exec
    .select({ version: recipes.version })
    .from(recipes)
    .where(and(eq(recipes.id, recipeId), activeRecipe()))
    .limit(1);

  return row?.version ?? null;
}

// Ordered child collections are replaced wholesale inside the aggregate
// transaction. Position comes from array order, never from the client
// (section 12).
export async function replaceIngredients(
  exec: DbExecutor,
  recipeId: number,
  values: IngredientValues[],
): Promise<void> {
  await exec.delete(recipeIngredients).where(eq(recipeIngredients.recipeId, recipeId));

  if (values.length === 0) {
    return;
  }

  await exec.insert(recipeIngredients).values(
    values.map((ingredient, position) => ({
      recipeId,
      position,
      quantityNumerator: ingredient.quantity?.numerator ?? null,
      quantityDenominator: ingredient.quantity?.denominator ?? null,
      unitCode: ingredient.unitCode,
      unitText: ingredient.unitText,
      name: ingredient.name,
      normalizedName: normalizeName(ingredient.name),
      preparation: ingredient.preparation,
    })),
  );
}

export async function replaceInstructions(
  exec: DbExecutor,
  recipeId: number,
  values: InstructionValues[],
): Promise<void> {
  await exec.delete(recipeInstructions).where(eq(recipeInstructions.recipeId, recipeId));

  if (values.length === 0) {
    return;
  }

  await exec.insert(recipeInstructions).values(
    values.map((instruction, position) => ({
      recipeId,
      position,
      body: instruction.body,
    })),
  );
}

export async function replaceTags(
  exec: DbExecutor,
  recipeId: number,
  tagIds: number[],
): Promise<void> {
  await exec.delete(recipeTags).where(eq(recipeTags.recipeId, recipeId));

  if (tagIds.length === 0) {
    return;
  }

  await exec.insert(recipeTags).values(tagIds.map((tagId) => ({ recipeId, tagId })));
}

// Recent recipes for the home entry point. This is deliberately the narrow
// case: text search, filters, and cursor pagination arrive with browse/search
// (technical design section 9) and are not implemented here.
export async function listRecentRecipes(exec: DbExecutor, limit: number) {
  return exec.query.recipes.findMany({
    where: isNull(recipes.deletedAt),
    with: { category: true, image: true },
    // `id` is the tie-breaker so recipes created in the same transaction still
    // have a stable order.
    orderBy: [desc(recipes.createdAt), desc(recipes.id)],
    limit,
  });
}

export type RecipeListRow = Awaited<ReturnType<typeof listRecentRecipes>>[number];

export async function findRecipeAggregate(exec: DbExecutor, recipeId: number) {
  const row = await exec.query.recipes.findFirst({
    where: and(eq(recipes.id, recipeId), isNull(recipes.deletedAt)),
    with: {
      category: true,
      ingredients: { orderBy: asc(recipeIngredients.position) },
      instructions: { orderBy: asc(recipeInstructions.position) },
      recipeTags: { with: { tag: true } },
      image: true,
    },
  });

  return row ?? null;
}

export type RecipeAggregateRow = NonNullable<Awaited<ReturnType<typeof findRecipeAggregate>>>;

// The household aggregate rating across every user who rated the recipe.
export async function findRatingSummary(
  exec: DbExecutor,
  recipeId: number,
): Promise<{ average: number | null; count: number }> {
  const [row] = await exec
    .select({
      average: sql<string | null>`avg(${userRatings.rating})`,
      count: sql<string>`count(*)`,
    })
    .from(userRatings)
    .where(eq(userRatings.recipeId, recipeId));

  const count = Number(row?.count ?? 0);

  return {
    average: count === 0 || row?.average == null ? null : Number(row.average),
    count,
  };
}

// The acting user's own favorite and rating, always keyed by the session user.
export async function findUserRecipeState(
  exec: DbExecutor,
  recipeId: number,
  userId: number,
): Promise<{ favorite: boolean; rating: number | null }> {
  const [favorite] = await exec
    .select({ recipeId: userFavorites.recipeId })
    .from(userFavorites)
    .where(and(eq(userFavorites.recipeId, recipeId), eq(userFavorites.userId, userId)))
    .limit(1);

  const [rating] = await exec
    .select({ rating: userRatings.rating })
    .from(userRatings)
    .where(and(eq(userRatings.recipeId, recipeId), eq(userRatings.userId, userId)))
    .limit(1);

  return { favorite: favorite != null, rating: rating?.rating ?? null };
}
