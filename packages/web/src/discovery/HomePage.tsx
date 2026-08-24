import type { HomeSections, RecipeSummary } from '@cookbook/domain';
import { useCallback, useEffect, useRef } from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getHome } from '../api/discovery.js';
import { useApiResource } from '../api/hooks.js';
import { useAuth } from '../auth';
import { ButtonLink, PageHeader, SectionHeading, chipClass, focusRing } from '@/components/ui';
import { EmptyState, ErrorState } from '../recipes/states.js';
import { RecipeCard, RecipeCardSkeleton } from './RecipeCard.js';

// Visual discovery: what this household cooks, what the current user keeps
// coming back to, and a way into every category
// (technical design sections 11.1 and 11.2).

// A rail is wider than the page on purpose, and a card sliced dead straight at
// the container edge reads as a rendering fault rather than as "there is more
// this way". The mask softens whichever end still has cards behind it, so the
// fade is always telling the truth about what is off-screen. The attribute is
// written straight to the node: this fires on every scroll frame and none of
// it is worth a re-render.
function useRailFade() {
  const ref = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const rail = ref.current;
    if (!rail) return;

    const update = () => {
      const remaining = rail.scrollWidth - rail.clientWidth - rail.scrollLeft;
      // A sub-pixel container width leaves a fraction of a pixel unscrolled at
      // either end, which would fade an edge that has nothing behind it.
      const atStart = rail.scrollLeft <= 1;
      const atEnd = remaining <= 1;

      rail.dataset.fade = atStart && atEnd ? 'none' : atStart ? 'end' : atEnd ? 'start' : 'both';
    };

    update();
    rail.addEventListener('scroll', update, { passive: true });

    // Cards arriving, the window resizing, and the sidebar collapsing all
    // change what overflows without a scroll event.
    const observer = new ResizeObserver(update);
    observer.observe(rail);

    return () => {
      rail.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, []);

  return ref;
}

// A rail renders only when it has something in it. An empty "Your favorites"
// strip teaches a cook nothing and pushes the real content down the page.
function Rail({
  title,
  sub,
  recipes,
  browseTo,
}: {
  title: string;
  sub: string;
  recipes: RecipeSummary[];
  browseTo?: string;
}) {
  const railRef = useRailFade();

  if (recipes.length === 0) return null;

  const headingId = `rail-${title.toLowerCase().replace(/[^a-z]+/g, '-')}`;

  return (
    <section aria-labelledby={headingId}>
      <div className="mb-4 flex items-end justify-between gap-4 px-0.5">
        <SectionHeading id={headingId} sub={sub}>
          {title}
        </SectionHeading>
        {browseTo ? (
          <Link
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-1 py-1 font-serif text-[15px] italic text-ink-2 transition-colors hover:text-ink ${focusRing}`}
            to={browseTo}
          >
            See all
            <ArrowRight aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
          </Link>
        ) : null}
      </div>

      {/* A rail scrolls sideways rather than wrapping: it is a glance along a
          shelf, not a full result set. The negative margin lets a card run to
          the edge of a phone screen while the heading stays aligned, and
          `scroll-px` keeps the snap points on the padding rather than on the
          bleed - without it the first card snaps flush to the screen edge and
          sits a margin's width left of its own heading. */}
      <ul
        className="cb-rail -mx-4 flex snap-x snap-mandatory list-none gap-4 overflow-x-auto scroll-px-4 px-4 pt-1 pb-3 [scrollbar-width:none] sm:gap-5 md:mx-0 md:scroll-px-0 md:px-0 [&::-webkit-scrollbar]:hidden"
        ref={railRef}
      >
        {recipes.map((recipe) => (
          <RecipeCard
            className="w-[248px] shrink-0 snap-start sm:w-[268px]"
            key={recipe.id}
            recipe={recipe}
          />
        ))}
      </ul>
    </section>
  );
}

function CategoryRow({ categories }: { categories: HomeSections['categories'] }) {
  // A category nobody has filed anything under is a valid choice in the recipe
  // form but a dead end here, so it stays out of the browse shortcuts.
  const used = categories.filter((category) => category.activeRecipeCount > 0);
  if (used.length === 0) return null;

  return (
    <section aria-labelledby="home-categories">
      <SectionHeading className="mb-4 px-0.5" id="home-categories" sub="Everything, filed">
        Browse by category
      </SectionHeading>

      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {used.map((category) => (
          <li key={category.id}>
            <Link className={chipClass(false, 'min-h-10 px-4 text-sm')} to={`/recipes?categoryId=${category.id}`}>
              {category.name}
              <span className="font-serif text-[13px] italic text-ink-3">
                {category.activeRecipeCount}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function HomePage() {
  const { user } = useAuth();
  const load = useCallback((signal: AbortSignal) => getHome(signal), []);
  const { data: home, error, loading, reload } = useApiResource(load, []);

  const firstName = user?.name.split(' ')[0] ?? 'cook';

  return (
    <div className="cb-rise flex min-w-0 flex-col gap-9">
      <PageHeader
        title={
          <>
            Welcome, <em className="font-light text-accent">{firstName}</em>.
          </>
        }
        lede="What this house cooks, and what you keep coming back to."
      />

      {loading ? (
        <RecipeCardSkeleton label="Loading your cookbook…" />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : home && home.recentlyAdded.length === 0 ? (
        <EmptyState
          title="Nothing on the shelf yet."
          body="Add the first recipe and this page fills up with it."
        >
          <ButtonLink to="/recipes/new" variant="primary">
            Add a recipe
          </ButtonLink>
        </EmptyState>
      ) : home ? (
        <>
          <Rail
            title="Jump back in"
            sub="Where you left off"
            recipes={home.recentlyViewed}
            browseTo="/recent"
          />
          <Rail
            title="Your favorites"
            sub="Yours alone"
            recipes={home.favorites}
            browseTo="/favorites"
          />
          <Rail
            title="Loved in this house"
            sub="Rated by everyone here"
            recipes={home.highlyRated}
            browseTo="/recipes?sort=rating"
          />
          <Rail
            title="Recently added"
            sub="Newest first"
            recipes={home.recentlyAdded}
            browseTo="/recipes"
          />
          <CategoryRow categories={home.categories} />
        </>
      ) : null}
    </div>
  );
}
