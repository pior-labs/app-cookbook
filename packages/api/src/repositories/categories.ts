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
