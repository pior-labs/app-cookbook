import type {
  CategorySummary,
  CreateRecipeRequest,
  RecipeDetail,
  RecipeImage,
  TagSummary,
  UpdateRecipeRequest,
} from '@cookbook/domain';
import { apiGet, apiSend, apiUpload } from './client.js';

// Typed calls for everything the recipe screens need. The API is authoritative
// for every mutation; these are transport only (technical design section 3).

export function getRecipe(id: number, signal?: AbortSignal): Promise<RecipeDetail> {
  return apiGet<RecipeDetail>(`/api/recipes/${id}`, signal);
}

export function createRecipe(input: CreateRecipeRequest): Promise<RecipeDetail> {
  return apiSend<RecipeDetail>('/api/recipes', 'POST', input);
}

export function updateRecipe(id: number, input: UpdateRecipeRequest): Promise<RecipeDetail> {
  return apiSend<RecipeDetail>(`/api/recipes/${id}`, 'PUT', input);
}

export function listCategories(signal?: AbortSignal): Promise<CategorySummary[]> {
  return apiGet<CategorySummary[]>('/api/categories', signal);
}

export function listTags(signal?: AbortSignal): Promise<TagSummary[]> {
  return apiGet<TagSummary[]>('/api/tags', signal);
}

export function createTag(name: string): Promise<{ id: number; name: string }> {
  return apiSend<{ id: number; name: string }>('/api/tags', 'POST', { name });
}

export function uploadRecipePhoto(id: number, file: File): Promise<RecipeImage> {
  return apiUpload<RecipeImage>(`/api/recipes/${id}/photo`, 'photo', file);
}

export function deleteRecipePhoto(id: number): Promise<void> {
  return apiSend<void>(`/api/recipes/${id}/photo`, 'DELETE');
}
