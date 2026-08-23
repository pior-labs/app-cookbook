import type { RecipeSummary } from '@cookbook/domain';
import { useCallback, useEffect, useState } from 'react';
import { ApiRequestError } from '../api/client.js';
import { browseQuery, browseRecipes, type BrowseFilters } from '../api/discovery.js';
import { useApiResource } from '../api/hooks.js';

// A cursor-paginated result set for one set of filters. Browse and the
// favorites screen are the same read with different filters, so they page the
// same way (technical design section 7.2).

export interface RecipePages {
  recipes: RecipeSummary[];
  loading: boolean;
  error: ApiRequestError | null;
  reload: () => void;
  // Null once the last page has been reached.
  hasMore: boolean;
  loadingMore: boolean;
  // A failure to extend the list, which must not discard the pages already on
  // screen (section 11.3).
  moreError: ApiRequestError | null;
  loadMore: () => void;
}

function asApiError(caught: unknown): ApiRequestError {
  return caught instanceof ApiRequestError
    ? caught
    : new ApiRequestError(0, 'unknown_error', 'Something went wrong.');
}

export function useRecipePages(filters: BrowseFilters): RecipePages {
  // Changing a filter starts a different result set, so pages already loaded
  // are discarded rather than concatenated onto a query they never came from.
  const key = browseQuery(filters).toString();

  const load = useCallback(
    (signal: AbortSignal) => browseRecipes(filters, null, signal),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
  const { data: page, error, loading, reload } = useApiResource(load, [key]);

  const [extra, setExtra] = useState<RecipeSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<ApiRequestError | null>(null);

  useEffect(() => {
    setExtra([]);
    setCursor(page?.nextCursor ?? null);
    setMoreError(null);
  }, [page]);

  const loadMore = useCallback(() => {
    if (!cursor || loadingMore) return;

    setLoadingMore(true);
    setMoreError(null);

    void browseRecipes(filters, cursor)
      .then((next) => {
        setExtra((current) => [...current, ...next.items]);
        setCursor(next.nextCursor);
      })
      .catch((caught: unknown) => setMoreError(asApiError(caught)))
      .finally(() => setLoadingMore(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, loadingMore, key]);

  return {
    recipes: page ? [...page.items, ...extra] : [],
    loading,
    error,
    reload,
    hasMore: cursor != null,
    loadingMore,
    moreError,
    loadMore,
  };
}
