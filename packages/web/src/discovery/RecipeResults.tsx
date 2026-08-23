import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ErrorState } from '../recipes/states.jsx';
import { RecipeCardGrid, RecipeCardSkeleton } from './RecipeCard.jsx';
import type { RecipePages } from './useRecipePages.js';

// The result list every paginated recipe screen shows: count, skeleton, error,
// empty state, and "load more" (technical design section 11.3). Browse and
// favorites differ in what they ask for, not in how the answer looks.

function resultLabel(count: number, more: boolean): string {
  if (count === 0) return 'No recipes';
  const suffix = count === 1 ? '1 recipe' : `${count} recipes`;
  return more ? `${suffix} so far` : suffix;
}

export interface RecipeResultsProps {
  pages: RecipePages;
  // Whether a filter is narrowing the list, which decides whether "nothing
  // here" means "clear a filter" or "add your first recipe".
  filtered: boolean;
  loadingLabel: string;
  onClearFilters?: () => void;
  emptyTitle?: string;
  emptyBody?: string;
  emptyAction?: ReactNode;
}

export function RecipeResults({
  pages,
  filtered,
  loadingLabel,
  onClearFilters,
  emptyTitle,
  emptyBody,
  emptyAction,
}: RecipeResultsProps) {
  const { recipes, loading, error, reload, hasMore, loadingMore, moreError, loadMore } = pages;

  return (
    <>
      <div className="rc-results__bar">
        <p className="rc-results__count" role="status">
          {loading ? 'Loading…' : resultLabel(recipes.length, hasMore)}
        </p>
        {filtered && onClearFilters ? (
          <button
            className="rc-button rc-button--ghost rc-button--small"
            type="button"
            onClick={onClearFilters}
          >
            Clear filters
          </button>
        ) : null}
      </div>

      {loading ? (
        <RecipeCardSkeleton label={loadingLabel} />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : recipes.length === 0 ? (
        // A search that found nothing keeps its query and offers a way out;
        // an unfiltered empty list is a different problem (section 11.3).
        <div className="rc-state">
          <p className="rc-state__title">
            {filtered ? 'Nothing matches that yet.' : (emptyTitle ?? 'No recipes yet.')}
          </p>
          <p className="rc-state__body">
            {filtered
              ? 'Try fewer filters or a different word.'
              : (emptyBody ?? 'Add the first one and it will show up here.')}
          </p>
          <div className="rc-state__actions">
            {filtered && onClearFilters ? (
              <button className="rc-button rc-button--primary" type="button" onClick={onClearFilters}>
                Clear filters
              </button>
            ) : (
              (emptyAction ?? (
                <Link className="rc-button rc-button--primary" to="/recipes/new">
                  Add a recipe
                </Link>
              ))
            )}
          </div>
        </div>
      ) : (
        <>
          <RecipeCardGrid recipes={recipes} />

          {/* A failed extension keeps the pages already on screen: a cook is
              reading them. */}
          {moreError ? (
            <p className="rc-form__banner" role="alert">
              {moreError.message}
            </p>
          ) : null}

          {hasMore ? (
            <div className="rc-results__more">
              <button
                className="rc-button rc-button--ghost"
                type="button"
                disabled={loadingMore}
                onClick={loadMore}
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
