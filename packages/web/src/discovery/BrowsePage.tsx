import { RECIPE_SORTS, type RecipeSort, type RecipeSummary } from '@cookbook/domain';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiRequestError } from '../api/client.js';
import {
  browseRecipes,
  browseQuery,
  EMPTY_FILTERS,
  isFiltered,
  type BrowseFilters,
} from '../api/discovery.js';
import { useApiResource } from '../api/hooks.js';
import { AppShell } from '../AppShell.js';
import { useOrganization } from '../recipes/useRecipeEditor.js';
import { ErrorState } from '../recipes/states.js';
import { RecipeCardGrid, RecipeCardSkeleton } from './RecipeCard.js';

// Search, filter, sort, and browse (technical design sections 9 and 11.1).
// The URL is the source of truth for the query, so a filtered view can be
// shared, bookmarked, and restored by the back button.

const SORT_LABELS: Record<RecipeSort, string> = {
  recentlyAdded: 'Newest',
  recentlyUpdated: 'Recently updated',
  name: 'A–Z',
  rating: 'Top rated',
};

// The time filter is a small set of choices rather than a free number: a cook
// asks "what can I make in half an hour", not "in 37 minutes".
const TIME_CHOICES = [15, 30, 60] as const;

function readFilters(params: URLSearchParams): BrowseFilters {
  const sort = params.get('sort');
  const categoryId = Number(params.get('categoryId'));
  const maxTotalMinutes = Number(params.get('maxTotalMinutes'));

  return {
    q: params.get('q') ?? '',
    categoryId: Number.isSafeInteger(categoryId) && categoryId > 0 ? categoryId : null,
    tagIds: params
      .getAll('tagId')
      .map(Number)
      .filter((id) => Number.isSafeInteger(id) && id > 0),
    maxTotalMinutes:
      Number.isSafeInteger(maxTotalMinutes) && maxTotalMinutes > 0 ? maxTotalMinutes : null,
    sort: (RECIPE_SORTS as readonly string[]).includes(sort ?? '')
      ? (sort as RecipeSort)
      : 'recentlyAdded',
  };
}

function resultLabel(count: number, more: boolean): string {
  if (count === 0) return 'No recipes';
  const suffix = count === 1 ? '1 recipe' : `${count} recipes`;
  return more ? `${suffix} so far` : suffix;
}

// Typing must not fire a request per keystroke, but the URL must still end up
// carrying whatever was typed so the view stays shareable.
function useDebounced<T>(value: T, delay: number): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return settled;
}

export function BrowsePage() {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => readFilters(params), [params]);
  const organization = useOrganization();

  // The text box is local state so it stays responsive; the URL catches up
  // once typing pauses.
  const [queryText, setQueryText] = useState(filters.q);
  const debouncedQuery = useDebounced(queryText, 300);

  const applied = useRef(filters.q);

  // The URL can also change without the box: the back button, or a link from
  // home. The box follows it, so what a cook reads always matches the results.
  useEffect(() => {
    if (filters.q === applied.current) return;
    applied.current = filters.q;
    setQueryText(filters.q);
  }, [filters.q]);

  useEffect(() => {
    if (debouncedQuery === applied.current) return;
    applied.current = debouncedQuery;
    setParams(browseQuery({ ...filters, q: debouncedQuery }), { replace: true });
    // `filters` is derived from the params this effect writes; depending on it
    // would re-run the effect for every unrelated filter change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery]);

  // A filter change starts a new result set, so any pages already loaded past
  // the first are discarded rather than concatenated onto a different query.
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

  const update = (change: Partial<BrowseFilters>) => {
    const next = { ...filters, ...change };
    if (change.q !== undefined) {
      setQueryText(change.q);
      applied.current = change.q;
    }
    setParams(browseQuery(next));
  };

  const toggleTag = (tagId: number) => {
    update({
      tagIds: filters.tagIds.includes(tagId)
        ? filters.tagIds.filter((id) => id !== tagId)
        : [...filters.tagIds, tagId],
    });
  };

  const loadMore = async () => {
    if (!cursor) return;

    setLoadingMore(true);
    setMoreError(null);

    try {
      const next = await browseRecipes(filters, cursor);
      setExtra((current) => [...current, ...next.items]);
      setCursor(next.nextCursor);
    } catch (caught) {
      setMoreError(
        caught instanceof ApiRequestError
          ? caught
          : new ApiRequestError(0, 'unknown_error', 'Something went wrong.'),
      );
    } finally {
      setLoadingMore(false);
    }
  };

  const recipes = page ? [...page.items, ...extra] : [];
  const filtered = isFiltered(filters);

  return (
    <AppShell>
      <main className="rc-page">
        <h1 className="rc-page__title">Browse</h1>

        <form className="rc-search" role="search" onSubmit={(event) => event.preventDefault()}>
          <label className="rc-field__label" htmlFor="browse-q">
            Search recipes
          </label>
          <input
            className="rc-input"
            id="browse-q"
            type="search"
            value={queryText}
            placeholder="Name, ingredient, tag…"
            onChange={(event) => setQueryText(event.target.value)}
          />
        </form>

        <div className="rc-filters">
          <div className="rc-filters__group">
            <label className="rc-field__label" htmlFor="browse-category">
              Category
            </label>
            <select
              className="rc-input rc-input--select"
              id="browse-category"
              value={filters.categoryId ?? ''}
              onChange={(event) =>
                update({ categoryId: event.target.value ? Number(event.target.value) : null })
              }
            >
              <option value="">All categories</option>
              {organization.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="rc-filters__group">
            <label className="rc-field__label" htmlFor="browse-sort">
              Sort
            </label>
            <select
              className="rc-input rc-input--select"
              id="browse-sort"
              value={filters.sort}
              onChange={(event) => update({ sort: event.target.value as RecipeSort })}
            >
              {RECIPE_SORTS.map((sort) => (
                <option key={sort} value={sort}>
                  {SORT_LABELS[sort]}
                </option>
              ))}
            </select>
          </div>

          <fieldset className="rc-filters__group">
            <legend className="rc-field__label">Ready in</legend>
            <div className="rc-filters__choices">
              {TIME_CHOICES.map((minutes) => (
                <button
                  className={`rc-chip rc-chip--button${
                    filters.maxTotalMinutes === minutes ? ' rc-chip--on' : ''
                  }`}
                  key={minutes}
                  type="button"
                  aria-pressed={filters.maxTotalMinutes === minutes}
                  onClick={() =>
                    update({ maxTotalMinutes: filters.maxTotalMinutes === minutes ? null : minutes })
                  }
                >
                  {minutes} min or less
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        {organization.tags.length > 0 ? (
          <fieldset className="rc-filters__tags">
            <legend className="rc-field__label">Tags</legend>
            <p className="rc-field__hint">A recipe must carry every tag you pick.</p>
            <ul className="rc-tag-list">
              {organization.tags.map((tag) => (
                <li key={tag.id}>
                  <button
                    className={`rc-chip rc-chip--button${
                      filters.tagIds.includes(tag.id) ? ' rc-chip--on' : ''
                    }`}
                    type="button"
                    aria-pressed={filters.tagIds.includes(tag.id)}
                    onClick={() => toggleTag(tag.id)}
                  >
                    {tag.name}
                  </button>
                </li>
              ))}
            </ul>
          </fieldset>
        ) : null}

        <div className="rc-results__bar">
          <p className="rc-results__count" role="status">
            {loading ? 'Searching…' : resultLabel(recipes.length, cursor != null)}
          </p>
          {filtered ? (
            <button
              className="rc-button rc-button--ghost rc-button--small"
              type="button"
              onClick={() => update({ ...EMPTY_FILTERS, sort: filters.sort })}
            >
              Clear filters
            </button>
          ) : null}
        </div>

        {loading ? (
          <RecipeCardSkeleton label="Searching recipes…" />
        ) : error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : recipes.length === 0 ? (
          // The query stays in the box: a cook refines a search, they do not
          // start it over (section 11.3).
          <div className="rc-state">
            <p className="rc-state__title">
              {filtered ? 'Nothing matches that yet.' : 'No recipes yet.'}
            </p>
            <p className="rc-state__body">
              {filtered
                ? 'Try fewer filters or a different word.'
                : 'Add the first one and it will show up here.'}
            </p>
            <div className="rc-state__actions">
              {filtered ? (
                <button
                  className="rc-button rc-button--primary"
                  type="button"
                  onClick={() => update({ ...EMPTY_FILTERS, sort: filters.sort })}
                >
                  Clear filters
                </button>
              ) : (
                <Link className="rc-button rc-button--primary" to="/recipes/new">
                  Add a recipe
                </Link>
              )}
            </div>
          </div>
        ) : (
          <>
            <RecipeCardGrid recipes={recipes} />

            {moreError ? (
              <p className="rc-form__banner" role="alert">
                {moreError.message}
              </p>
            ) : null}

            {cursor ? (
              <div className="rc-results__more">
                <button
                  className="rc-button rc-button--ghost"
                  type="button"
                  disabled={loadingMore}
                  onClick={() => void loadMore()}
                >
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              </div>
            ) : null}
          </>
        )}
      </main>
    </AppShell>
  );
}
