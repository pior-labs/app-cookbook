import { RECIPE_SORTS, type RecipeSort } from '@cookbook/domain';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDownUp, Heart, Search, SlidersHorizontal, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { browseQuery, EMPTY_FILTERS, isFiltered, type BrowseFilters } from '../api/discovery.js';
import { useOrganization, type Organization } from '../recipes/useRecipeEditor.js';
import {
  Button,
  FieldHint,
  FieldLabel,
  PageHeader,
  Panel,
  Select,
  buttonClass,
  chipClass,
  focusRing,
} from '@/components/ui';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { useModalOverlay } from '@/lib/overlay';
import { RecipeResults } from './RecipeResults.jsx';
import { useRecipePages, type RecipePages } from './useRecipePages.js';

// Search, filter, sort, and browse (technical design sections 9 and 11.1).
// The URL is the source of truth for the query, so a filtered view can be
// shared, bookmarked, and restored by the back button.
//
// The screen leads with the results, not with the controls that narrow them.
// What stays on the page is the toolbar - search, sort, and a way in to the
// filters - and a line of chips naming whatever is currently narrowing the
// list. The filters themselves open on request: inline on a wide screen, and
// as a sheet over the page on a phone, where a permanently open panel was the
// whole first screen and the recipes were below it.

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

// The phone layout, matching the breakpoint the shell uses for its own rail.
const COMPACT_QUERY = '(max-width: 767px)';

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

// The query text is in the search box, in front of the cook, so it is not
// repeated as a chip and does not add to the count on the button. Everything
// else is out of sight once the filters are closed, and has to be named.
interface ActiveFilter {
  key: string;
  label: string;
  remove: () => void;
}

function activeFilters(
  filters: BrowseFilters,
  organization: Organization,
  update: (change: Partial<BrowseFilters>) => void,
): ActiveFilter[] {
  const active: ActiveFilter[] = [];

  const category = organization.categories.find((item) => item.id === filters.categoryId);
  if (category) {
    active.push({
      key: 'category',
      label: category.name,
      remove: () => update({ categoryId: null }),
    });
  }

  if (filters.maxTotalMinutes != null) {
    active.push({
      key: 'time',
      label: `${filters.maxTotalMinutes} min or less`,
      remove: () => update({ maxTotalMinutes: null }),
    });
  }

  if (filters.minRating != null) {
    active.push({
      key: 'rating',
      label: `${filters.minRating}★ and up`,
      remove: () => update({ minRating: null }),
    });
  }

  if (filters.favorite) {
    active.push({ key: 'favorite', label: 'My favorites', remove: () => update({ favorite: false }) });
  }

  for (const tagId of filters.tagIds) {
    const tag = organization.tags.find((item) => item.id === tagId);
    if (!tag) continue;
    active.push({
      key: `tag-${tagId}`,
      label: tag.name,
      remove: () => update({ tagIds: filters.tagIds.filter((id) => id !== tagId) }),
    });
  }

  return active;
}

// The count on the button is of filters applied, not of chips drawn: a tag
// whose name has not loaded yet is still narrowing the results.
function countFilters(filters: BrowseFilters): number {
  return (
    (filters.categoryId != null ? 1 : 0) +
    (filters.maxTotalMinutes != null ? 1 : 0) +
    (filters.minRating != null ? 1 : 0) +
    (filters.favorite ? 1 : 0) +
    filters.tagIds.length
  );
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
  const compact = useMediaQuery(COMPACT_QUERY);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersTriggerRef = useRef<HTMLButtonElement>(null);

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

  const active = activeFilters(filters, organization, update);
  const filterCount = countFilters(filters);

  const fields = (
    <FilterFields
      filters={filters}
      organization={organization}
      update={update}
      toggleTag={toggleTag}
    />
  );

  return (
    <div className="cb-rise flex min-w-0 flex-col gap-7">
      <PageHeader title="Browse" lede="Everything on the shelf, narrowed down however you like." />

      <Panel className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2.5">
          <form className="min-w-0 flex-[1_1_16rem]" role="search" onSubmit={(event) => event.preventDefault()}>
            <FieldLabel className="sr-only" htmlFor="browse-q">
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

          {/* Sort sits next to search rather than inside the filters: it never
              removes a recipe from the list, so it does not belong with the
              controls that do. */}
          <div className="min-w-0 flex-[1_1_9rem] sm:max-w-46">
            <FieldLabel className="sr-only" htmlFor="browse-sort">
              Sort
            </FieldLabel>
            <span className="relative block">
              <ArrowDownUp
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3.5 z-1 h-4 w-4 -translate-y-1/2 text-ink-3"
                strokeWidth={2.1}
              />
              <Select
                className="pl-10"
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
            </span>
          </div>

          <button
            ref={filtersTriggerRef}
            type="button"
            aria-expanded={filtersOpen}
            // The badge is a glyph; the count it stands for has to be in the
            // name of the control for anyone not reading it.
            aria-label={filterCount > 0 ? `Filters, ${filterCount} applied` : undefined}
            aria-controls="browse-filters"
            onClick={() => setFiltersOpen((open) => !open)}
            className={buttonClass(
              filtersOpen || filterCount > 0 ? 'primary' : 'ghost',
              'default',
              'shrink-0',
            )}
          >
            <SlidersHorizontal aria-hidden="true" className="h-4 w-4" strokeWidth={2.1} />
            Filters
            {filterCount > 0 ? (
              <span
                aria-hidden="true"
                className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-cream/20 px-1.5 text-[12px] font-semibold"
              >
                {filterCount}
              </span>
            ) : null}
          </button>
        </div>

        {/* Closed filters must not hide what they are doing: every narrowing
            in force is named here, and each chip is the way to lift it. */}
        {active.length > 0 ? (
          <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-dashed border-ink/10 pt-3.5">
            <span className="mr-0.5 font-serif text-[13px] italic text-ink-3">Narrowed to</span>
            {active.map((filter) => (
              <button
                className={chipClass(true, 'pr-2.5')}
                key={filter.key}
                type="button"
                aria-label={`Remove filter: ${filter.label}`}
                onClick={filter.remove}
              >
                {filter.label}
                <X aria-hidden="true" className="h-3.5 w-3.5 opacity-70" strokeWidth={2.4} />
              </button>
            ))}
            <Button className="ml-auto" size="small" variant="quiet" onClick={clearFilters}>
              Clear all
            </Button>
          </div>
        ) : null}

        {filtersOpen && !compact ? (
          <div className="mt-4 border-t border-dashed border-ink/10 pt-4" id="browse-filters">
            {fields}
          </div>
        ) : null}
      </Panel>

      {filtersOpen && compact ? (
        <FilterSheet
          pages={pages}
          filtered={isFiltered(filters)}
          triggerRef={filtersTriggerRef}
          onClear={clearFilters}
          onClose={() => setFiltersOpen(false)}
        >
          {fields}
        </FilterSheet>
      ) : null}

      <RecipeResults
        pages={pages}
        filtered={isFiltered(filters)}
        loadingLabel="Searching recipes…"
        onClearFilters={clearFilters}
      />
    </div>
  );
}

// The filters themselves. One instance, in whichever container the viewport
// calls for, so the sheet and the inline panel can never offer different
// controls.
function FilterFields({
  filters,
  organization,
  update,
  toggleTag,
}: {
  filters: BrowseFilters;
  organization: Organization;
  update: (change: Partial<BrowseFilters>) => void;
  toggleTag: (tagId: number) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="min-w-0 sm:max-w-72">
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

      <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
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
        <fieldset className="m-0 border-0 border-t border-dashed border-ink/10 p-0 pt-4">
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
    </div>
  );
}

// How many recipes are behind the sheet right now. The count is the reason the
// sheet can stay open while filters are tapped: the answer moves as they are.
function showLabel(pages: RecipePages): string {
  if (pages.loading || pages.items.length === 0) return 'Show results';
  const count = `${pages.items.length}${pages.hasMore ? '+' : ''}`;
  return `Show ${count} ${pages.items.length === 1 && !pages.hasMore ? 'recipe' : 'recipes'}`;
}

// On a phone the filters are a sheet over the results rather than a panel
// above them: it opens when it is asked for, it scrolls on its own, and the
// page behind it keeps its place. It is portalled out of the page column
// because the glass and the entrance animation up there both create a
// containing block that `fixed` would otherwise be measured against.
function FilterSheet({
  pages,
  filtered,
  triggerRef,
  onClear,
  onClose,
  children,
}: {
  pages: RecipePages;
  filtered: boolean;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  onClear: () => void;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  useModalOverlay({ open: true, dialogRef: sheetRef, triggerRef, onClose });

  return createPortal(
    <div className="fixed inset-0 z-50 md:hidden">
      {/* The page behind the sheet is still the way out of it, so a tap on it
          closes. The trap keeps focus off this, and the header carries the
          keyboard's own close. */}
      <div
        aria-hidden="true"
        className="cb-scrim-anim absolute inset-0 bg-[color-mix(in_srgb,var(--ink)_34%,transparent)] backdrop-blur-[3px] motion-reduce:animate-none"
        onClick={onClose}
      />

      <div
        ref={sheetRef}
        aria-labelledby="browse-filters-title"
        aria-modal="true"
        className="cb-sheet-anim absolute inset-x-0 bottom-0 flex max-h-[86dvh] flex-col rounded-t-[28px] border-t border-frost/80 bg-[rgba(var(--surface-rgb),0.97)] shadow-[0_-22px_60px_-24px_color-mix(in_srgb,var(--ink)_55%,transparent)] backdrop-blur-xl motion-reduce:animate-none"
        id="browse-filters"
        role="dialog"
        tabIndex={-1}
      >
        <span aria-hidden="true" className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-ink/15" />

        <div className="flex items-center justify-between gap-3 px-5 pt-3 pb-3">
          <h2
            className="m-0 font-serif text-[22px] leading-none font-normal tracking-[-0.02em] text-ink"
            id="browse-filters-title"
          >
            Filters
          </h2>
          <button
            aria-label="Close filters"
            className={`inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-2xl border border-ink/10 bg-frost/60 p-0 text-ink transition-colors hover:bg-frost/85 ${focusRing}`}
            data-overlay-autofocus="true"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>

        <div className="flex items-center gap-3 border-t border-dashed border-ink/12 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button disabled={!filtered} onClick={onClear} size="small" variant="quiet">
            Clear all
          </Button>
          <Button className="flex-1" onClick={onClose} variant="primary">
            {showLabel(pages)}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
