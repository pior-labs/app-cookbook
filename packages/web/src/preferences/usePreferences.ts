import type { RecipePreferences, RecipeRatingSummary, RecipeUserState } from '@cookbook/domain';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiRequestError } from '../api/client.js';
import {
  clearRating,
  favoriteRecipe,
  rateRecipe,
  unfavoriteRecipe,
} from '../api/preferences.js';

// Favoriting and rating are the only optimistic interactions in the app
// (technical design section 11.3). A tap flips immediately, a failure puts the
// previous value back, and the error is announced rather than swallowed.

export interface PreferenceState {
  userState: RecipeUserState;
  rating: RecipeRatingSummary;
  error: string | null;
  toggleFavorite: () => void;
  setRating: (rating: number) => void;
  clearRating: () => void;
}

// Rating a recipe changes the household average, and the caller cannot know the
// new one. Predicting it would show a number that is briefly wrong, so the
// average waits for the server while the star the cook pressed does not.
function optimisticUserState(
  current: RecipeUserState,
  change: Partial<RecipeUserState>,
): RecipeUserState {
  return { ...current, ...change };
}

export function useRecipePreferences(
  recipeId: number,
  initial: RecipePreferences,
): PreferenceState {
  const [userState, setUserState] = useState(initial.userState);
  const [rating, setRatingSummary] = useState(initial.rating);
  const [error, setError] = useState<string | null>(null);

  // A recipe list re-renders with fresh props after a reload; the hook follows
  // the server's answer rather than holding a stale optimistic value forever.
  useEffect(() => {
    setUserState(initial.userState);
    setRatingSummary(initial.rating);
  }, [initial.userState, initial.rating]);

  // Only the newest request may write state. Tapping a star twice quickly would
  // otherwise let the first response land last and show the wrong value.
  const generation = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(
    (change: Partial<RecipeUserState>, request: () => Promise<RecipePreferences>) => {
      const previous = userState;
      const attempt = (generation.current += 1);

      setUserState(optimisticUserState(previous, change));
      setError(null);

      void request()
        .then((result) => {
          if (!mounted.current || attempt !== generation.current) return;
          setUserState(result.userState);
          setRatingSummary(result.rating);
        })
        .catch((caught: unknown) => {
          if (!mounted.current || attempt !== generation.current) return;
          setUserState(previous);
          setError(
            caught instanceof ApiRequestError
              ? caught.message
              : 'That change did not save. Try again.',
          );
        });
    },
    [userState],
  );

  return {
    userState,
    rating,
    error,
    toggleFavorite: () =>
      run({ favorite: !userState.favorite }, () =>
        userState.favorite ? unfavoriteRecipe(recipeId) : favoriteRecipe(recipeId),
      ),
    setRating: (value: number) => run({ rating: value }, () => rateRecipe(recipeId, value)),
    clearRating: () => run({ rating: null }, () => clearRating(recipeId)),
  };
}
