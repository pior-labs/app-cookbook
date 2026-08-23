import type { RecipeSummary } from '@cookbook/domain';
import { Link } from 'react-router-dom';
import { FavoriteButton } from '../preferences/controls.jsx';
import { useRecipePreferences } from '../preferences/usePreferences.js';

// The one recipe card. Home rails and browse results are the same summary
// shape, so they render through the same component and stay visually identical
// (technical design section 11.1).

export function timeLabel(recipe: RecipeSummary): string | null {
  if (recipe.totalMinutes == null || recipe.totalMinutes === 0) return null;
  if (recipe.totalMinutes < 60) return `${recipe.totalMinutes} min`;

  const hours = Math.floor(recipe.totalMinutes / 60);
  const rest = recipe.totalMinutes % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

// The household rating, not the current user's. One decimal place, because a
// handful of ratings rarely lands on a whole number.
function ratingLabel(recipe: RecipeSummary): string | null {
  const { average, count } = recipe.rating;
  if (average == null || count === 0) return null;

  return `${average.toFixed(1)} ★ (${count})`;
}

export function RecipeCard({ recipe }: { recipe: RecipeSummary }) {
  const time = timeLabel(recipe);
  const rating = ratingLabel(recipe);
  const preferences = useRecipePreferences(recipe.id, {
    userState: recipe.userState,
    rating: recipe.rating,
  });

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
          {recipe.description ? <p className="rc-card__description">{recipe.description}</p> : null}
          {time || rating ? (
            <p className="rc-card__meta">{[time, rating].filter(Boolean).join(' · ')}</p>
          ) : null}
        </div>
      </Link>

      {/* A sibling of the link rather than a child: a button inside a link is
          neither valid nor operable. */}
      <FavoriteButton
        name={recipe.name}
        favorite={preferences.userState.favorite}
        onToggle={preferences.toggleFavorite}
        size="small"
      />

      {preferences.error ? (
        <p className="rc-card__error" role="alert">
          {preferences.error}
        </p>
      ) : null}
    </li>
  );
}

export function RecipeCardGrid({ recipes }: { recipes: RecipeSummary[] }) {
  return (
    <ul className="rc-card-grid">
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
    <ul className="rc-card-grid" aria-busy="true" role="status">
      <span className="rc-visually-hidden">{label}</span>
      {Array.from({ length: count }, (_, index) => (
        <li className="rc-card rc-card--skeleton" key={index} aria-hidden="true">
          <div className="rc-card__photo rc-card__photo--empty" />
          <div className="rc-card__body">
            <div className="rc-skeleton__line" />
            <div className="rc-skeleton__line" />
          </div>
        </li>
      ))}
    </ul>
  );
}
