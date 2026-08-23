import { Link } from 'react-router-dom';
import { EMPTY_FILTERS } from '../api/discovery.js';
import { AppShell } from '../AppShell.js';
import { RecipeResults } from '../discovery/RecipeResults.jsx';
import { useRecipePages } from '../discovery/useRecipePages.js';

// The current user's favorites (technical design section 11.1). It is browse
// with one filter pinned, so it pages and renders identically; only the empty
// state is its own, because "nothing matches" and "you have not favorited
// anything" are different problems.

const FAVORITES = { ...EMPTY_FILTERS, favorite: true };

export function FavoritesPage() {
  const pages = useRecipePages(FAVORITES);

  return (
    <AppShell>
      <main className="rc-page">
        <h1 className="rc-page__title">Your favorites</h1>
        <p className="rc-page__lede">
          Recipes are shared in this house, but favorites are yours alone.
        </p>

        {/* Unfavoriting here leaves the card in place until the next load
            rather than pulling it out from under the tap, so an accidental
            press is one tap to undo. */}
        <RecipeResults
          pages={pages}
          filtered={false}
          loadingLabel="Loading your favorites…"
          emptyTitle="No favorites yet."
          emptyBody="Tap the heart on any recipe and it will show up here."
          emptyAction={
            <Link className="rc-button rc-button--primary" to="/recipes">
              Browse recipes
            </Link>
          }
        />
      </main>
    </AppShell>
  );
}
