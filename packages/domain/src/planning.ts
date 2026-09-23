import { z } from 'zod';
import {
  idSchema,
  servingsSchema,
  quantitySchema,
  unitCodeSchema,
  customUnitSchema,
} from './schemas/primitives.js';
import type { Fraction } from './ingredients/fractions.js';

export const versionSchema = z.number().int().positive();
// A plan's name is optional at creation and stays optional afterwards: an
// untitled plan is a legitimate thing to have, so renaming to blank is allowed
// rather than rejected.
const mealPlanNameSchema = z.string().trim().max(160).default('');
export const createMealPlanSchema = z.object({ name: mealPlanNameSchema }).strict();
export const renameMealPlanSchema = z
  .object({ version: versionSchema, name: mealPlanNameSchema })
  .strict();
export const mealSelectionSchema = z
  .object({ recipeId: idSchema, servings: servingsSchema })
  .strict();
export const addMealSchema = mealSelectionSchema.extend({ version: versionSchema }).strict();
export const updateMealSchema = z
  .object({
    version: versionSchema,
    recipeId: idSchema.optional(),
    servings: servingsSchema.optional(),
    position: z.number().int().min(0).max(49).optional(),
  })
  .strict();
export const versionInputSchema = z.object({ version: versionSchema }).strict();
export const applyMealsSchema = z
  .object({
    version: versionSchema,
    meals: z.array(mealSelectionSchema).min(1).max(50),
  })
  .strict();
export const groceryItemInputSchema = z
  .object({
    version: versionSchema,
    name: z.string().trim().min(1).max(160),
    quantity: quantitySchema,
    unitCode: unitCodeSchema.nullable().default(null),
    unitText: customUnitSchema.nullable().default(null),
    checked: z.boolean().default(false),
  })
  .strict()
  .refine((v) => !(v.unitCode && v.unitText), {
    message: 'Choose a known or custom unit, not both.',
  });
export const checkItemSchema = versionInputSchema.extend({ checked: z.boolean() }).strict();
export const resolveMergeSchema = versionInputSchema.extend({ merge: z.boolean() }).strict();
export const recommendationPreferencesSchema = z
  .object({
    count: z.number().int().min(1).max(20).default(5),
    servings: servingsSchema.default(2),
    maxTotalMinutes: z.number().int().min(1).max(10080).optional(),
    categoryId: idSchema.optional(),
    tagIds: z.array(idSchema).max(20).default([]),
    preferFavorites: z.boolean().default(false),
    minRating: z.number().int().min(1).max(5).optional(),
    avoidRecentlyUsed: z.boolean().default(false),
    preference: z.string().trim().max(1000).default(''),
  })
  .strict();
export type RecommendationPreferences = z.infer<typeof recommendationPreferencesSchema>;
// A planned meal carries enough of its recipe to be drawn as the card the rest
// of the app draws recipes as. It is deliberately not a full `RecipeSummary`:
// the household rating and the acting user's favorite need user-scoped joins,
// and a meal plan is shared household data read without a user in scope. The
// three fields here are the ones the card paints with, and they are all null
// or false once the recipe behind the meal is gone.
export interface MealPlanItem {
  id: number;
  recipeId: number | null;
  recipeName: string;
  servings: number;
  position: number;
  unavailable: boolean;
  categoryName: string | null;
  totalMinutes: number | null;
  hasImage: boolean;
}
export interface MealPlan {
  id: number;
  name: string;
  version: number;
  createdByUserId: number;
  updatedByUserId: number;
  createdAt: string;
  updatedAt: string;
  items: MealPlanItem[];
  groceryListIds: number[];
}
export interface IngredientSource {
  key: string;
  recipeId: number;
  recipeName: string;
  recipeVersion: number;
  mealItemId: number;
  name: string;
  preparation: string | null;
  quantity: Fraction | null;
  unitCode: string | null;
  unitText: string | null;
}
export interface GroceryItem {
  id: number;
  name: string;
  quantity: Fraction | null;
  unitCode: string | null;
  unitText: string | null;
  checked: boolean;
  edited: boolean;
  sources: IngredientSource[];
}
export interface MergeSuggestion {
  id: number;
  canonicalName: string;
  itemIds: number[];
  reason: string;
}
export interface GroceryList {
  id: number;
  mealPlanId: number;
  planVersion: number;
  version: number;
  createdAt: string;
  updatedAt: string;
  createdByUserId: number;
  updatedByUserId: number;
  normalization: 'llm' | 'fallback';
  items: GroceryItem[];
  suggestions: MergeSuggestion[];
}
export interface MealProposal {
  meals: { recipeId: number; recipeName: string; servings: number }[];
  explanation: string;
  mode: 'llm' | 'fallback';
  candidateLimitReached: boolean;
}
