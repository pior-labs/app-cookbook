import { useCallback } from 'react';
import { useApiResource } from '../api/hooks.js';
import { listRecentlyViewed } from '../api/preferences.js';
import { ButtonLink, PageHeader } from '@/components/ui';
import { RecipeCardGrid, RecipeCardSkeleton } from '../discovery/RecipeCard.jsx';
import { EmptyState, ErrorState } from '../recipes/states.jsx';

// The current user's recent history (technical design section 11.1). Unlike
// browse it is not paginated: recent history is short by nature and grows only
// as fast as one person opens recipes, so the API returns a capped list.

export function RecentPage() {
  const load = useCallback((signal: AbortSignal) => listRecentlyViewed(signal), []);
  const { data: recipes, error, loading, reload } = useApiResource(load, []);

  return (
    <div className="cb-rise flex min-w-0 flex-col gap-7">
      <PageHeader
        title="Recently opened"
        lede="The recipes you have looked at, most recent first."
      />

      {loading ? (
        <RecipeCardSkeleton label="Loading your recent recipes…" />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : recipes && recipes.length > 0 ? (
        <RecipeCardGrid recipes={recipes} />
      ) : (
        <EmptyState
          title="Nothing here yet."
          body="Open a recipe and it will show up here so you can find your way back."
        >
          <ButtonLink to="/recipes" variant="primary">
            Browse recipes
          </ButtonLink>
        </EmptyState>
      )}
    </div>
  );
}
