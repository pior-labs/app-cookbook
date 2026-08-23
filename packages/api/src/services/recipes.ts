import {
  totalMinutes,
  type CreateRecipeInput,
  type RecipeDetail,
  type RecipeImage,
  type RecipeIngredient,
  type RecipeInstruction,
  type UpdateRecipeInput,
} from '@cookbook/domain';
import { db } from '../db/index.js';
import { recipeNotFound, recipeVersionConflict, validationError } from '../errors.js';
import {
  findActiveRecipeVersion,
  findCategoryById,
  findRatingSummary,
  findRecipeAggregate,
  findTagsByIds,
  findUserRecipeState,
  insertRecipe,
  replaceIngredients,
  replaceInstructions,
  replaceTags,
  toIso,
  updateRecipeParent,
  type DbExecutor,
  type RecipeAggregateRow,
  type RecipeParentValues,
} from '../repositories/index.js';

// Orchestration for the recipe aggregate. The recipe, its ingredients, its
// instructions, and its tag assignments are created and updated as one unit in
// one transaction (technical design section 13).

function parentValues(input: CreateRecipeInput | UpdateRecipeInput): RecipeParentValues {
  return {
    name: input.name,
    description: input.description,
    baseServings: input.baseServings,
    prepMinutes: input.prepMinutes,
    cookMinutes: input.cookMinutes,
    notes: input.notes,
    categoryId: input.categoryId,
    sourceUrl: input.sourceUrl,
    sourceText: input.sourceText,
  };
}

// Category and tag existence is a validation concern rather than a 404: the
// request body pointed at something that is no longer selectable. Checking
// inside the transaction keeps the message useful, while the foreign keys stay
// the race-safe guard.
async function assertReferencesExist(
  exec: DbExecutor,
  input: CreateRecipeInput | UpdateRecipeInput,
): Promise<void> {
  const category = await findCategoryById(exec, input.categoryId);
  if (!category) {
    throw validationError('Choose an existing category.', {
      categoryId: ['This category no longer exists.'],
    });
  }

  if (input.tagIds.length > 0) {
    const found = await findTagsByIds(exec, input.tagIds);
    if (found.length !== input.tagIds.length) {
      throw validationError('Choose existing tags.', {
        tagIds: ['One or more of these tags no longer exist.'],
      });
    }
  }
}

async function writeChildren(
  exec: DbExecutor,
  recipeId: number,
  input: CreateRecipeInput | UpdateRecipeInput,
): Promise<void> {
  await replaceIngredients(exec, recipeId, input.ingredients);
  await replaceInstructions(exec, recipeId, input.instructions);
  await replaceTags(exec, recipeId, input.tagIds);
}

function toIngredient(row: RecipeAggregateRow['ingredients'][number]): RecipeIngredient {
  const { quantityNumerator, quantityDenominator } = row;

  return {
    id: row.id,
    position: row.position,
    quantity:
      quantityNumerator == null || quantityDenominator == null
        ? null
        : { numerator: quantityNumerator, denominator: quantityDenominator },
    unitCode: row.unitCode,
    unitText: row.unitText,
    name: row.name,
    preparation: row.preparation,
  };
}

function toInstruction(row: RecipeAggregateRow['instructions'][number]): RecipeInstruction {
  return { id: row.id, position: row.position, body: row.body };
}

// Images are delivered only through authenticated API routes, so the client
// receives route URLs rather than storage keys (section 8).
function toImage(row: RecipeAggregateRow): RecipeImage | null {
  if (!row.image) {
    return null;
  }

  return {
    cardUrl: `/api/recipes/${row.id}/photo/card`,
    detailUrl: `/api/recipes/${row.id}/photo/detail`,
    cardWidth: row.image.cardWidth,
    cardHeight: row.image.cardHeight,
    detailWidth: row.image.detailWidth,
    detailHeight: row.image.detailHeight,
  };
}

async function loadDetail(
  exec: DbExecutor,
  recipeId: number,
  userId: number,
): Promise<RecipeDetail> {
  const row = await findRecipeAggregate(exec, recipeId);
  if (!row) {
    throw recipeNotFound();
  }

  // Sequential rather than concurrent: inside a transaction these share one
  // reserved connection, and there is nothing to gain from queueing them.
  const rating = await findRatingSummary(exec, recipeId);
  const userState = await findUserRecipeState(exec, recipeId, userId);

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    categoryId: row.categoryId,
    categoryName: row.category.name,
    prepMinutes: row.prepMinutes,
    cookMinutes: row.cookMinutes,
    totalMinutes: totalMinutes(row.prepMinutes, row.cookMinutes),
    rating,
    hasImage: row.image != null,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
    userState,
    baseServings: row.baseServings,
    notes: row.notes,
    sourceUrl: row.sourceUrl,
    sourceText: row.sourceText,
    createdByUserId: row.createdByUserId,
    version: row.version,
    ingredients: row.ingredients.map(toIngredient),
    instructions: row.instructions.map(toInstruction),
    tags: row.recipeTags
      .map(({ tag }) => ({
        id: tag.id,
        name: tag.name,
        createdAt: toIso(tag.createdAt),
        updatedAt: toIso(tag.updatedAt),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    image: toImage(row),
  };
}

export async function createRecipe(
  input: CreateRecipeInput,
  userId: number,
): Promise<RecipeDetail> {
  return db.transaction(async (tx) => {
    await assertReferencesExist(tx, input);

    const recipeId = await insertRecipe(tx, parentValues(input), userId);
    await writeChildren(tx, recipeId, input);

    return loadDetail(tx, recipeId, userId);
  });
}

export async function getRecipe(recipeId: number, userId: number): Promise<RecipeDetail> {
  return loadDetail(db, recipeId, userId);
}

export async function updateRecipe(
  recipeId: number,
  input: UpdateRecipeInput,
  userId: number,
): Promise<RecipeDetail> {
  return db.transaction(async (tx) => {
    await assertReferencesExist(tx, input);

    const version = await updateRecipeParent(tx, recipeId, input.version, parentValues(input));

    if (version == null) {
      // The update matched nothing: either the recipe is gone (or trashed), or
      // somebody else saved a newer version first.
      const current = await findActiveRecipeVersion(tx, recipeId);
      throw current == null ? recipeNotFound() : recipeVersionConflict();
    }

    await writeChildren(tx, recipeId, input);

    return loadDetail(tx, recipeId, userId);
  });
}
