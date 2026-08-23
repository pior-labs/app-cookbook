import type { RecipeSummary } from '@cookbook/domain';
import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from './auth';
import { apiGet } from './api/client';
import { useApiResource } from './api/hooks';
import { ErrorState } from './recipes/states';

// The entry point into the recipe screens. Visual discovery (favorites, highly
// rated, category rails) is browse/search work and is not built here; this is
// the plain recent list that makes recipes reachable.

function listRecent(signal: AbortSignal): Promise<RecipeSummary[]> {
  return apiGet<RecipeSummary[]>('/api/recipes?limit=24', signal);
}

function timeLabel(recipe: RecipeSummary): string | null {
  if (recipe.totalMinutes == null || recipe.totalMinutes === 0) return null;
  if (recipe.totalMinutes < 60) return `${recipe.totalMinutes} min`;

  const hours = Math.floor(recipe.totalMinutes / 60);
  const rest = recipe.totalMinutes % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

function RecipeCard({ recipe }: { recipe: RecipeSummary }) {
  const time = timeLabel(recipe);

  return (
    <li className="rc-card">
      <Link className="rc-card__link" to={`/recipes/${recipe.id}`}>
        {recipe.hasImage ? (
          <img
            className="rc-card__photo"
            src={`/api/recipes/${recipe.id}/photo/card`}
            alt=""
            loading="lazy"
          />
        ) : (
          <div className="rc-card__photo rc-card__photo--empty" aria-hidden="true" />
        )}

        <div className="rc-card__body">
          <p className="rc-eyebrow">{recipe.categoryName}</p>
          <h3 className="rc-card__title">{recipe.name}</h3>
          {recipe.description ? (
            <p className="rc-card__description">{recipe.description}</p>
          ) : null}
          {time ? <p className="rc-card__meta">{time}</p> : null}
        </div>
      </Link>
    </li>
  );
}

export function CookbookHome() {
  const { user, signOut } = useAuth();
  const load = useCallback((signal: AbortSignal) => listRecent(signal), []);
  const { data: recipes, error, loading, reload } = useApiResource(load, []);

  return (
    <div className="rc-shell">
      <header className="rc-topbar">
        <Link className="rc-wordmark" to="/">
          <span className="rc-wordmark__seal" aria-hidden="true">
            C
          </span>
          <span>Cookbook</span>
        </Link>

        <div className="rc-topbar__actions">
          <Link className="rc-button rc-button--primary" to="/recipes/new">
            Add recipe
          </Link>
          <button className="rc-button rc-button--ghost" type="button" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </header>

      <main className="rc-page">
        <h1 className="rc-page__title">
          Welcome, {user?.name.split(' ')[0] ?? 'cook'}.
        </h1>

        {loading ? (
          <ul className="rc-card-grid" aria-busy="true">
            {[0, 1, 2].map((key) => (
              <li className="rc-card rc-card--skeleton" key={key} aria-hidden="true">
                <div className="rc-card__photo rc-card__photo--empty" />
                <div className="rc-card__body">
                  <div className="rc-skeleton__line" />
                  <div className="rc-skeleton__line" />
                </div>
              </li>
            ))}
          </ul>
        ) : error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : recipes && recipes.length > 0 ? (
          <ul className="rc-card-grid">
            {recipes.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} />
            ))}
          </ul>
        ) : (
          <div className="rc-state">
            <p className="rc-state__title">No recipes yet.</p>
            <p className="rc-state__body">
              Add the first one and it will show up here.
            </p>
            <div className="rc-state__actions">
              <Link className="rc-button rc-button--primary" to="/recipes/new">
                Add a recipe
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
