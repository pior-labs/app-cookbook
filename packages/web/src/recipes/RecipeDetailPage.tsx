import { totalMinutes, type RecipeDetail } from '@cookbook/domain';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiRequestError } from '../api/client.js';
import { useApiResource } from '../api/hooks.js';
import { recordView } from '../api/preferences.js';
import { getRecipe } from '../api/recipes.js';
import { FavoriteButton, RatingControl } from '../preferences/controls.jsx';
import { useRecipePreferences } from '../preferences/usePreferences.js';
import { IngredientList } from './IngredientList.jsx';
import { ServingControl } from './ServingControl.jsx';
import { ErrorState, RecipeSkeleton } from './states.jsx';

// Consumer-oriented recipe detail. Photo, name, time, servings, ingredients,
// and instructions lead; edit stays a secondary action
// (technical design section 11.2).

function formatMinutes(minutes: number | null): string | null {
  if (minutes == null || minutes === 0) return null;
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

function TimeFacts({ recipe }: { recipe: RecipeDetail }) {
  const facts = [
    ['Prep', formatMinutes(recipe.prepMinutes)],
    ['Cook', formatMinutes(recipe.cookMinutes)],
    ['Total', formatMinutes(totalMinutes(recipe.prepMinutes, recipe.cookMinutes))],
  ].filter(([, value]) => value != null);

  if (facts.length === 0) return null;

  return (
    <dl className="rc-facts">
      {facts.map(([label, value]) => (
        <div className="rc-facts__item" key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

// Only http/https ever reach here (the domain schema enforces it), and the
// link is opened with noopener noreferrer (section 16).
function SourceLine({ recipe }: { recipe: RecipeDetail }) {
  if (recipe.sourceUrl) {
    return (
      <p className="rc-source">
        From{' '}
        <a href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer">
          {new URL(recipe.sourceUrl).hostname}
        </a>
      </p>
    );
  }

  if (recipe.sourceText) {
    return <p className="rc-source">From {recipe.sourceText}</p>;
  }

  return null;
}

// Opening a recipe is what "recently viewed" records, so the page reports it
// once per recipe rather than making a cook press anything. A failure is
// deliberately silent: the recipe still opened (section 7.2).
function useRecordView(recipeId: number, loaded: boolean): void {
  useEffect(() => {
    if (!loaded) return;

    void recordView(recipeId).catch(() => {});
  }, [recipeId, loaded]);
}

// Favorite and rating sit together because they answer the same question: what
// does this house think of this recipe, and what do I think of it?
function PreferenceBar({ recipe }: { recipe: RecipeDetail }) {
  const preferences = useRecipePreferences(recipe.id, {
    userState: recipe.userState,
    rating: recipe.rating,
  });

  return (
    <div className="rc-preferences">
      <FavoriteButton
        name={recipe.name}
        favorite={preferences.userState.favorite}
        onToggle={preferences.toggleFavorite}
      />

      <RatingControl
        name={recipe.name}
        rating={preferences.userState.rating}
        average={preferences.rating.average}
        count={preferences.rating.count}
        onRate={preferences.setRating}
        onClear={preferences.clearRating}
      />

      {/* A reverted change has to say so, or the control silently snaps back
          (section 11.3). */}
      {preferences.error ? (
        <p className="rc-preferences__error" role="alert">
          {preferences.error}
        </p>
      ) : null}
    </div>
  );
}

export function RecipeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const recipeId = Number(id);

  const validId = Number.isSafeInteger(recipeId) && recipeId > 0;

  // A junk id in the URL is answered locally. Sending `/api/recipes/NaN` would
  // only ever come back 400, so it is a wasted round trip.
  const load = useCallback(
    (signal: AbortSignal) =>
      validId
        ? getRecipe(recipeId, signal)
        : Promise.reject(new ApiRequestError(404, 'recipe_not_found', 'This recipe does not exist.')),
    [recipeId, validId],
  );
  const { data: recipe, error, loading, reload } = useApiResource(load, [recipeId]);

  useRecordView(recipeId, validId && recipe != null);

  const [servings, setServings] = useState<number | null>(null);

  // Serving state follows the loaded recipe, and resets when a different
  // recipe is opened rather than carrying the previous one's count over.
  useEffect(() => {
    setServings(recipe ? recipe.baseServings : null);
  }, [recipe]);

  if (loading) {
    return (
      <main className="rc-page">
        <RecipeSkeleton />
      </main>
    );
  }

  if (error || !recipe) {
    return (
      <main className="rc-page">
        <ErrorState
          error={error!}
          onRetry={reload}
        >
          <Link className="rc-button rc-button--ghost" to="/">
            Back to the cookbook
          </Link>
        </ErrorState>
      </main>
    );
  }

  const activeServings = servings ?? recipe.baseServings;

  return (
    <main className="rc-page rc-detail">
      <nav className="rc-breadcrumb">
        <Link to="/">← Cookbook</Link>
      </nav>

      <header className="rc-detail__header">
        {recipe.image ? (
          <img
            className="rc-detail__photo"
            src={recipe.image.detailUrl}
            width={recipe.image.detailWidth}
            height={recipe.image.detailHeight}
            alt={`${recipe.name}, as photographed for this recipe`}
          />
        ) : null}

        <div className="rc-detail__intro">
          <p className="rc-eyebrow">{recipe.categoryName}</p>
          <h1 className="rc-detail__title">{recipe.name}</h1>
          {recipe.description ? <p className="rc-detail__lede">{recipe.description}</p> : null}

          {recipe.tags.length > 0 ? (
            <ul className="rc-tag-row">
              {recipe.tags.map((tag) => (
                <li className="rc-chip" key={tag.id}>
                  {tag.name}
                </li>
              ))}
            </ul>
          ) : null}

          <TimeFacts recipe={recipe} />
          <SourceLine recipe={recipe} />

          {/* Keyed by recipe so opening another one starts from its own state
              instead of inheriting the previous recipe's. */}
          <PreferenceBar key={recipe.id} recipe={recipe} />

          <div className="rc-detail__actions">
            <button
              className="rc-button rc-button--ghost"
              type="button"
              onClick={() => navigate(`/recipes/${recipe.id}/edit`)}
            >
              Edit recipe
            </button>
          </div>
        </div>
      </header>

      <div className="rc-detail__body">
        <section className="rc-detail__ingredients" aria-labelledby="ingredients-heading">
          <h2 className="rc-section-heading" id="ingredients-heading">
            Ingredients
          </h2>

          <ServingControl
            baseServings={recipe.baseServings}
            servings={activeServings}
            onChange={setServings}
          />

          <IngredientList
            ingredients={recipe.ingredients}
            baseServings={recipe.baseServings}
            servings={activeServings}
          />
        </section>

        <section className="rc-detail__instructions" aria-labelledby="instructions-heading">
          <h2 className="rc-section-heading" id="instructions-heading">
            Instructions
          </h2>
          <ol className="rc-steps">
            {recipe.instructions.map((instruction, index) => (
              <li className="rc-step" key={instruction.id}>
                <span className="rc-step__number" aria-hidden="true">
                  {index + 1}
                </span>
                <p className="rc-step__body">{instruction.body}</p>
              </li>
            ))}
          </ol>

          {recipe.notes ? (
            <aside className="rc-notes" aria-labelledby="notes-heading">
              <h3 className="rc-section-heading rc-section-heading--small" id="notes-heading">
                Notes
              </h3>
              <p>{recipe.notes}</p>
            </aside>
          ) : null}
        </section>
      </div>
    </main>
  );
}
