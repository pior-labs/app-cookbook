import { RECIPE_SORTS, type RecipeSort } from '@cookbook/domain';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { browseQuery, EMPTY_FILTERS, isFiltered, type BrowseFilters } from '../api/discovery.js';
import { AppShell } from '../AppShell.js';
import { useOrganization } from '../recipes/useRecipeEditor.js';
import { RecipeResults } from './RecipeResults.jsx';
import { useRecipePages } from './useRecipePages.js';

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
const RATING_CHOICES = [3, 4, 5] as const;

function positiveInt(value: string | null): number | null {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function readFilters(params: URLSearchParams): BrowseFilters {
  const sort = params.get('sort');
  const minRating = positiveInt(params.get('minRating'));

  return {
    q: params.get('q') ?? '',
    categoryId: positiveInt(params.get('categoryId')),
    tagIds: params
      .getAll('tagId')
      .map((value) => positiveInt(value))
      .filter((id): id is number => id != null),
    favorite: params.get('favorite') === 'true',
    minRating: minRating != null && minRating <= 5 ? minRating : null,
    maxTotalMinutes: positiveInt(params.get('maxTotalMinutes')),
    sort: (RECIPE_SORTS as readonly string[]).includes(sort ?? '')
      ? (sort as RecipeSort)
      : 'recentlyAdded',
  };
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

  const pages = useRecipePages(filters);

  const update = (change: Partial<BrowseFilters>) => {
    if (change.q !== undefined) {
      setQueryText(change.q);
      applied.current = change.q;
    }
    setParams(browseQuery({ ...filters, ...change }));
  };

  // Clearing keeps the sort: reordering the same results is not a filter, and
  // losing the chosen order would be a surprise.
  const clearFilters = () => update({ ...EMPTY_FILTERS, sort: filters.sort });

  const toggleTag = (tagId: number) => {
    update({
      tagIds: filters.tagIds.includes(tagId)
        ? filters.tagIds.filter((id) => id !== tagId)
        : [...filters.tagIds, tagId],
    });
  };

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
                    update({
                      maxTotalMinutes: filters.maxTotalMinutes === minutes ? null : minutes,
                    })
                  }
                >
                  {minutes} min or less
                </button>
              ))}
            </div>
          </fieldset>

          {/* The rating filter reads the household average, not the cook's own
              rating: "what does this house think is good". */}
          <fieldset className="rc-filters__group">
            <legend className="rc-field__label">Rated at least</legend>
            <div className="rc-filters__choices">
              {RATING_CHOICES.map((stars) => (
                <button
                  className={`rc-chip rc-chip--button${
                    filters.minRating === stars ? ' rc-chip--on' : ''
                  }`}
                  key={stars}
                  type="button"
                  aria-pressed={filters.minRating === stars}
                  onClick={() => update({ minRating: filters.minRating === stars ? null : stars })}
                >
                  {stars}★
                </button>
              ))}
            </div>
          </fieldset>

          <div className="rc-filters__group rc-filters__group--inline">
            <button
              className={`rc-chip rc-chip--button${filters.favorite ? ' rc-chip--on' : ''}`}
              type="button"
              aria-pressed={filters.favorite}
              onClick={() => update({ favorite: !filters.favorite })}
            >
              ♥ My favorites
            </button>
          </div>
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

        <RecipeResults
          pages={pages}
          filtered={isFiltered(filters)}
          loadingLabel="Searching recipes…"
          onClearFilters={clearFilters}
        />
      </main>
    </AppShell>
  );
}
