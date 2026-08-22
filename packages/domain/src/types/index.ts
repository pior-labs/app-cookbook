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
