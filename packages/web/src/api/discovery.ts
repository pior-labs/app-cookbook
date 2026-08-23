import type { HomeSections, RecipeListPage, RecipeSort } from '@cookbook/domain';
import { apiGet, apiSend } from './client.js';

// Browse, home discovery, and category/tag management. Transport only: the API
// is authoritative for every rule these screens display
// (technical design section 3).

// What the browse screen can ask for. It mirrors the API query parameters
// rather than the URL the screen shows, so the two can differ where a shorter
// URL reads better.
export interface BrowseFilters {
  q: string;
  categoryId: number | null;
  tagIds: number[];
  maxTotalMinutes: number | null;
  sort: RecipeSort;
}

export const EMPTY_FILTERS: BrowseFilters = {
  q: '',
  categoryId: null,
  tagIds: [],
  maxTotalMinutes: null,
  sort: 'recentlyAdded',
};

export function isFiltered(filters: BrowseFilters): boolean {
  return (
    filters.q.trim() !== '' ||
    filters.categoryId != null ||
    filters.tagIds.length > 0 ||
    filters.maxTotalMinutes != null
  );
}

// The one place filters become a query string, so the URL the screen pushes and
// the request it sends can never disagree.
export function browseQuery(filters: BrowseFilters, cursor?: string | null): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.q.trim() !== '') params.set('q', filters.q.trim());
  if (filters.categoryId != null) params.set('categoryId', String(filters.categoryId));
  for (const tagId of filters.tagIds) params.append('tagId', String(tagId));
  if (filters.maxTotalMinutes != null) {
    params.set('maxTotalMinutes', String(filters.maxTotalMinutes));
  }
  if (filters.sort !== 'recentlyAdded') params.set('sort', filters.sort);
  if (cursor) params.set('cursor', cursor);

  return params;
}

export function browseRecipes(
  filters: BrowseFilters,
  cursor: string | null,
  signal?: AbortSignal,
): Promise<RecipeListPage> {
  return apiGet<RecipeListPage>(`/api/recipes?${browseQuery(filters, cursor)}`, signal);
}

export function getHome(signal?: AbortSignal): Promise<HomeSections> {
  return apiGet<HomeSections>('/api/home', signal);
}

export interface OrganizationRecord {
  id: number;
  name: string;
}

export function createCategory(name: string): Promise<OrganizationRecord> {
  return apiSend<OrganizationRecord>('/api/categories', 'POST', { name });
}

export function renameCategory(id: number, name: string): Promise<OrganizationRecord> {
  return apiSend<OrganizationRecord>(`/api/categories/${id}`, 'PUT', { name });
}

export function deleteCategory(id: number): Promise<void> {
  return apiSend<void>(`/api/categories/${id}`, 'DELETE');
}

export function renameTag(id: number, name: string): Promise<OrganizationRecord> {
  return apiSend<OrganizationRecord>(`/api/tags/${id}`, 'PUT', { name });
}

export function deleteTag(id: number): Promise<void> {
  return apiSend<void>(`/api/tags/${id}`, 'DELETE');
}
