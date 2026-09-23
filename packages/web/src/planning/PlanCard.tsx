import { Link } from 'react-router-dom';
import type { MealPlan, MealPlanItem } from '@cookbook/domain';
import { cn } from '@/lib/utils';
import { Eyebrow, focusRing, MenuDivider, MenuItem, OverflowMenu } from '@/components/ui';
import { CARD_FRAME, toneFor } from '../discovery/RecipeCard.js';

// A plan is the meals in it, so the card is the meals in it. The list endpoint
// already returns every plan with its items, so the mosaic costs nothing it was
// not already fetching.
//
// Four tiles at most. A fifth photograph at this size is a texture rather than
// a dish, and the count below already says how many there are.
const MOSAIC_LIMIT = 4;

function Tile({ item, solo }: { item: MealPlanItem; solo: boolean }) {
  if (item.hasImage && item.recipeId != null)
    return (
      <img
        className="h-full w-full object-cover"
        src={`/api/recipes/${item.recipeId}/photo/card`}
        alt=""
        loading="lazy"
      />
    );

  // The same wash and initial an unphotographed recipe wears in browse, so a
  // dish is recognisable by its colour wherever it turns up. The initial sits
  // above the caption panel, and shrinks in a slice too narrow to hold it.
  return (
    <span className={cn('grid h-full w-full place-items-center', toneFor(item.recipeId ?? 0))}>
      <span
        className={cn(
          'pb-14 font-serif leading-none italic text-ink/15',
          solo ? 'text-[92px]' : 'text-[40px]',
        )}
      >
        {item.recipeName.trim()[0]?.toUpperCase() ?? '?'}
      </span>
    </span>
  );
}

// The meals as vertical slices, so the number of stripes is the size of the
// plan before a word of it is read. Slices rather than a grid because the
// caption panel covers the bottom of the card: the lower half of a 2x2 would
// never be seen, while every slice stays visible above it.
function Mosaic({ items }: { items: MealPlanItem[] }) {
  const shown = items.slice(0, MOSAIC_LIMIT);

  if (!shown.length)
    return (
      <span
        aria-hidden="true"
        className="grid h-full w-full place-items-center bg-[var(--cb-muted-track)]"
      >
        <span className="pb-14 font-serif text-[15px] italic text-ink-3">Nothing planned yet</span>
      </span>
    );

  return (
    <span
      aria-hidden="true"
      className="grid h-full w-full auto-cols-fr grid-flow-col gap-0.5"
    >
      {shown.map((item) => (
        <span key={item.id} className="overflow-hidden">
          <Tile item={item} solo={shown.length === 1} />
        </span>
      ))}
    </span>
  );
}

// What the plan is waiting for. Every value is read straight off the plan, so
// the label is never a guess: no meals, meals but no list, or a list that has
// been generated and is ready to shop from.
function stage(plan: MealPlan): string {
  if (!plan.items.length) return 'Empty';
  if (plan.groceryListIds.length) return 'List ready';
  return 'Planning';
}

function updatedLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'recently';

  const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((midnight(new Date()) - midnight(date)) / 86_400_000);

  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
}

export function PlanCard({
  plan,
  busy,
  onRename,
  onDelete,
}: {
  plan: MealPlan;
  busy?: boolean;
  onRename?: () => void;
  onDelete?: () => void;
}) {
  const servings = plan.items.reduce((sum, item) => sum + item.servings, 0);
  const meals = plan.items.length;

  return (
    <li className="group relative">
      {/* The whole card is the target. "Continue" was a button doing a link's
          job, next to a name that was not clickable at all. */}
      <Link className={cn(CARD_FRAME, focusRing)} to={`/meal-plans/${plan.id}`}>
        <Mosaic items={plan.items} />
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[color-mix(in_srgb,var(--ink)_34%,transparent)] to-transparent opacity-70"
        />
        <span className="absolute inset-x-2.5 bottom-2.5 block rounded-[18px] border border-frost/70 bg-[rgba(var(--surface-rgb),0.9)] px-3.5 py-3 shadow-[0_8px_20px_-10px_color-mix(in_srgb,var(--ink)_35%,transparent)] backdrop-blur-xl backdrop-saturate-150">
          <Eyebrow>{stage(plan)}</Eyebrow>
          <h3 className="mt-1 mb-0 line-clamp-1 font-serif text-[19px] leading-[1.2] font-medium tracking-[-0.01em] text-ink">
            {plan.name || 'Untitled meal plan'}
          </h3>
          <p className="mt-1.5 mb-0 text-[12.5px] text-ink-2">
            {meals ? (
              <>
                {meals} {meals === 1 ? 'meal' : 'meals'} · {servings} servings ·{' '}
              </>
            ) : null}
            <span className="text-ink-3">Updated {updatedLabel(plan.updatedAt)}</span>
          </p>
        </span>
      </Link>

      {/* A sibling of the link rather than a child, the same way the favorite
          heart is: a button inside a link is neither valid nor operable. A
          stale plan is noticed here, on the shelf, so this is where it can be
          cleared away. */}
      {onRename && onDelete ? (
        <div className="absolute top-3 right-3 z-1">
          <OverflowMenu
            label={`Options for ${plan.name || 'untitled meal plan'}`}
            disabled={busy}
            size="small"
          >
            <MenuItem onSelect={onRename}>Rename plan</MenuItem>
            <MenuDivider />
            <MenuItem tone="danger" onSelect={onDelete}>
              Delete plan
            </MenuItem>
          </OverflowMenu>
        </div>
      ) : null}
    </li>
  );
}
