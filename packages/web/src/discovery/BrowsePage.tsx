import { RECIPE_SORTS, type RecipeSort } from '@cookbook/domain';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Heart, Search } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { browseQuery, EMPTY_FILTERS, isFiltered, type BrowseFilters } from '../api/discovery.js';
import { useOrganization } from '../recipes/useRecipeEditor.js';
import {
  FieldHint,
  FieldLabel,
  PageHeader,
  Panel,
  Select,
  chipClass,
  focusRing,
} from '@/components/ui';
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

// Each filter row carries its own label, so the meaning of a pill is never
// only in the pill.
function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="mb-2 p-0 text-[13px] font-medium text-ink-2">{label}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
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
    <div className="cb-rise flex min-w-0 flex-col gap-7">
      <PageHeader title="Browse" lede="Everything on the shelf, narrowed down however you like." />

      <Panel className="p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <form className="min-w-0" role="search" onSubmit={(event) => event.preventDefault()}>
            <FieldLabel className="mb-1.5" htmlFor="browse-q">
              Search recipes
            </FieldLabel>
            <span className="relative block">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-ink-3"
                strokeWidth={2.1}
              />
              <input
                className={`min-h-11 w-full rounded-2xl border border-frost/80 bg-[rgba(var(--surface-rgb),0.92)] py-2.5 pr-4 pl-10 text-[15px] text-ink shadow-[inset_0_0_0_1px_rgba(var(--frost-rgb),0.5)] transition-[border-color,box-shadow] duration-200 placeholder:text-ink-3 focus:border-accent/45 focus:shadow-[var(--cb-focus-shadow)] focus:outline-none ${focusRing}`}
                id="browse-q"
                type="search"
                value={queryText}
                placeholder="Name, ingredient, tag…"
                onChange={(event) => setQueryText(event.target.value)}
              />
            </span>
          </form>

          <div className="min-w-0">
            <FieldLabel className="mb-1.5" htmlFor="browse-category">
              Category
            </FieldLabel>
            <Select
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
            </Select>
          </div>

          <div className="min-w-0">
            <FieldLabel className="mb-1.5" htmlFor="browse-sort">
              Sort
            </FieldLabel>
            <Select
              id="browse-sort"
              value={filters.sort}
              onChange={(event) => update({ sort: event.target.value as RecipeSort })}
            >
              {RECIPE_SORTS.map((sort) => (
                <option key={sort} value={sort}>
                  {SORT_LABELS[sort]}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-start gap-x-8 gap-y-4 border-t border-dashed border-ink/10 pt-4">
          <FilterGroup label="Ready in">
            {TIME_CHOICES.map((minutes) => (
              <button
                className={chipClass(filters.maxTotalMinutes === minutes)}
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
          </FilterGroup>

          {/* The rating filter reads the household average, not the cook's own
              rating: "what does this house think is good". */}
          <FilterGroup label="Rated at least">
            {RATING_CHOICES.map((stars) => (
              <button
                className={chipClass(filters.minRating === stars)}
                key={stars}
                type="button"
                aria-pressed={filters.minRating === stars}
                onClick={() => update({ minRating: filters.minRating === stars ? null : stars })}
              >
                {stars}★
              </button>
            ))}
          </FilterGroup>

          <FilterGroup label="Mine">
            <button
              className={chipClass(filters.favorite)}
              type="button"
              aria-pressed={filters.favorite}
              onClick={() => update({ favorite: !filters.favorite })}
            >
              <Heart
                aria-hidden="true"
                className={`h-3.5 w-3.5 ${filters.favorite ? 'fill-current' : ''}`}
                strokeWidth={2}
              />
              My favorites
            </button>
          </FilterGroup>
        </div>

        {organization.tags.length > 0 ? (
          <fieldset className="m-0 mt-4 border-0 border-t border-dashed border-ink/10 p-0 pt-4">
            <legend className="mb-1 p-0 text-[13px] font-medium text-ink-2">Tags</legend>
            <FieldHint>A recipe must carry every tag you pick.</FieldHint>
            <ul className="m-0 mt-2.5 flex list-none flex-wrap gap-2 p-0">
              {organization.tags.map((tag) => (
                <li key={tag.id}>
                  <button
                    className={chipClass(filters.tagIds.includes(tag.id))}
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
      </Panel>

      <RecipeResults
        pages={pages}
        filtered={isFiltered(filters)}
        loadingLabel="Searching recipes…"
        onClearFilters={clearFilters}
      />
    </div>
  );
}
