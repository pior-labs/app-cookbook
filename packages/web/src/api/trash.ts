import type { TrashListPage } from '@cookbook/domain';
import { apiGet, apiSend } from './client.js';

// Recoverable deletion (technical design sections 7.3 and 10). Deleting a
// recipe is a call against the recipe; restoring and destroying it are calls
// against Trash, because while it is in there the recipe's own URL is a 404.

export function trashRecipe(id: number): Promise<void> {
  return apiSend<void>(`/api/recipes/${id}`, 'DELETE');
}

export function listTrash(
  cursor: string | null,
  signal?: AbortSignal,
): Promise<TrashListPage> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';

  return apiGet<TrashListPage>(`/api/trash${query}`, signal);
}

export function restoreRecipe(id: number): Promise<void> {
  return apiSend<void>(`/api/trash/${id}/restore`, 'POST');
}

// The one call the application cannot undo.
export function deleteRecipeForever(id: number): Promise<void> {
  return apiSend<void>(`/api/trash/${id}`, 'DELETE');
}
