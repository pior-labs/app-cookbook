import { asc, eq, inArray, sql } from 'drizzle-orm';
import { recipeTags, recipes, tags } from '../db/schema.js';
import { normalizeName, type DbExecutor } from './shared.js';

export interface TagRecord {
  id: number;
  name: string;
}

// Returns only the tags that exist. Callers compare the count to decide whether
// the request referenced a tag that has since been deleted.
export async function findTagsByIds(exec: DbExecutor, ids: number[]): Promise<TagRecord[]> {
  if (ids.length === 0) {
    return [];
  }

  return exec
    .select({ id: tags.id, name: tags.name })
    .from(tags)
    .where(inArray(tags.id, ids));
}

// Tags are shared household data, so the count is of live recipes carrying the
// tag rather than anything per-user (section 7.3).
export async function listTagsWithCounts(exec: DbExecutor) {
  return exec
    .select({
      id: tags.id,
      name: tags.name,
      createdAt: tags.createdAt,
      updatedAt: tags.updatedAt,
      activeRecipeCount: sql<string>`count(${recipes.id})`,
    })
    .from(tags)
    .leftJoin(recipeTags, eq(recipeTags.tagId, tags.id))
    .leftJoin(recipes, sql`${recipes.id} = ${recipeTags.recipeId} and ${recipes.deletedAt} is null`)
    .groupBy(tags.id)
    .orderBy(asc(tags.name));
}

export async function findTagByName(exec: DbExecutor, name: string): Promise<TagRecord | null> {
  const [row] = await exec
    .select({ id: tags.id, name: tags.name })
    .from(tags)
    .where(eq(tags.normalizedName, normalizeName(name)))
    .limit(1);

  return row ?? null;
}

export async function insertTag(exec: DbExecutor, name: string): Promise<TagRecord> {
  const [row] = await exec
    .insert(tags)
    .values({ name, normalizedName: normalizeName(name) })
    .returning({ id: tags.id, name: tags.name });

  return row;
}
