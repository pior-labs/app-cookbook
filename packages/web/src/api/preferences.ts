import type { RecipePreferences, RecipeSummary } from '@cookbook/domain';
import { apiGet, apiSend } from './client.js';

// Favorites, ratings, and recently viewed for the signed-in cook. The acting
// user is never sent: the API takes it from the session
// (technical design section 4.6).

export function favoriteRecipe(id: number): Promise<RecipePreferences> {
  return apiSend<RecipePreferences>(`/api/recipes/${id}/favorite`, 'PUT');
}

export function unfavoriteRecipe(id: number): Promise<RecipePreferences> {
  return apiSend<RecipePreferences>(`/api/recipes/${id}/favorite`, 'DELETE');
}

export function rateRecipe(id: number, rating: number): Promise<RecipePreferences> {
  return apiSend<RecipePreferences>(`/api/recipes/${id}/rating`, 'PUT', { rating });
}

export function clearRating(id: number): Promise<RecipePreferences> {
  return apiSend<RecipePreferences>(`/api/recipes/${id}/rating`, 'DELETE');
}

// Recording a view is a side effect of opening a recipe, not something a cook
// asks for, so a failure is never surfaced.
export function recordView(id: number): Promise<void> {
  return apiSend<void>(`/api/recipes/${id}/view`, 'POST');
}

export function listRecentlyViewed(signal?: AbortSignal): Promise<RecipeSummary[]> {
  return apiGet<RecipeSummary[]>('/api/recent', signal);
}
