import { useCallback, useEffect, useState } from 'react';
import { ApiRequestError } from './client.js';
import { useApiResource } from './hooks.js';

// Cursor pagination for any list the API pages: browse, favorites, and Trash
// all count, empty out, extend, and recover from a failed extension in exactly
// the same way (technical design sections 7.2 and 11.3). Only what is being
// listed differs.

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export interface CursorPages<T> {
  items: T[];
  loading: boolean;
  error: ApiRequestError | null;
  reload: () => void;
  // False once the last page has been reached.
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

// `key` identifies the result set. Changing it starts a different list, so
// pages already loaded are discarded rather than concatenated onto a query they
// never came from.
export function useCursorPages<T>(
  key: string,
  loadPage: (cursor: string | null, signal?: AbortSignal) => Promise<CursorPage<T>>,
): CursorPages<T> {
  const load = useCallback(
    (signal: AbortSignal) => loadPage(null, signal),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
  const { data: page, error, loading, reload } = useApiResource(load, [key]);

  const [extra, setExtra] = useState<T[]>([]);
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

    void loadPage(cursor)
      .then((next) => {
        setExtra((current) => [...current, ...next.items]);
        setCursor(next.nextCursor);
      })
      .catch((caught: unknown) => setMoreError(asApiError(caught)))
      .finally(() => setLoadingMore(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, loadingMore, key]);

  return {
    items: page ? [...page.items, ...extra] : [],
    loading,
    error,
    reload,
    hasMore: cursor != null,
    loadingMore,
    moreError,
    loadMore,
  };
}
