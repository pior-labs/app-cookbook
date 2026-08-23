import type { CategorySummary, TagSummary } from '@cookbook/domain';
import { db } from '../db/index.js';
import { conflictError } from '../errors.js';
import {
  findTagByName,
  insertTag,
  listCategoriesWithCounts,
  listTagsWithCounts,
  toIso,
  type TagRecord,
} from '../repositories/index.js';

// Read access to categories and tags, plus inline tag creation. Full category
// and tag management (rename, delete, category creation) belongs to `/organize`
// and is not part of this slice.

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
