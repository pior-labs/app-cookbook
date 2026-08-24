import type { RecipeSummary } from '@cookbook/domain';
import { Clock, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Eyebrow, focusRing } from '@/components/ui';
import { FavoriteButton } from '../preferences/controls.jsx';
import { useRecipePreferences } from '../preferences/usePreferences.js';

// The one recipe card. Home rails and browse results are the same summary
// shape, so they render through the same component and stay visually identical
// (technical design section 11.1).
//
// The photograph is the card. Everything else - category, name, time, rating -
// rides on a frosted panel across its base, because the reason to look at a
// page of recipes is the food.

export function timeLabel(recipe: RecipeSummary): string | null {
  if (recipe.totalMinutes == null || recipe.totalMinutes === 0) return null;
  if (recipe.totalMinutes < 60) return `${recipe.totalMinutes} min`;

  const hours = Math.floor(recipe.totalMinutes / 60);
  const rest = recipe.totalMinutes % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

// A recipe nobody has photographed still deserves an identity, so it gets one
// of the three accent washes and its own initial rather than a grey box. The
// wash is picked from the id, so a recipe keeps the same colour every time it
// is seen.
const TONES = ['tone-card-1', 'tone-card-2', 'tone-card-3'] as const;

export function toneFor(id: number): string {
  return TONES[Math.abs(id) % TONES.length];
}

const CARD_FRAME =
  'relative block aspect-[4/3] overflow-hidden rounded-[26px] border border-frost/80 ' +
  'shadow-[0_12px_36px_-12px_color-mix(in_srgb,var(--ink)_22%,transparent)] ' +
  'transition-[transform,box-shadow] duration-300 ease-out ' +
  'hover:-translate-y-0.5 hover:shadow-[0_20px_46px_-14px_color-mix(in_srgb,var(--ink)_30%,transparent)] ' +
  'motion-reduce:hover:translate-y-0';

export function RecipeCard({ recipe, className }: { recipe: RecipeSummary; className?: string }) {
  const time = timeLabel(recipe);
  const { average, count } = recipe.rating;
  const rated = average != null && count > 0;

  const preferences = useRecipePreferences(recipe.id, {
    userState: recipe.userState,
    rating: recipe.rating,
  });

  return (
    <li className={cn('group relative', className)}>
      <Link className={cn(CARD_FRAME, focusRing)} to={`/recipes/${recipe.id}`}>
        {recipe.hasImage ? (
          <img
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04] motion-reduce:group-hover:scale-100"
            src={`/api/recipes/${recipe.id}/photo/card`}
            alt=""
            loading="lazy"
          />
        ) : (
          <span className={cn('absolute inset-0 grid place-items-center', toneFor(recipe.id))} aria-hidden="true">
            <span className="pb-14 font-serif text-[92px] leading-none italic text-ink/15">
              {recipe.name.trim()[0]?.toUpperCase() ?? '?'}
            </span>
          </span>
        )}

        {/* Just enough shade at the top for the heart to read over a bright
            photograph. */}
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[color-mix(in_srgb,var(--ink)_34%,transparent)] to-transparent opacity-70"
        />

        <span className="absolute inset-x-2.5 bottom-2.5 block rounded-[18px] border border-frost/70 bg-[rgba(var(--surface-rgb),0.9)] px-3.5 py-3 shadow-[0_8px_20px_-10px_color-mix(in_srgb,var(--ink)_35%,transparent)] backdrop-blur-xl backdrop-saturate-150">
          <Eyebrow>{recipe.categoryName}</Eyebrow>
          <h3 className="mt-1 mb-0 line-clamp-2 font-serif text-[19px] leading-[1.2] font-medium tracking-[-0.01em] text-ink">
            {recipe.name}
          </h3>
          {time || rated ? (
            <p className="mt-1.5 mb-0 flex items-center gap-3 text-[12.5px] text-ink-2">
              {time ? (
                <span className="inline-flex items-center gap-1">
                  <Clock aria-hidden="true" className="h-3.5 w-3.5 text-ink-3" strokeWidth={2} />
                  {time}
                </span>
              ) : null}
              {rated ? (
                <span className="inline-flex items-center gap-1">
                  <Star aria-hidden="true" className="h-3.5 w-3.5 fill-accent text-accent" strokeWidth={0} />
                  {average.toFixed(1)}
                  <span className="text-ink-3">({count})</span>
                </span>
              ) : null}
            </p>
          ) : null}
        </span>
      </Link>

      {/* A sibling of the link rather than a child: a button inside a link is
          neither valid nor operable. */}
      <FavoriteButton
        name={recipe.name}
        favorite={preferences.userState.favorite}
        onToggle={preferences.toggleFavorite}
        size="small"
        className="absolute top-3 right-3 z-1"
      />

      {preferences.error ? (
        <p className="mt-2 px-1 text-[12.5px] text-[var(--cb-danger-ink-strong)]" role="alert">
          {preferences.error}
        </p>
      ) : null}
    </li>
  );
}

export function RecipeCardGrid({ recipes }: { recipes: RecipeSummary[] }) {
  return (
    <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-4 p-0 sm:gap-5">
      {recipes.map((recipe) => (
        <RecipeCard key={recipe.id} recipe={recipe} />
      ))}
    </ul>
  );
}

// A layout-preserving placeholder grid: the same card shape in the same
// columns, so results do not jump into place when they arrive (section 11.3).
export function RecipeCardSkeleton({ count = 6, label }: { count?: number; label: string }) {
  return (
    <ul
      className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-4 p-0 sm:gap-5"
      aria-busy="true"
      role="status"
    >
      <span className="sr-only">{label}</span>
      {Array.from({ length: count }, (_, index) => (
        <li className="relative" key={index} aria-hidden="true">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[26px] border border-frost/80 bg-[var(--cb-muted-track)]">
            <div className="absolute inset-x-2.5 bottom-2.5 rounded-[18px] border border-frost/70 bg-[rgba(var(--surface-rgb),0.75)] px-3.5 py-3">
              <div className="h-2 w-16 rounded-full bg-[var(--cb-muted-track)]" />
              <div className="mt-2.5 h-3.5 w-4/5 rounded-full bg-[var(--cb-muted-track)]" />
              <div className="mt-2 h-2.5 w-1/2 rounded-full bg-[var(--cb-muted-track)]" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
