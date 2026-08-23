import type { HomeSections, RecipeSummary } from '@cookbook/domain';
import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getHome } from '../api/discovery.js';
import { useApiResource } from '../api/hooks.js';
import { AppShell } from '../AppShell.js';
import { useAuth } from '../auth';
import { ErrorState } from '../recipes/states.js';
import { RecipeCard, RecipeCardSkeleton } from './RecipeCard.js';

// Visual discovery: what this household cooks, what the current user keeps
// coming back to, and a way into every category
// (technical design sections 11.1 and 11.2).

// A rail renders only when it has something in it. An empty "Your favorites"
// strip teaches a cook nothing and pushes the real content down the page.
function Rail({
  title,
  recipes,
  browseTo,
}: {
  title: string;
  recipes: RecipeSummary[];
  browseTo?: string;
}) {
  if (recipes.length === 0) return null;

  const headingId = `rail-${title.toLowerCase().replace(/[^a-z]+/g, '-')}`;

  return (
    <section className="rc-rail" aria-labelledby={headingId}>
      <div className="rc-rail__header">
        <h2 className="rc-section-heading" id={headingId}>
          {title}
        </h2>
        {browseTo ? (
          <Link className="rc-rail__more" to={browseTo}>
            See all
          </Link>
        ) : null}
      </div>

      <ul className="rc-rail__track">
        {recipes.map((recipe) => (
          <RecipeCard key={recipe.id} recipe={recipe} />
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
    <section className="rc-home__categories" aria-labelledby="home-categories">
      <h2 className="rc-section-heading" id="home-categories">
        Browse by category
      </h2>

      <ul className="rc-tag-list">
        {used.map((category) => (
          <li key={category.id}>
            <Link className="rc-chip rc-chip--link" to={`/recipes?categoryId=${category.id}`}>
              {category.name}
              <span className="rc-chip__count">{category.activeRecipeCount}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function EmptyCookbook() {
  return (
    <div className="rc-state">
      <p className="rc-state__title">No recipes yet.</p>
      <p className="rc-state__body">Add the first one and it will show up here.</p>
      <div className="rc-state__actions">
        <Link className="rc-button rc-button--primary" to="/recipes/new">
          Add a recipe
        </Link>
      </div>
    </div>
  );
}

export function HomePage() {
  const { user } = useAuth();
  const load = useCallback((signal: AbortSignal) => getHome(signal), []);
  const { data: home, error, loading, reload } = useApiResource(load, []);

  return (
    <AppShell>
      <main className="rc-page rc-home">
        <h1 className="rc-page__title">Welcome, {user?.name.split(' ')[0] ?? 'cook'}.</h1>

        {loading ? (
          <RecipeCardSkeleton label="Loading your cookbook…" />
        ) : error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : home && home.recentlyAdded.length === 0 ? (
          <EmptyCookbook />
        ) : home ? (
          <>
            <Rail title="Jump back in" recipes={home.recentlyViewed} browseTo="/recent" />
            <Rail title="Your favorites" recipes={home.favorites} browseTo="/favorites" />
            <Rail
              title="Loved in this house"
              recipes={home.highlyRated}
              browseTo="/recipes?sort=rating"
            />
            <Rail title="Recently added" recipes={home.recentlyAdded} browseTo="/recipes" />
            <CategoryRow categories={home.categories} />
          </>
        ) : null}
      </main>
    </AppShell>
  );
}
