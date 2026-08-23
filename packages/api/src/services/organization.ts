import type { CategorySummary, TagSummary } from '@cookbook/domain';
import { db } from '../db/index.js';
import { conflictError, notFoundError } from '../errors.js';
import {
  countRecipesInCategory,
  deleteCategory,
  deleteTag,
  findCategoryById,
  findCategoryByName,
  findTagByName,
  insertCategory,
  insertTag,
  listCategoriesWithCounts,
  listTagsWithCounts,
  toIso,
  updateCategoryName,
  updateTagName,
  type CategoryRecord,
  type DbExecutor,
  type TagRecord,
} from '../repositories/index.js';

// Categories and tags: the pickers the recipe form reads, and the management
// operations `/organize` performs (technical design section 7.3).

// `count(...)` comes back as a string from Postgres because a bigint does not
// fit a JS number safely; household counts always do.
function summary<T extends { activeRecipeCount: string; createdAt: Date; updatedAt: Date }>(
  row: T,
) {
  return {
    ...row,
    activeRecipeCount: Number(row.activeRecipeCount),
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

export async function listCategories(): Promise<CategorySummary[]> {
  return (await listCategoriesWithCounts(db)).map(summary);
}

export async function listTags(): Promise<TagSummary[]> {
  return (await listTagsWithCounts(db)).map(summary);
}

// Tags are case-insensitively unique. Creating one that already exists is a
// conflict rather than a silent alias, so the client can point the cook at the
// tag they already have.
export async function createTag(name: string): Promise<TagRecord> {
  return db.transaction(async (tx) => {
    const existing = await findTagByName(tx, name);
    if (existing) {
      throw conflictError('tag_already_exists', `The tag "${existing.name}" already exists.`, {
        name: ['This tag already exists.'],
      });
    }

    return insertTag(tx, name);
  });
}

// Categories are a closed vocabulary a recipe must belong to, so creating one
// is deliberate rather than inline like a tag.
export async function createCategory(name: string): Promise<CategoryRecord> {
  return db.transaction(async (tx) => {
    const existing = await findCategoryByName(tx, name);
    if (existing) {
      throw conflictError(
        'category_already_exists',
        `The category "${existing.name}" already exists.`,
        { name: ['This category already exists.'] },
      );
    }

    return insertCategory(tx, name);
  });
}

// Renaming to a different spelling of the same name (`Dessert` → `dessert`) is
// a real edit, so only a *different* category holding the name is a conflict.
async function assertNameFree(
  exec: DbExecutor,
  name: string,
  id: number,
  kind: 'category' | 'tag',
): Promise<void> {
  const existing =
    kind === 'category' ? await findCategoryByName(exec, name) : await findTagByName(exec, name);

  if (existing && existing.id !== id) {
    throw conflictError(`${kind}_already_exists`, `The ${kind} "${existing.name}" already exists.`, {
      name: [`This ${kind} already exists.`],
    });
  }
}

export async function renameCategory(id: number, name: string): Promise<CategoryRecord> {
  return db.transaction(async (tx) => {
    await assertNameFree(tx, name, id, 'category');

    const row = await updateCategoryName(tx, id, name);
    if (!row) {
      throw notFoundError('category_not_found', 'This category does not exist.');
    }

    return row;
  });
}

// A category is deleted only when nothing is filed under it. A trashed recipe
// still needs its category to exist for restoration, so it blocks the delete
// too, with its own explanation (technical design sections 7.3 and 10).
export async function removeCategory(id: number): Promise<void> {
  await db.transaction(async (tx) => {
    const category = await findCategoryById(tx, id);
    if (!category) {
      throw notFoundError('category_not_found', 'This category does not exist.');
    }

    const { active, trashed } = await countRecipesInCategory(tx, id);

    if (active > 0) {
      throw conflictError(
        'category_in_use',
        `"${category.name}" still holds ${recipeCount(active)}. Move ${
          active === 1 ? 'it' : 'them'
        } to another category first.`,
      );
    }

    if (trashed > 0) {
      throw conflictError(
        'category_in_use',
        `"${category.name}" is still used by ${recipeCount(trashed)} in Trash. Restore or permanently delete ${
          trashed === 1 ? 'it' : 'them'
        } first.`,
      );
    }

    await deleteCategory(tx, id);
  });
}

function recipeCount(count: number): string {
  return count === 1 ? '1 recipe' : `${count} recipes`;
}

export async function renameTag(id: number, name: string): Promise<TagRecord> {
  return db.transaction(async (tx) => {
    await assertNameFree(tx, name, id, 'tag');

    const row = await updateTagName(tx, id, name);
    if (!row) {
      throw notFoundError('tag_not_found', 'This tag does not exist.');
    }

    return row;
  });
}

// Unlike a category, a tag holds no recipe data: deleting one detaches it from
// every recipe through the `recipe_tags` cascade and is not blocked.
export async function removeTag(id: number): Promise<void> {
  const deleted = await deleteTag(db, id);

  if (!deleted) {
    throw notFoundError('tag_not_found', 'This tag does not exist.');
  }
}
