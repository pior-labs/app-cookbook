import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useApiResource } from '../api/hooks.js';
import { listRecentlyViewed } from '../api/preferences.js';
import { AppShell } from '../AppShell.js';
import { RecipeCardGrid, RecipeCardSkeleton } from '../discovery/RecipeCard.jsx';
import { ErrorState } from '../recipes/states.jsx';

// The current user's recent history (technical design section 11.1). Unlike
// browse it is not paginated: recent history is short by nature and grows only
// as fast as one person opens recipes, so the API returns a capped list.

export function RecentPage() {
  const load = useCallback((signal: AbortSignal) => listRecentlyViewed(signal), []);
  const { data: recipes, error, loading, reload } = useApiResource(load, []);

  return (
    <AppShell>
      <main className="rc-page">
        <h1 className="rc-page__title">Recently opened</h1>
        <p className="rc-page__lede">The recipes you have looked at, most recent first.</p>

        {loading ? (
          <RecipeCardSkeleton label="Loading your recent recipes…" />
        ) : error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : recipes && recipes.length > 0 ? (
          <RecipeCardGrid recipes={recipes} />
        ) : (
          <div className="rc-state">
            <p className="rc-state__title">Nothing here yet.</p>
            <p className="rc-state__body">
              Open a recipe and it will show up here so you can find your way back.
            </p>
            <div className="rc-state__actions">
              <Link className="rc-button rc-button--primary" to="/recipes">
                Browse recipes
              </Link>
            </div>
          </div>
        )}
      </main>
    </AppShell>
  );
}
