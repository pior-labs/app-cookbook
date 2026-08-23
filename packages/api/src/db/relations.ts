import { relations } from 'drizzle-orm';
import {
  categories,
  recentlyViewedRecipes,
  recipeImages,
  recipeIngredients,
  recipeInstructions,
  recipeTags,
  recipes,
  tags,
  userFavorites,
  userRatings,
  users,
} from './schema.js';

// Drizzle relations for the recipe aggregate. These power the relational query
// API (`db.query.*`) used by the repositories. They describe how rows join;
// they do not change the SQL schema.

export const usersRelations = relations(users, ({ many }) => ({
  createdRecipes: many(recipes),
  favorites: many(userFavorites),
  ratings: many(userRatings),
  recentlyViewed: many(recentlyViewedRecipes),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  recipes: many(recipes),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  recipeTags: many(recipeTags),
}));

export const recipesRelations = relations(recipes, ({ one, many }) => ({
  category: one(categories, {
    fields: [recipes.categoryId],
    references: [categories.id],
  }),
  createdBy: one(users, {
    fields: [recipes.createdByUserId],
    references: [users.id],
  }),
  ingredients: many(recipeIngredients),
  instructions: many(recipeInstructions),
  recipeTags: many(recipeTags),
  image: one(recipeImages),
  favorites: many(userFavorites),
  ratings: many(userRatings),
  recentlyViewed: many(recentlyViewedRecipes),
}));

export const recipeIngredientsRelations = relations(recipeIngredients, ({ one }) => ({
  recipe: one(recipes, {
    fields: [recipeIngredients.recipeId],
    references: [recipes.id],
  }),
}));

export const recipeInstructionsRelations = relations(recipeInstructions, ({ one }) => ({
  recipe: one(recipes, {
    fields: [recipeInstructions.recipeId],
    references: [recipes.id],
  }),
}));

export const recipeTagsRelations = relations(recipeTags, ({ one }) => ({
  recipe: one(recipes, {
    fields: [recipeTags.recipeId],
    references: [recipes.id],
  }),
  tag: one(tags, {
    fields: [recipeTags.tagId],
    references: [tags.id],
  }),
}));

export const recipeImagesRelations = relations(recipeImages, ({ one }) => ({
  recipe: one(recipes, {
    fields: [recipeImages.recipeId],
    references: [recipes.id],
  }),
}));

export const userFavoritesRelations = relations(userFavorites, ({ one }) => ({
  user: one(users, { fields: [userFavorites.userId], references: [users.id] }),
  recipe: one(recipes, { fields: [userFavorites.recipeId], references: [recipes.id] }),
}));

export const userRatingsRelations = relations(userRatings, ({ one }) => ({
  user: one(users, { fields: [userRatings.userId], references: [users.id] }),
  recipe: one(recipes, { fields: [userRatings.recipeId], references: [recipes.id] }),
}));

export const recentlyViewedRecipesRelations = relations(recentlyViewedRecipes, ({ one }) => ({
  user: one(users, { fields: [recentlyViewedRecipes.userId], references: [users.id] }),
  recipe: one(recipes, { fields: [recentlyViewedRecipes.recipeId], references: [recipes.id] }),
}));
