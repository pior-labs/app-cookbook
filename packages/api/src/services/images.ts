import type { RecipeImage } from '@cookbook/domain';
import { db } from '../db/index.js';
import { notFoundError, recipeNotFound } from '../errors.js';
import {
  activeRecipeExists,
  deleteRecipeImage,
  findRecipeImage,
  upsertRecipeImage,
} from '../repositories/index.js';
import {
  contentHash,
  ensureStorageRoot,
  folderFromKey,
  newImageFolder,
  readImageFile,
  removeImageFolder,
  storageKey,
  writeImageFile,
} from '../images/storage.js';
import { processUpload, type ImageVariant } from '../images/transform.js';

// The primary recipe photo. Replacement writes every new file before the
// database reference moves, and removes replaced files only after it has, so an
// interrupted replacement always leaves at least one valid image
// (technical design section 8).

function imageResponse(recipeId: number, row: NonNullable<Awaited<ReturnType<typeof findRecipeImage>>>): RecipeImage {
  return {
    cardUrl: `/api/recipes/${recipeId}/photo/card`,
    detailUrl: `/api/recipes/${recipeId}/photo/detail`,
    cardWidth: row.cardWidth,
    cardHeight: row.cardHeight,
    detailWidth: row.detailWidth,
    detailHeight: row.detailHeight,
  };
}

function photoNotFound() {
  return notFoundError('recipe_photo_not_found', 'This recipe does not have a photo.');
}

export async function replaceRecipePhoto(
  recipeId: number,
  source: Buffer,
  userId: number,
  requestId?: string,
): Promise<RecipeImage> {
  if (!(await activeRecipeExists(db, recipeId))) {
    throw recipeNotFound();
  }

  const processed = await processUpload(source);

  const folder = newImageFolder(recipeId);
  const cardKey = storageKey(folder, 'card');
  const detailKey = storageKey(folder, 'detail');

  await ensureStorageRoot();

  try {
    await writeImageFile(cardKey, processed.card.data);
    await writeImageFile(detailKey, processed.detail.data);
  } catch (error) {
    // Nothing references these files yet, so removing them keeps a failed
    // upload from leaving work for the reconciliation command.
    await removeImageFolder(folder, requestId);
    throw error;
  }

  const values = {
    cardStorageKey: cardKey,
    detailStorageKey: detailKey,
    cardContentHash: contentHash(processed.card.data),
    detailContentHash: contentHash(processed.detail.data),
    sourceMediaType: processed.sourceMediaType,
    sourceByteSize: processed.sourceByteSize,
    cardWidth: processed.card.width,
    cardHeight: processed.card.height,
    detailWidth: processed.detail.width,
    detailHeight: processed.detail.height,
  };

  let replaced: Awaited<ReturnType<typeof upsertRecipeImage>>;
  try {
    replaced = await db.transaction(async (tx) => {
      // Re-checked inside the transaction: the recipe may have been trashed
      // while the upload was being processed, and the row would otherwise be
      // written against a recipe no longer visible.
      if (!(await activeRecipeExists(tx, recipeId))) {
        throw recipeNotFound();
      }

      return upsertRecipeImage(tx, recipeId, values, userId);
    });
  } catch (error) {
    await removeImageFolder(folder, requestId);
    throw error;
  }

  if (replaced) {
    await removeImageFolder(folderFromKey(replaced.replacedCardKey), requestId);
  }

  const row = await findRecipeImage(db, recipeId);
  if (!row) {
    throw photoNotFound();
  }

  return imageResponse(recipeId, row);
}

export interface PhotoPayload {
  data: Buffer;
  contentHash: string;
}

export async function readRecipePhoto(
  recipeId: number,
  variant: ImageVariant,
): Promise<PhotoPayload> {
  if (!(await activeRecipeExists(db, recipeId))) {
    throw recipeNotFound();
  }

  const row = await findRecipeImage(db, recipeId);
  if (!row) {
    throw photoNotFound();
  }

  const key = variant === 'card' ? row.cardStorageKey : row.detailStorageKey;
  const hash = variant === 'card' ? row.cardContentHash : row.detailContentHash;

  const data = await readImageFile(key);
  if (!data) {
    // Metadata without a file means storage and the database have drifted -
    // a restore mismatch, or cleanup that removed too much.
    console.error(
      JSON.stringify({ message: 'Recipe image file is missing', recipeId, variant }),
    );
    throw photoNotFound();
  }

  return { data, contentHash: hash };
}

export async function deleteRecipePhoto(recipeId: number, requestId?: string): Promise<void> {
  if (!(await activeRecipeExists(db, recipeId))) {
    throw recipeNotFound();
  }

  const removed = await deleteRecipeImage(db, recipeId);
  if (!removed) {
    throw photoNotFound();
  }

  await removeImageFolder(folderFromKey(removed.cardStorageKey), requestId);
}
