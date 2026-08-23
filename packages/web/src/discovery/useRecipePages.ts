import type { RecipeSummary } from '@cookbook/domain';
import { browseQuery, browseRecipes, type BrowseFilters } from '../api/discovery.js';
import { useCursorPages, type CursorPages } from '../api/useCursorPages.js';

// Browse and favorites are the same paginated read with different filters, so
// they page identically (technical design section 7.2). The filters are the
// result set's identity: changing one starts a new list rather than extending
// the old one.

export type RecipePages = CursorPages<RecipeSummary>;

export function useRecipePages(filters: BrowseFilters): RecipePages {
  return useCursorPages(browseQuery(filters).toString(), (cursor, signal) =>
    browseRecipes(filters, cursor, signal),
  );
}
