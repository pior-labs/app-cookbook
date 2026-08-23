import { searchTokens, type RecipeSort } from '@cookbook/domain';
import { and, eq, sql, type SQL } from 'drizzle-orm';
import {
  categories,
  recentlyViewedRecipes,
  recipeImages,
  recipeIngredients,
  recipeTags,
  recipes,
  tags,
  userFavorites,
  userRatings,
} from '../db/schema.js';
import { activeRecipe, type DbExecutor } from './shared.js';

// Browse, search, and home discovery reads. Everything here is one query per
// list: the aggregate rating and the acting user's own state are computed in
// the same statement rather than looked up per row (technical design
// sections 7.2 and 9).

export interface RecipeSummaryRow {
  id: number;
  name: string;
  description: string;
  categoryId: number;
  categoryName: string;
  prepMinutes: number | null;
  cookMinutes: number | null;
  createdAt: Date;
  updatedAt: Date;
  hasImage: boolean;
  // Postgres returns `avg` as numeric and `count` as bigint, both as strings.
  ratingAverage: string | null;
  ratingCount: string;
  favorite: boolean;
  userRating: number | null;
}

// `avg` over the left-joined ratings; null when nobody has rated the recipe.
const ratingAverage = sql<string | null>`avg(${userRatings.rating})`;
// The sort and filter key: an unrated recipe ranks below every rated one
// instead of dropping out of a `nulls last` ordering that keyset pagination
// would then have to special-case.
const ratingRank = sql`coalesce(avg(${userRatings.rating}), 0)`;

// One row per recipe with its category, whether it has a photo, the household
// rating, and the acting user's favorite/rating. The user-scoped joins are
// keyed by user inside the join condition, so they contribute at most one row
// and never multiply the aggregate.
function summaryQuery(exec: DbExecutor, userId: number) {
  return exec
    .select({
      id: recipes.id,
      name: recipes.name,
      description: recipes.description,
      categoryId: recipes.categoryId,
      categoryName: categories.name,
      prepMinutes: recipes.prepMinutes,
      cookMinutes: recipes.cookMinutes,
      createdAt: recipes.createdAt,
      updatedAt: recipes.updatedAt,
      hasImage: sql<boolean>`${recipeImages.recipeId} is not null`,
      ratingAverage,
      ratingCount: sql<string>`count(${userRatings.rating})`,
      favorite: sql<boolean>`${userFavorites.recipeId} is not null`,
      userRating: sql<
        number | null
      >`max(${userRatings.rating}) filter (where ${userRatings.userId} = ${userId})`,
    })
    .from(recipes)
    .innerJoin(categories, eq(categories.id, recipes.categoryId))
    .leftJoin(recipeImages, eq(recipeImages.recipeId, recipes.id))
    .leftJoin(userRatings, eq(userRatings.recipeId, recipes.id))
    .leftJoin(
      userFavorites,
      and(eq(userFavorites.recipeId, recipes.id), eq(userFavorites.userId, userId)),
    )
    .groupBy(
      recipes.id,
      categories.id,
      recipeImages.id,
      userFavorites.userId,
      userFavorites.recipeId,
      userFavorites.createdAt,
    )
    .$dynamic();
}

// `%` and `_` in user input are literal characters to a cook, not wildcards.
// Escaping them with the default `\` escape leaves the pattern parameterized
// and harmless (section 16).
function likePattern(token: string): string {
  return `%${token.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
}

// Every token must match at least one searchable field. Ingredient and tag
// matches are `exists` subqueries so a recipe with ten matching ingredients is
// still one result row (section 9). The normalized columns are already
// lowercased by the same rule the tokens are, so they compare with `like`.
function tokenPredicate(token: string): SQL {
  const pattern = likePattern(token);

  return sql`(
    ${recipes.name} ilike ${pattern}
    or ${recipes.description} ilike ${pattern}
    or ${categories.name} ilike ${pattern}
    or exists (
      select 1 from ${recipeIngredients}
      where ${recipeIngredients.recipeId} = ${recipes.id}
        and ${recipeIngredients.normalizedName} like ${pattern}
    )
    or exists (
      select 1 from ${recipeTags}
      inner join ${tags} on ${tags.id} = ${recipeTags.tagId}
      where ${recipeTags.recipeId} = ${recipes.id}
        and ${tags.normalizedName} like ${pattern}
    )
  )`;
}

export interface SearchRecipesParams {
  q?: string;
  categoryId?: number;
  tagIds: number[];
  favorite: boolean;
  minRating?: number;
  maxTotalMinutes?: number;
  sort: RecipeSort;
  cursor?: string;
  limit: number;
}

// The opaque cursor from technical design section 7.2. It carries the sort it
// was issued for, the last row's sort key, and the last row's ID, so a page
// continues from exactly where the previous one stopped even when rows are
// added, renamed, or rated in between.
interface CursorPayload {
  sort: RecipeSort;
  key: string;
  id: number;
}

export class InvalidCursorError extends Error {}

function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodeCursor(cursor: string, sort: RecipeSort): CursorPayload {
  let parsed: unknown;

  try {
    parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw new InvalidCursorError('Cursor is not decodable.');
  }

  const payload = parsed as Partial<CursorPayload> | null;

  if (
    !payload ||
    typeof payload.key !== 'string' ||
    typeof payload.id !== 'number' ||
    !Number.isSafeInteger(payload.id) ||
    // A cursor issued for one ordering describes nothing about another, so
    // changing the sort must restart rather than resume from a stale key.
    payload.sort !== sort
  ) {
    throw new InvalidCursorError('Cursor does not belong to this query.');
  }

  return { sort, key: payload.key, id: payload.id };
}

function cursorKey(sort: RecipeSort, row: RecipeSummaryRow): string {
  switch (sort) {
    case 'recentlyAdded':
      return row.createdAt.toISOString();
    case 'recentlyUpdated':
      return row.updatedAt.toISOString();
    case 'name':
      return row.name.toLowerCase();
    case 'rating':
      return String(row.ratingAverage == null ? 0 : Number(row.ratingAverage));
  }
}

// Ordering and the matching keyset predicate are defined together, because a
// cursor that disagrees with the `order by` silently skips or repeats rows.
// Every sort ends in the recipe ID so the order is total.
function ordering(sort: RecipeSort): SQL[] {
  switch (sort) {
    case 'recentlyAdded':
      return [sql`${recipes.createdAt} desc`, sql`${recipes.id} desc`];
    case 'recentlyUpdated':
      return [sql`${recipes.updatedAt} desc`, sql`${recipes.id} desc`];
    case 'name':
      return [sql`lower(${recipes.name}) asc`, sql`${recipes.id} asc`];
    case 'rating':
      return [sql`${ratingRank} desc`, sql`${recipes.id} desc`];
  }
}

// Row comparison rather than the expanded `a < x or (a = x and b < y)` form:
// one expression, and it cannot drift out of step with the ordering above.
function keysetPredicate(payload: CursorPayload): SQL {
  switch (payload.sort) {
    case 'recentlyAdded':
      return sql`(${recipes.createdAt}, ${recipes.id}) < (${payload.key}::timestamptz, ${payload.id}::int)`;
    case 'recentlyUpdated':
      return sql`(${recipes.updatedAt}, ${recipes.id}) < (${payload.key}::timestamptz, ${payload.id}::int)`;
    case 'name':
      return sql`(lower(${recipes.name}), ${recipes.id}) > (${payload.key}::text, ${payload.id}::int)`;
    case 'rating':
      return sql`(${ratingRank}, ${recipes.id}) < (${payload.key}::numeric, ${payload.id}::int)`;
  }
}

export interface RecipePage {
  rows: RecipeSummaryRow[];
  nextCursor: string | null;
}

export async function searchRecipes(
  exec: DbExecutor,
  params: SearchRecipesParams,
  userId: number,
): Promise<RecipePage> {
  const where: SQL[] = [activeRecipe()];
  // Predicates over the rating aggregate belong in `having`; the keyset
  // predicate for the rating sort is one of them.
  const having: SQL[] = [];

  for (const token of searchTokens(params.q ?? '')) {
    where.push(tokenPredicate(token));
  }

  if (params.categoryId != null) {
    where.push(eq(recipes.categoryId, params.categoryId));
  }

  // Match-all: a recipe must carry every requested tag, so each one is its own
  // `exists` rather than an `in` list, which would match any of them.
  for (const tagId of params.tagIds) {
    where.push(
      sql`exists (
        select 1 from ${recipeTags}
        where ${recipeTags.recipeId} = ${recipes.id} and ${recipeTags.tagId} = ${tagId}
      )`,
    );
  }

  if (params.favorite) {
    where.push(sql`${userFavorites.recipeId} is not null`);
  }

  if (params.maxTotalMinutes != null) {
    // A recipe with no recorded time is unknown, not fast, so it is not an
    // answer to "under 30 minutes".
    where.push(
      sql`(${recipes.prepMinutes} is not null or ${recipes.cookMinutes} is not null)`,
      sql`coalesce(${recipes.prepMinutes}, 0) + coalesce(${recipes.cookMinutes}, 0) <= ${params.maxTotalMinutes}`,
    );
  }

  if (params.minRating != null) {
    having.push(sql`${ratingAverage} >= ${params.minRating}`);
  }

  if (params.cursor) {
    const payload = decodeCursor(params.cursor, params.sort);
    const predicate = keysetPredicate(payload);
    (payload.sort === 'rating' ? having : where).push(predicate);
  }

  let query = summaryQuery(exec, userId)
    .where(and(...where))
    .orderBy(...ordering(params.sort))
    // One extra row answers "is there another page?" without a second count
    // query, and is discarded before the page is returned.
    .limit(params.limit + 1);

  if (having.length > 0) {
    query = query.having(and(...having));
  }

  const found = await query;
  const rows = found.slice(0, params.limit);
  const last = rows.at(-1);

  return {
    rows,
    nextCursor:
      found.length > params.limit && last
        ? encodeCursor({ sort: params.sort, key: cursorKey(params.sort, last), id: last.id })
        : null,
  };
}

export type HomeSection = 'recentlyViewed' | 'favorites' | 'highlyRated' | 'recentlyAdded';

// The home rails. Each is the same summary row shape as browse, so one card
// component renders every list (section 11.1).
export async function listHomeSection(
  exec: DbExecutor,
  section: HomeSection,
  userId: number,
  limit: number,
): Promise<RecipeSummaryRow[]> {
  // Recently viewed is ordered by the acting user's own view time. It reads
  // through correlated subqueries rather than a join so the grouped selection
  // stays identical to every other section.
  const lastViewedAt = sql`(
    select ${recentlyViewedRecipes.lastViewedAt} from ${recentlyViewedRecipes}
    where ${recentlyViewedRecipes.recipeId} = ${recipes.id}
      and ${recentlyViewedRecipes.userId} = ${userId}
  )`;

  const query = summaryQuery(exec, userId).limit(limit);

  switch (section) {
    case 'recentlyViewed':
      return query
        .where(and(activeRecipe(), sql`${lastViewedAt} is not null`))
        .orderBy(sql`${lastViewedAt} desc`, sql`${recipes.id} desc`);
    case 'favorites':
      return query
        .where(and(activeRecipe(), sql`${userFavorites.recipeId} is not null`))
        .orderBy(sql`${userFavorites.createdAt} desc`, sql`${recipes.id} desc`);
    case 'highlyRated':
      // Only recipes the household has actually rated, best first.
      return query
        .where(activeRecipe())
        .having(sql`count(${userRatings.rating}) > 0`)
        .orderBy(sql`${ratingAverage} desc`, sql`${recipes.id} desc`);
    case 'recentlyAdded':
      return query
        .where(activeRecipe())
        .orderBy(sql`${recipes.createdAt} desc`, sql`${recipes.id} desc`);
  }
}
