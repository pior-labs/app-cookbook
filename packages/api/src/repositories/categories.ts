import { asc, eq, sql } from 'drizzle-orm';
import { categories, recipes } from '../db/schema.js';
import { normalizeName, type DbExecutor } from './shared.js';

export interface CategoryRecord {
  id: number;
  name: string;
}

export async function findCategoryById(
  exec: DbExecutor,
  id: number,
): Promise<CategoryRecord | null> {
  const [row] = await exec
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(eq(categories.id, id))
    .limit(1);

  return row ?? null;
}

// Every category with the number of live recipes filed under it. The count
// drives both the picker and, later, the delete restriction in `/organize`, so
// trashed recipes are deliberately excluded: they are not what a cook is
// choosing between (technical design section 7.3).
export async function listCategoriesWithCounts(exec: DbExecutor) {
  return exec
    .select({
      id: categories.id,
      name: categories.name,
      createdAt: categories.createdAt,
      updatedAt: categories.updatedAt,
      activeRecipeCount: sql<string>`count(${recipes.id})`,
    })
    .from(categories)
    // A left join keeps categories a household has not used yet, which is the
    // normal state right after the starter seed.
    .leftJoin(recipes, sql`${recipes.categoryId} = ${categories.id} and ${recipes.deletedAt} is null`)
    .groupBy(categories.id)
    .orderBy(asc(categories.name));
}

export async function findCategoryByName(
  exec: DbExecutor,
  name: string,
): Promise<CategoryRecord | null> {
  const [row] = await exec
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(eq(categories.normalizedName, normalizeName(name)))
    .limit(1);

  return row ?? null;
}

export async function insertCategory(exec: DbExecutor, name: string): Promise<CategoryRecord> {
  const [row] = await exec
    .insert(categories)
    .values({ name, normalizedName: normalizeName(name) })
    .returning({ id: categories.id, name: categories.name });

  return row;
}

// Returns null when the category no longer exists, so the caller answers with a
// 404 rather than reporting a successful rename of nothing.
export async function updateCategoryName(
  exec: DbExecutor,
  id: number,
  name: string,
): Promise<CategoryRecord | null> {
  const [row] = await exec
    .update(categories)
    .set({ name, normalizedName: normalizeName(name), updatedAt: new Date() })
    .where(eq(categories.id, id))
    .returning({ id: categories.id, name: categories.name });

  return row ?? null;
}

export async function deleteCategory(exec: DbExecutor, id: number): Promise<boolean> {
  const rows = await exec
    .delete(categories)
    .where(eq(categories.id, id))
    .returning({ id: categories.id });

  return rows.length > 0;
}

// Both halves of "is anything filed here?". A trashed recipe still references
// its category and is restorable, so it blocks deletion exactly like a live one
// does, but it needs its own explanation (technical design section 7.3).
export async function countRecipesInCategory(
  exec: DbExecutor,
  categoryId: number,
): Promise<{ active: number; trashed: number }> {
  const [row] = await exec
    .select({
      active: sql<string>`count(*) filter (where ${recipes.deletedAt} is null)`,
      trashed: sql<string>`count(*) filter (where ${recipes.deletedAt} is not null)`,
    })
    .from(recipes)
    .where(eq(recipes.categoryId, categoryId));

  return { active: Number(row?.active ?? 0), trashed: Number(row?.trashed ?? 0) };
}
