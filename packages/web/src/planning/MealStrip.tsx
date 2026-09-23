import { Link } from 'react-router-dom';
import type { MealPlanItem } from '@cookbook/domain';
import { cn } from '@/lib/utils';
import { focusRing } from '@/components/ui';
import { toneFor } from '../discovery/RecipeCard.js';

// The meals of a saved plan, small. Once a plan is saved the list is what the
// page is for, so the meals step back to a strip above it: enough to see what
// the week is and open a recipe to cook from, without the full cards pushing
// the list off a phone screen.

// Also drawn by the suggestions dialog, so a suggested dish looks exactly like
// a planned one.
export function Thumb({
  item,
}: {
  item: Pick<MealPlanItem, 'recipeId' | 'recipeName' | 'hasImage'>;
}) {
  return (
    <span className="relative block h-13 w-13 shrink-0 overflow-hidden rounded-2xl border border-frost/80">
      {item.hasImage && item.recipeId != null ? (
        <img
          className="h-full w-full object-cover"
          src={`/api/recipes/${item.recipeId}/photo/card`}
          alt=""
          loading="lazy"
        />
      ) : (
        <span
          className={cn(
            'grid h-full w-full place-items-center font-serif text-[22px] italic text-ink/25',
            toneFor(item.recipeId ?? 0),
          )}
        >
          {item.recipeName.trim()[0]?.toUpperCase() ?? '?'}
        </span>
      )}
    </span>
  );
}

export function MealStrip({ items }: { items: MealPlanItem[] }) {
  return (
    <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-2.5 p-0">
      {items.map((item) => {
        const body = (
          <>
            <Thumb item={item} />
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-serif text-[16px] leading-tight text-ink">
                {item.recipeName}
              </span>
              <span className="text-[12.5px] text-ink-2">
                {item.unavailable ? 'No longer in the cookbook' : `${item.servings} servings`}
              </span>
            </span>
          </>
        );
        const row =
          'flex items-center gap-3 rounded-[20px] border border-frost/80 bg-[rgba(var(--surface-rgb),0.7)] p-2 pr-4';
        return (
          <li key={item.id}>
            {item.unavailable || item.recipeId == null ? (
              <div className={row}>{body}</div>
            ) : (
              <Link
                className={cn(row, 'transition-colors hover:bg-[rgba(var(--surface-rgb),0.95)]', focusRing)}
                to={`/recipes/${item.recipeId}`}
              >
                {body}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
