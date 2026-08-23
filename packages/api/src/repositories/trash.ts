import { and, eq, isNotNull, sql, type SQL } from 'drizzle-orm';
import { categories, recipes, users } from '../db/schema.js';
import { decodeCursor, encodeCursor } from './cursor.js';
import { activeRecipe, type DbExecutor } from './shared.js';

// The explicit Trash path (technical design section 10, ADR 0005). Every
// statement here scopes to soft-deleted recipes on purpose: the active
// repositories never see these rows, and nothing here ever touches a live one.
// Keeping the two scopes in separate modules is what makes the scope of a
// deletion visible in review.

// The counterpart of `activeRecipe()`. Soft deletion sets `deleted_at` and
// `deleted_by_user_id` together, and a database check keeps the pair
// consistent, so either column identifies a trashed row.
export function trashedRecipe(): SQL {
  return isNotNull(recipes.deletedAt);
}

export interface TrashedRecipeRow {
  id: number;
  name: string;
  description: string;
  categoryName: string;
  createdAt: Date;
  deletedAt: Date;
  deletedByUserId: number;
  deletedByName: string;
}

// A recipe moves to Trash only from the live cookbook. Returning whether the
// update matched lets the caller answer 404 rather than report a deletion that
// deleted nothing: an already-trashed recipe is not there to delete twice.
export async function softDeleteRecipe(
  exec: DbExecutor,
  recipeId: number,
  userId: number,
): Promise<boolean> {
  const rows = await exec
    .update(recipes)
    .set({ deletedAt: new Date(), deletedByUserId: userId })
    .where(and(eq(recipes.id, recipeId), activeRecipe()))
    .returning({ id: recipes.id });

  return rows.length > 0;
}

// Restoration clears the deletion metadata and nothing else. Ingredients,
// instructions, tags, the image, and every person's favorite, rating, and view
// history were never removed, so they come back with the recipe. `updated_at`
// is deliberately left alone: restoring is not an edit, and a restored recipe
// should return to its own place in "recently updated" rather than jump to the
// top of it.
export async function restoreRecipe(exec: DbExecutor, recipeId: number): Promise<boolean> {
  const rows = await exec
    .update(recipes)
    .set({ deletedAt: null, deletedByUserId: null })
    .where(and(eq(recipes.id, recipeId), trashedRecipe()))
    .returning({ id: recipes.id });

  return rows.length > 0;
}

export async function findTrashedRecipe(
  exec: DbExecutor,
  recipeId: number,
): Promise<{ id: number; name: string } | null> {
  const [row] = await exec
    .select({ id: recipes.id, name: recipes.name })
    .from(recipes)
    .where(and(eq(recipes.id, recipeId), trashedRecipe()))
    .limit(1);

  return row ?? null;
}

// Permanent deletion, reachable only for a recipe already in Trash. Every
// dependent row - ingredients, instructions, tag assignments, image metadata,
// favorites, ratings, and recent history - leaves with the recipe through the
// schema's cascades, so this is one statement rather than eight. Image files
// are not the database's to remove; the service deletes them after the
// transaction commits (section 8).
export async function deleteTrashedRecipe(
  exec: DbExecutor,
  recipeId: number,
): Promise<boolean> {
  const rows = await exec
    .delete(recipes)
    .where(and(eq(recipes.id, recipeId), trashedRecipe()))
    .returning({ id: recipes.id });

  return rows.length > 0;
}

// Trash has one inherent order - most recently deleted first - so unlike browse
// it takes no sort. The cursor still names it, so a browse cursor pasted here
// is rejected rather than half-understood.
const TRASH_SORT = 'trashed';

export interface ListTrashParams {
  cursor?: string;
  limit: number;
}

export interface TrashPage {
  rows: TrashedRecipeRow[];
  nextCursor: string | null;
}

export async function listTrashedRecipes(
  exec: DbExecutor,
  params: ListTrashParams,
): Promise<TrashPage> {
  const where: SQL[] = [trashedRecipe()];

  if (params.cursor) {
    const payload = decodeCursor(params.cursor, TRASH_SORT);
    where.push(
      sql`(${recipes.deletedAt}, ${recipes.id}) < (${payload.key}::timestamptz, ${payload.id}::int)`,
    );
  }

  const found = await exec
    .select({
      id: recipes.id,
      name: recipes.name,
      description: recipes.description,
      categoryName: categories.name,
      createdAt: recipes.createdAt,
      // The query is scoped to trashed rows, so both deletion columns are
      // present; the columns themselves stay nullable because an active
      // recipe's are not. `mapWith` keeps the driver's text going through the
      // same conversion the column would have used.
      deletedAt: sql`${recipes.deletedAt}`.mapWith(recipes.deletedAt),
      deletedByUserId: sql`${recipes.deletedByUserId}`.mapWith(Number),
      deletedByName: users.name,
    })
    .from(recipes)
    .innerJoin(categories, eq(categories.id, recipes.categoryId))
    .innerJoin(users, eq(users.id, recipes.deletedByUserId))
    .where(and(...where))
    .orderBy(sql`${recipes.deletedAt} desc`, sql`${recipes.id} desc`)
    // One extra row answers "is there another page?" without a second count
    // query, and is discarded before the page is returned.
    .limit(params.limit + 1);

  const rows = found.slice(0, params.limit);
  const last = rows.at(-1);

  return {
    rows,
    nextCursor:
      found.length > params.limit && last
        ? encodeCursor({
            sort: TRASH_SORT,
            key: last.deletedAt.toISOString(),
            id: last.id,
          })
        : null,
  };
}
