import { and, eq } from 'drizzle-orm';
import { recipeImages, recipes } from '../db/schema.js';
import { activeRecipe, type DbExecutor } from './shared.js';

// Database access for the one-to-one recipe image row (technical design
// section 4.7). Files are the storage module's concern; this module only moves
// the metadata that points at them.

export interface RecipeImageValues {
  cardStorageKey: string;
  detailStorageKey: string;
  cardContentHash: string;
  detailContentHash: string;
  sourceMediaType: string;
  sourceByteSize: number;
  cardWidth: number;
  cardHeight: number;
  detailWidth: number;
  detailHeight: number;
}

export async function findRecipeImage(exec: DbExecutor, recipeId: number) {
  const [row] = await exec
    .select()
    .from(recipeImages)
    .where(eq(recipeImages.recipeId, recipeId))
    .limit(1);

  return row ?? null;
}

// Existence check for the photo routes. Reads are scoped to active recipes, so
// a trashed recipe's photo is not reachable through the normal path even though
// its files are retained for restoration (section 10).
export async function activeRecipeExists(exec: DbExecutor, recipeId: number): Promise<boolean> {
  const [row] = await exec
    .select({ id: recipes.id })
    .from(recipes)
    .where(and(eq(recipes.id, recipeId), activeRecipe()))
    .limit(1);

  return row != null;
}

// The one-to-one row is replaced in place, so a recipe never briefly has two
// image rows or none during a replacement. Returns the previous storage keys so
// the service can delete the files it just stopped referencing.
export async function upsertRecipeImage(
  exec: DbExecutor,
  recipeId: number,
  values: RecipeImageValues,
  uploadedByUserId: number,
): Promise<{ replacedCardKey: string; replacedDetailKey: string } | null> {
  const previous = await findRecipeImage(exec, recipeId);

  await exec
    .insert(recipeImages)
    .values({ recipeId, ...values, uploadedByUserId })
    .onConflictDoUpdate({
      target: recipeImages.recipeId,
      set: { ...values, uploadedByUserId, updatedAt: new Date() },
    });

  return previous
    ? { replacedCardKey: previous.cardStorageKey, replacedDetailKey: previous.detailStorageKey }
    : null;
}

export async function deleteRecipeImage(
  exec: DbExecutor,
  recipeId: number,
): Promise<{ cardStorageKey: string; detailStorageKey: string } | null> {
  const [row] = await exec
    .delete(recipeImages)
    .where(eq(recipeImages.recipeId, recipeId))
    .returning({
      cardStorageKey: recipeImages.cardStorageKey,
      detailStorageKey: recipeImages.detailStorageKey,
    });

  return row ?? null;
}

// Every referenced storage key, including keys belonging to soft-deleted
// recipes, whose files are retained for restoration. The orphan reconciliation
// command treats anything absent from this set as unreferenced.
export async function listReferencedStorageKeys(exec: DbExecutor): Promise<string[]> {
  const rows = await exec
    .select({
      cardStorageKey: recipeImages.cardStorageKey,
      detailStorageKey: recipeImages.detailStorageKey,
    })
    .from(recipeImages);

  return rows.flatMap((row) => [row.cardStorageKey, row.detailStorageKey]);
}
