import { EMPTY_FILTERS } from '../api/discovery.js';
import { ButtonLink, PageHeader } from '@/components/ui';
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
    <div className="cb-rise flex min-w-0 flex-col gap-7">
      <PageHeader
        title={
          <>
            Your <em className="font-light text-accent">favorites</em>
          </>
        }
        lede="Recipes are shared in this house, but favorites are yours alone."
      />

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
          <ButtonLink to="/recipes" variant="primary">
            Browse recipes
          </ButtonLink>
        }
      />
    </div>
  );
}
