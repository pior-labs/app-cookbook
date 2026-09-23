import { Link } from 'react-router-dom';
import { Clock, Minus, Plus } from 'lucide-react';
import type { MealPlanItem } from '@cookbook/domain';
import { cn } from '@/lib/utils';
import { Eyebrow, focusRing, MenuDivider, MenuItem, OverflowMenu } from '@/components/ui';
import { CARD_FRAME, CardPhoto, timeLabel } from '../discovery/RecipeCard.js';

// A planned meal is a dish, so it is drawn as the card a dish is drawn as
// everywhere else in the app - the same frame, the same photograph, the same
// frosted panel across its base. What differs is what rides under it: browse
// offers a heart, a plan offers the one number a plan is actually about.
//
// There is no "Meal 1 / Meal 2" label. A plan has an order the cook can
// change, but no days attached to it, so an ordinal would number the list
// without telling anyone anything - the same reason the navigation is not
// numbered either.

const MIN_SERVINGS = 1;
const MAX_SERVINGS = 100;

const STEP =
  'inline-grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full border border-ink/12 ' +
  'bg-frost/70 text-ink-2 transition-colors duration-200 hover:bg-frost hover:text-ink ' +
  'disabled:pointer-events-none disabled:opacity-40';

// Deliberately not `ServingControl`: that one scales a recipe being read, so it
// carries the base count and a reset, and it owns a fixed element id that would
// collide the moment a page showed two of them. This is the plan's own control
// and says the whole thing in one line a cook can read at a glance.
function MealServings({
  servings,
  name,
  disabled,
  onChange,
}: {
  servings: number;
  name: string;
  disabled: boolean;
  onChange: (servings: number) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-frost/80 bg-[rgba(var(--surface-rgb),0.7)] p-1 shadow-[inset_0_0_0_1px_rgba(var(--frost-rgb),0.5)]">
      <button
        type="button"
        className={cn(STEP, focusRing)}
        aria-label={`One fewer serving of ${name}`}
        disabled={disabled || servings <= MIN_SERVINGS}
        onClick={() => onChange(servings - 1)}
      >
        <Minus aria-hidden="true" className="h-4 w-4" strokeWidth={2.4} />
      </button>
      {/* Announced politely so the count reaching the server is what is heard,
          not every intermediate tap. */}
      <span
        className="min-w-[5.5rem] text-center font-serif text-[15px] text-ink tabular-nums"
        aria-live="polite"
      >
        {servings} servings
      </span>
      <button
        type="button"
        className={cn(STEP, focusRing)}
        aria-label={`One more serving of ${name}`}
        disabled={disabled || servings >= MAX_SERVINGS}
        onClick={() => onChange(servings + 1)}
      >
        <Plus aria-hidden="true" className="h-4 w-4" strokeWidth={2.4} />
      </button>
    </div>
  );
}

export interface MealActions {
  onChangeServings: (servings: number) => void;
  onChangeRecipe: () => void;
  onRemove: () => void;
  onMove: (position: number) => void;
}

// Changing, reordering and removing a meal are rare next to adjusting its
// servings, and four controls of equal weight under every card is a table of
// row actions rather than a shelf of food. They live behind one control, and
// the frequent one stays out in the open.
function MealMenu({
  name,
  index,
  count,
  disabled,
  actions,
}: {
  name: string;
  index: number;
  count: number;
  disabled: boolean;
  actions: MealActions;
}) {
  return (
    // Upward: the card sits in a grid, and a menu dropping below the last row
    // would open past the end of the page.
    <OverflowMenu label={`Actions for ${name}`} disabled={disabled} size="small" placement="top">
      <MenuItem onSelect={actions.onChangeRecipe}>Change recipe</MenuItem>
      <MenuItem disabled={index === 0} onSelect={() => actions.onMove(index - 1)}>
        Move earlier
      </MenuItem>
      <MenuItem disabled={index === count - 1} onSelect={() => actions.onMove(index + 1)}>
        Move later
      </MenuItem>
      <MenuDivider />
      <MenuItem tone="danger" onSelect={actions.onRemove}>
        Remove from plan
      </MenuItem>
    </OverflowMenu>
  );
}

export function MealCard({
  item,
  index,
  count,
  busy,
  actions,
}: {
  item: MealPlanItem;
  index: number;
  count: number;
  busy: boolean;
  actions: MealActions;
}) {
  const time = timeLabel(item.totalMinutes);

  // A meal whose recipe was trashed has no card to draw, so it states what
  // happened and what to do about it instead of showing an empty frame.
  const face = item.unavailable ? (
    <div
      className={cn(
        CARD_FRAME,
        'grid place-items-center border-[var(--cb-danger-border)] bg-[var(--cb-danger-surface)] px-5 text-center',
      )}
    >
      <div>
        <h3 className="m-0 font-serif text-[19px] leading-[1.2] text-ink">{item.recipeName}</h3>
        <p className="mx-auto mt-1.5 mb-0 max-w-56 text-[13px] text-ink-2">
          This recipe is no longer in the cookbook. Change or remove it to build a grocery list.
        </p>
      </div>
    </div>
  ) : (
    <Link className={cn(CARD_FRAME, focusRing)} to={`/recipes/${item.recipeId}`}>
      <CardPhoto id={item.recipeId ?? 0} name={item.recipeName} hasImage={item.hasImage} />
      <span className="absolute inset-x-2.5 bottom-2.5 block rounded-[18px] border border-frost/70 bg-[rgba(var(--surface-rgb),0.9)] px-3.5 py-3 shadow-[0_8px_20px_-10px_color-mix(in_srgb,var(--ink)_35%,transparent)] backdrop-blur-xl backdrop-saturate-150">
        {item.categoryName ? <Eyebrow>{item.categoryName}</Eyebrow> : null}
        <h3 className="mt-1 mb-0 line-clamp-2 font-serif text-[19px] leading-[1.2] font-medium tracking-[-0.01em] text-ink">
          {item.recipeName}
        </h3>
        {time ? (
          <p className="mt-1.5 mb-0 flex items-center gap-1 text-[12.5px] text-ink-2">
            <Clock aria-hidden="true" className="h-3.5 w-3.5 text-ink-3" strokeWidth={2} />
            {time}
          </p>
        ) : null}
      </span>
    </Link>
  );

  return (
    <li className="group relative">
      {face}
      <div className="mt-2.5 flex items-center justify-between gap-2">
        {/* Not gated on `busy`: taking the tap immediately is the point, and
            the plan page settles the writes behind it. */}
        <MealServings
          servings={item.servings}
          name={item.recipeName}
          disabled={item.unavailable}
          onChange={actions.onChangeServings}
        />
        <MealMenu
          name={item.recipeName}
          index={index}
          count={count}
          disabled={busy}
          actions={actions}
        />
      </div>
    </li>
  );
}
