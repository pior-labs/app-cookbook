import type { ReactNode } from 'react';
import { Button, ButtonLink } from '@/components/ui';
import { Banner, EmptyState, ErrorState } from '../recipes/states.jsx';
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
  const { items: recipes, loading, error, reload, hasMore, loadingMore, moreError, loadMore } = pages;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4 px-0.5">
        <p className="m-0 font-serif text-[15px] italic text-ink-2" role="status">
          {loading ? 'Loading…' : resultLabel(recipes.length, hasMore)}
        </p>
        {filtered && onClearFilters ? (
          <Button size="small" variant="quiet" onClick={onClearFilters}>
            Clear filters
          </Button>
        ) : null}
      </div>

      {loading ? (
        <RecipeCardSkeleton label={loadingLabel} />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : recipes.length === 0 ? (
        // A search that found nothing keeps its query and offers a way out;
        // an unfiltered empty list is a different problem (section 11.3).
        <EmptyState
          title={filtered ? 'Nothing matches that yet.' : (emptyTitle ?? 'No recipes yet.')}
          body={
            filtered
              ? 'Try fewer filters or a different word.'
              : (emptyBody ?? 'Add the first one and it will show up here.')
          }
        >
          {filtered && onClearFilters ? (
            <Button variant="primary" onClick={onClearFilters}>
              Clear filters
            </Button>
          ) : (
            (emptyAction ?? (
              <ButtonLink to="/recipes/new" variant="primary">
                Add a recipe
              </ButtonLink>
            ))
          )}
        </EmptyState>
      ) : (
        <>
          <RecipeCardGrid recipes={recipes} />

          {/* A failed extension keeps the pages already on screen: a cook is
              reading them. */}
          {moreError ? <Banner>{moreError.message}</Banner> : null}

          {hasMore ? (
            <div className="flex justify-center pt-1">
              <Button disabled={loadingMore} onClick={loadMore}>
                {loadingMore ? 'Loading…' : 'Load more'}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
