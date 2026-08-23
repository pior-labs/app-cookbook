import {
  totalMinutes,
  type HomeSections,
  type ListRecipesQuery,
  type RecipeListPage,
  type RecipeSummary,
} from '@cookbook/domain';
import { db } from '../db/index.js';
import { validationError } from '../errors.js';
import {
  InvalidCursorError,
  listCategoriesWithCounts,
  listHomeSection,
  searchRecipes as searchRecipeRows,
  toIso,
  type RecipeSummaryRow,
} from '../repositories/index.js';

// Browse/search and the home screen's sections. Both return the same recipe
// summary shape, so one card renders every list (technical design
// section 11.1).

// How many recipes each home rail shows. The rails are an invitation to open
// something, not a browse surface: `/recipes` is where a cook goes to see
// everything.
const HOME_RAIL_LIMIT = 8;
const HOME_RECENT_LIMIT = 12;

function toSummary(row: RecipeSummaryRow): RecipeSummary {
  const count = Number(row.ratingCount);

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    prepMinutes: row.prepMinutes,
    cookMinutes: row.cookMinutes,
    totalMinutes: totalMinutes(row.prepMinutes, row.cookMinutes),
    rating: {
      average: count === 0 || row.ratingAverage == null ? null : Number(row.ratingAverage),
      count,
    },
    hasImage: row.hasImage,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
    userState: { favorite: row.favorite, rating: row.userRating },
  };
}

export async function searchRecipes(
  query: ListRecipesQuery,
  userId: number,
): Promise<RecipeListPage> {
  try {
    const page = await searchRecipeRows(
      db,
      {
        q: query.q,
        categoryId: query.categoryId,
        tagIds: query.tagId,
        favorite: query.favorite,
        minRating: query.minRating,
        maxTotalMinutes: query.maxTotalMinutes,
        sort: query.sort,
        cursor: query.cursor,
        limit: query.limit,
      },
      userId,
    );

    return { items: page.rows.map(toSummary), nextCursor: page.nextCursor };
  } catch (error) {
    // A cursor is opaque, so a client cannot repair one. Saying which parameter
    // is wrong lets the screen drop it and reload the first page instead of
    // showing a dead end.
    if (error instanceof InvalidCursorError) {
      throw validationError('That page link is no longer valid.', {
        cursor: ['Start from the first page of results.'],
      });
    }

    throw error;
  }
}

// The whole home screen in one response. The sections are independent queries
// and are issued together rather than in sequence (section 7.2).
export async function homeSections(userId: number): Promise<HomeSections> {
  const [recentlyViewed, favorites, highlyRated, recentlyAdded, categories] = await Promise.all([
    listHomeSection(db, 'recentlyViewed', userId, HOME_RAIL_LIMIT),
    listHomeSection(db, 'favorites', userId, HOME_RAIL_LIMIT),
    listHomeSection(db, 'highlyRated', userId, HOME_RAIL_LIMIT),
    listHomeSection(db, 'recentlyAdded', userId, HOME_RECENT_LIMIT),
    listCategoriesWithCounts(db),
  ]);

  return {
    recentlyViewed: recentlyViewed.map(toSummary),
    favorites: favorites.map(toSummary),
    highlyRated: highlyRated.map(toSummary),
    recentlyAdded: recentlyAdded.map(toSummary),
    categories: categories.map((row) => ({
      ...row,
      activeRecipeCount: Number(row.activeRecipeCount),
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
    })),
  };
}
