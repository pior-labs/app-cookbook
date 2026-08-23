import type { TrashListPage, TrashedRecipe } from '@cookbook/domain';
import { db } from '../db/index.js';
import { recipeNotFound, recipeNotInTrash } from '../errors.js';
import { folderFromKey, removeImageFolder } from '../images/storage.js';
import {
  deleteTrashedRecipe,
  findRecipeImage,
  listTrashedRecipes,
  restoreRecipe,
  softDeleteRecipe,
  toIso,
  type ListTrashParams,
  type TrashedRecipeRow,
} from '../repositories/index.js';
import { withCursorErrors } from './pagination.js';

// Recoverable deletion (technical design section 10, ADR 0005). Deleting a
// recipe moves it to Trash and removes nothing: rows and image files stay
// exactly where they are, so restoring gives a cook back the recipe they had
// rather than a reconstruction of it. Only permanent deletion, and only from
// Trash, actually destroys anything.

function toTrashedRecipe(row: TrashedRecipeRow): TrashedRecipe {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    categoryName: row.categoryName,
    createdAt: toIso(row.createdAt),
    deletedAt: toIso(row.deletedAt),
    deletedByUserId: row.deletedByUserId,
    deletedByName: row.deletedByName,
  };
}

export async function moveRecipeToTrash(recipeId: number, userId: number): Promise<void> {
  if (!(await softDeleteRecipe(db, recipeId, userId))) {
    throw recipeNotFound();
  }
}

export async function listTrash(params: ListTrashParams): Promise<TrashListPage> {
  return withCursorErrors(async () => {
    const page = await listTrashedRecipes(db, params);

    return { items: page.rows.map(toTrashedRecipe), nextCursor: page.nextCursor };
  });
}

export async function restoreFromTrash(recipeId: number): Promise<void> {
  if (!(await restoreRecipe(db, recipeId))) {
    throw recipeNotInTrash();
  }
}

// The one operation the application cannot undo. The database rows leave in one
// transaction through the schema's cascades; the image files are removed only
// once that has committed, so a failure here leaves an orphaned file for the
// reconciliation command rather than a recipe row pointing at nothing
// (section 8).
export async function deleteRecipeForever(recipeId: number, requestId?: string): Promise<void> {
  const imageKey = await db.transaction(async (tx) => {
    // Read before the delete: the cascade takes the image metadata with the
    // recipe, and the storage key has to outlive it.
    const image = await findRecipeImage(tx, recipeId);

    if (!(await deleteTrashedRecipe(tx, recipeId))) {
      throw recipeNotInTrash();
    }

    return image?.cardStorageKey ?? null;
  });

  if (imageKey) {
    // Both variants share one generated folder, so removing it removes the
    // whole photo.
    await removeImageFolder(folderFromKey(imageKey), requestId);
  }
}
