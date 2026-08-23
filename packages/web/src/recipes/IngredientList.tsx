import {
  formatQuantity,
  scaleQuantity,
  unitLabel,
  type Fraction,
  type RecipeIngredient,
} from '@cookbook/domain';

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
}

export function IngredientList({ ingredients, baseServings, servings }: IngredientListProps) {
  return (
    <ul className="rc-ingredients">
      {ingredients.map((ingredient) => {
        const quantity = scaledQuantity(ingredient, baseServings, servings);
        const amount = quantity ? formatQuantity(quantity) : null;
        const unit = unitText(ingredient, quantity);

        return (
          <li className="rc-ingredient" key={ingredient.id}>
            <span className="rc-ingredient__amount">
              {amount ? (
                <>
                  <span className="rc-ingredient__number">{amount}</span>
                  {unit ? <span className="rc-ingredient__unit"> {unit}</span> : null}
                </>
              ) : (
                <span className="rc-ingredient__to-taste">to taste</span>
              )}
            </span>
            <span className="rc-ingredient__name">
              {ingredient.name}
              {ingredient.preparation ? (
                <span className="rc-ingredient__prep">, {ingredient.preparation}</span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
