import type { Fraction } from '../ingredients/fractions.js';

// Stable domain read types shared across trusted packages. JSON uses camelCase
// and ISO 8601 UTC strings for timestamps, matching the API conventions in
// technical design section 7.1. These describe what the API returns; request
// validation lives in the schema modules.

export interface Category {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface CategorySummary extends Category {
  activeRecipeCount: number;
}

export interface Tag {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface TagSummary extends Tag {
  activeRecipeCount: number;
}

export interface RecipeIngredient {
  id: number;
  position: number;
  quantity: Fraction | null;
  unitCode: string | null;
  unitText: string | null;
  name: string;
  preparation: string | null;
}

export interface RecipeInstruction {
  id: number;
  position: number;
  body: string;
}

export interface RecipeImage {
  cardUrl: string;
  detailUrl: string;
  cardWidth: number;
  cardHeight: number;
  detailWidth: number;
  detailHeight: number;
}

// The current user's per-recipe state, always derived from the session.
export interface RecipeUserState {
  favorite: boolean;
  rating: number | null;
}

export interface RecipeRatingSummary {
  average: number | null;
  count: number;
}

// What a favorite or rating change returns. The household average moves when
// one person rates, so the answer carries both halves and an optimistic UI can
// reconcile against the truth instead of guessing at the new average
// (technical design section 11.3).
export interface RecipePreferences {
  userState: RecipeUserState;
  rating: RecipeRatingSummary;
}

export interface RecipeSummary {
  id: number;
  name: string;
  description: string;
  categoryId: number;
  categoryName: string;
  prepMinutes: number | null;
  cookMinutes: number | null;
  totalMinutes: number | null;
  rating: RecipeRatingSummary;
  hasImage: boolean;
  createdAt: string;
  updatedAt: string;
  userState: RecipeUserState;
}

export interface RecipeDetail extends RecipeSummary {
  baseServings: number;
  notes: string | null;
  sourceUrl: string | null;
  sourceText: string | null;
  createdByUserId: number;
  version: number;
  ingredients: RecipeIngredient[];
  instructions: RecipeInstruction[];
  tags: Tag[];
  image: RecipeImage | null;
}

// Total time is derived, never stored: prep + cook when at least one component
// exists, otherwise null. See technical design section 4.3.
export function totalMinutes(
  prepMinutes: number | null,
  cookMinutes: number | null,
): number | null {
  if (prepMinutes == null && cookMinutes == null) {
    return null;
  }
  return (prepMinutes ?? 0) + (cookMinutes ?? 0);
}

// One page of browse/search results. The cursor is opaque to the client: it
// encodes the sort key of the last row so the next page continues from exactly
// there, and it is null when the last page has been reached
// (technical design section 7.2).
export interface RecipeListPage {
  items: RecipeSummary[];
  nextCursor: string | null;
}

// The home screen's discovery sections for the current user. Per-user sections
// are empty until that user has favorited, rated, or opened anything, and the
// screen hides an empty section rather than showing a blank rail
// (section 11.1).
export interface HomeSections {
  recentlyViewed: RecipeSummary[];
  favorites: RecipeSummary[];
  highlyRated: RecipeSummary[];
  recentlyAdded: RecipeSummary[];
  categories: CategorySummary[];
}
