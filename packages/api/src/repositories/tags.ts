import { asc, eq, inArray, sql } from 'drizzle-orm';
import { recipeTags, recipes, tags } from '../db/schema.js';
import { normalizeName, type DbExecutor } from './shared.js';

export interface TagRecord {
  id: number;
  name: string;
  color: string | null;
}

// Returns only the tags that exist. Callers compare the count to decide whether
// the request referenced a tag that has since been deleted.
export async function findTagsByIds(exec: DbExecutor, ids: number[]): Promise<TagRecord[]> {
  if (ids.length === 0) {
    return [];
  }

  return exec
    .select({ id: tags.id, name: tags.name, color: tags.color })
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
      color: tags.color,
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
    .select({ id: tags.id, name: tags.name, color: tags.color })
    .from(tags)
    .where(eq(tags.normalizedName, normalizeName(name)))
    .limit(1);

  return row ?? null;
}

export async function insertTag(
  exec: DbExecutor,
  name: string,
  color: string | null,
): Promise<TagRecord> {
  const [row] = await exec
    .insert(tags)
    .values({ name, normalizedName: normalizeName(name), color })
    .returning({ id: tags.id, name: tags.name, color: tags.color });

  return row;
}

export async function findTagById(exec: DbExecutor, id: number): Promise<TagRecord | null> {
  const [row] = await exec
    .select({ id: tags.id, name: tags.name, color: tags.color })
    .from(tags)
    .where(eq(tags.id, id))
    .limit(1);

  return row ?? null;
}

// Name and colour are written together: `/organize` edits one or the other,
// and the service decides what an omitted colour means before it gets here.
export async function updateTag(
  exec: DbExecutor,
  id: number,
  { name, color }: { name: string; color: string | null },
): Promise<TagRecord | null> {
  const [row] = await exec
    .update(tags)
    .set({ name, normalizedName: normalizeName(name), color, updatedAt: new Date() })
    .where(eq(tags.id, id))
    .returning({ id: tags.id, name: tags.name, color: tags.color });

  return row ?? null;
}

// Deleting a tag removes it from every recipe: `recipe_tags` cascades. Unlike a
// category, a tag carries no recipe data, so this is allowed rather than
// blocked (section 7.3).
export async function deleteTag(exec: DbExecutor, id: number): Promise<boolean> {
  const rows = await exec.delete(tags).where(eq(tags.id, id)).returning({ id: tags.id });

  return rows.length > 0;
}
