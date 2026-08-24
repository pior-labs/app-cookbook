import {
  formatQuantity,
  scaleQuantity,
  unitLabel,
  type Fraction,
  type RecipeIngredient,
} from '@cookbook/domain';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { focusRing } from '@/components/ui';

// Ingredient display with serving scaling applied. Scaling uses the domain's
// exact fraction arithmetic rather than floating point, so 1/3 cup tripled is
// exactly 1 cup (ADR 0002).

function scaledQuantity(
  ingredient: RecipeIngredient,
  baseServings: number,
  servings: number,
): Fraction | null {
  if (!ingredient.quantity) return null;

  return servings === baseServings
    ? ingredient.quantity
    : scaleQuantity(ingredient.quantity, baseServings, servings);
}

// The unit label agrees with the scaled amount, so a recipe shows "1 cup" at
// base and "2 cups" when doubled. The count comes from the exact fraction
// rather than from the formatted string: "1½" parsed as text reads as 1 and
// would wrongly print the singular.
function unitText(ingredient: RecipeIngredient, quantity: Fraction | null): string | null {
  if (ingredient.unitText) return ingredient.unitText;
  if (!ingredient.unitCode) return null;

  const count = quantity == null ? 1 : quantity.numerator / quantity.denominator;
  return unitLabel(ingredient.unitCode, count);
}

interface IngredientListProps {
  ingredients: RecipeIngredient[];
  baseServings: number;
  servings: number;
  // Cook mode turns the list into a checklist at arm's length. Ticks are
  // deliberately not saved: they describe one session at the counter, not the
  // recipe.
  checkable?: boolean;
  checked?: ReadonlySet<number>;
  onToggle?: (id: number) => void;
}

export function IngredientList({
  ingredients,
  baseServings,
  servings,
  checkable = false,
  checked,
  onToggle,
}: IngredientListProps) {
  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {ingredients.map((ingredient) => {
        const quantity = scaledQuantity(ingredient, baseServings, servings);
        const amount = quantity ? formatQuantity(quantity) : null;
        const unit = unitText(ingredient, quantity);
        const isChecked = checked?.has(ingredient.id) ?? false;

        const amountCell = (
          <span
            className={cn(
              // A flex item's min-width is its longest word unless told
              // otherwise, which let "tablespoons" widen one row's column and
              // break the alignment down the list.
              'w-24 min-w-0 shrink-0 text-right font-serif leading-snug tracking-[-0.01em] text-ink tabular-nums sm:w-28',
              // Cook mode is bigger everywhere, but a phone has to give the
              // ingredient itself room: a 144px amount column leaves "kidney
              // beans, drained" on three lines.
              checkable ? 'w-28 text-[17px] sm:w-36 sm:text-[19px]' : 'text-[16px]',
            )}
          >
            {amount ? (
              <>
                <span className="font-medium">{amount}</span>
                {unit ? <span className="font-normal text-ink-2"> {unit}</span> : null}
              </>
            ) : (
              <span className="text-[0.85em] italic text-ink-3">to taste</span>
            )}
          </span>
        );

        const nameCell = (
          <span className={cn('min-w-0 flex-1', checkable ? 'text-[17px] sm:text-[19px]' : 'text-[15px]')}>
            {ingredient.name}
            {ingredient.preparation ? (
              <span className="text-ink-2">, {ingredient.preparation}</span>
            ) : null}
          </span>
        );

        if (!checkable) {
          return (
            <li
              className="flex items-baseline gap-4 border-b border-dashed border-ink/10 py-2.5 last:border-b-0"
              key={ingredient.id}
            >
              {amountCell}
              {nameCell}
            </li>
          );
        }

        return (
          <li className="border-b border-dashed border-ink/10 last:border-b-0" key={ingredient.id}>
            <button
              type="button"
              aria-pressed={isChecked}
              onClick={() => onToggle?.(ingredient.id)}
              className={cn(
                'flex w-full cursor-pointer items-baseline gap-4 rounded-2xl border-0 bg-transparent px-2 py-3.5 text-left font-[inherit] transition-colors hover:bg-ink/4',
                focusRing,
                isChecked && 'text-ink-3 line-through decoration-ink-3/50',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'mt-1 inline-grid h-6 w-6 shrink-0 translate-y-0.5 place-items-center self-start rounded-lg border transition-colors',
                  isChecked
                    ? 'border-transparent bg-[var(--cb-good-surface-strong)] text-ink'
                    : 'border-ink/20 bg-[rgba(var(--surface-rgb),0.6)]',
                )}
              >
                {isChecked ? <Check className="h-3.5 w-3.5" strokeWidth={2.8} /> : null}
              </span>
              {amountCell}
              {nameCell}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
