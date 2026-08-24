import { totalMinutes, type RecipeDetail } from '@cookbook/domain';
import { useCallback, useEffect, useState } from 'react';
import { CookingPot, ExternalLink, Pencil, Trash2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiRequestError } from '../api/client.js';
import { useApiResource } from '../api/hooks.js';
import { recordView } from '../api/preferences.js';
import { getRecipe } from '../api/recipes.js';
import { trashRecipe } from '../api/trash.js';
import { cn } from '@/lib/utils';
import { useCookMode } from '@/components/CookMode';
import {
  Breadcrumb,
  Button,
  ButtonLink,
  Eyebrow,
  SectionHeading,
  chipClass,
  focusRing,
} from '@/components/ui';
import { FavoriteButton, RatingControl } from '../preferences/controls.jsx';
import { useRecipePreferences } from '../preferences/usePreferences.js';
import { IngredientList } from './IngredientList.jsx';
import { ServingControl } from './ServingControl.jsx';
import { ErrorState, RecipeSkeleton } from './states.jsx';

// Consumer-oriented recipe detail. Photo, name, time, servings, ingredients,
// and instructions lead; edit stays a secondary action
// (technical design section 11.2).
//
// The page has two readings of the same recipe. The default one is browsing
// distance. Cook mode is standing distance: the navigation goes, the
// atmosphere settles, the ingredients become a checklist, and the steps get
// the size they need to be read across a hot pan.

function formatMinutes(minutes: number | null): string | null {
  if (minutes == null || minutes === 0) return null;
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

// The one place this app has real numbers to show, so it shows them the way
// the finance tracker shows a stat: a tinted tile with the label above the
// figure.
const FACT_TONES = ['tone-card-1', 'tone-card-2', 'tone-card-3'] as const;

function TimeFacts({ recipe }: { recipe: RecipeDetail }) {
  const facts = (
    [
      ['Prep', formatMinutes(recipe.prepMinutes)],
      ['Cook', formatMinutes(recipe.cookMinutes)],
      ['Total', formatMinutes(totalMinutes(recipe.prepMinutes, recipe.cookMinutes))],
    ] as [string, string | null][]
  ).filter((entry): entry is [string, string] => entry[1] != null);

  if (facts.length === 0) return null;

  return (
    <dl className="m-0 flex flex-wrap gap-2.5">
      {facts.map(([label, value], index) => (
        <div
          className={cn(
            FACT_TONES[index % FACT_TONES.length],
            'min-w-[104px] rounded-2xl border border-frost/80 px-4 py-2.5 backdrop-blur-md',
          )}
          key={label}
        >
          <dt className="font-mono text-[10px] font-semibold tracking-[0.16em] text-ink-2 uppercase">
            {label}
          </dt>
          <dd className="m-0 mt-0.5 font-serif text-[19px] leading-none tracking-[-0.01em] text-ink">
            {value}
          </dd>
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
      <p className="m-0 text-[14px] text-ink-2">
        From{' '}
        <a
          className={`inline-flex items-center gap-1 text-accent underline decoration-dotted underline-offset-4 ${focusRing}`}
          href={recipe.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {new URL(recipe.sourceUrl).hostname}
          <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
        </a>
      </p>
    );
  }

  if (recipe.sourceText) {
    return <p className="m-0 text-[14px] text-ink-2">From {recipe.sourceText}</p>;
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
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
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
      </div>

      {/* A reverted change has to say so, or the control silently snaps back
          (section 11.3). */}
      {preferences.error ? (
        <p className="m-0 text-[13px] font-medium text-[var(--cb-danger-ink-strong)]" role="alert">
          {preferences.error}
        </p>
      ) : null}
    </div>
  );
}

// Deleting is recoverable, so it asks once and says where the recipe is going
// rather than warning about a loss that is not happening (technical design
// section 10). The screen then follows it to Trash, where undoing is one press.
function DeleteAction({ recipe }: { recipe: RecipeDetail }) {
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    setBusy(true);
    setError(null);

    try {
      await trashRecipe(recipe.id);
      navigate('/trash');
    } catch (caught) {
      setError(
        caught instanceof ApiRequestError ? caught.message : 'Something went wrong. Try again.',
      );
      setBusy(false);
    }
  };

  if (!confirming) {
    return (
      <Button variant="quiet" onClick={() => setConfirming(true)}>
        <Trash2 aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
        Move to Trash
      </Button>
    );
  }

  return (
    <div className="w-full rounded-[22px] border border-frost/80 bg-[rgba(var(--surface-rgb),0.9)] p-4">
      <p className="m-0 text-[15px] text-ink">
        Move “{recipe.name}” to Trash? You can restore it from there.
      </p>
      <div className="mt-3 flex flex-wrap gap-2.5">
        <Button variant="primary" size="small" disabled={busy} onClick={() => void remove()}>
          Move to Trash
        </Button>
        <Button
          size="small"
          disabled={busy}
          onClick={() => {
            setError(null);
            setConfirming(false);
          }}
        >
          Keep it
        </Button>
      </div>
      {error ? (
        <p className="mt-2.5 mb-0 text-[13px] font-medium text-[var(--cb-danger-ink-strong)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

// A recipe is a sequence, which is the one place an ordinal marker carries
// something a reader needs. The numeral sits in the margin as a serif figure
// rather than in a badge, so the step itself stays the loudest thing.
function Steps({ recipe, cooking }: { recipe: RecipeDetail; cooking: boolean }) {
  return (
    <ol className="m-0 flex list-none flex-col p-0">
      {recipe.instructions.map((instruction, index) => (
        <li
          className={cn(
            'flex gap-4 border-b border-dashed border-ink/10 last:border-b-0',
            cooking ? 'gap-5 py-6 first:pt-0' : 'py-4 first:pt-0',
          )}
          key={instruction.id}
        >
          <span
            aria-hidden="true"
            className={cn(
              'shrink-0 font-serif leading-none italic tabular-nums text-ink/30',
              cooking ? 'w-12 text-[40px]' : 'w-8 text-[24px]',
            )}
          >
            {index + 1}
          </span>
          <p
            className={cn(
              'm-0 min-w-0 flex-1 text-ink',
              cooking ? 'text-[20px] leading-[1.65] sm:text-[21px]' : 'text-[15px] leading-[1.65]',
            )}
          >
            {instruction.body}
          </p>
        </li>
      ))}
    </ol>
  );
}

function Notes({ recipe, cooking }: { recipe: RecipeDetail; cooking: boolean }) {
  if (!recipe.notes) return null;

  return (
    <aside
      className="mt-6 rounded-[22px] border border-frost/80 bg-[var(--cb-warn-surface)] p-4 sm:p-5"
      aria-labelledby="notes-heading"
    >
      <h3
        className="m-0 font-serif text-[17px] font-normal tracking-[-0.01em] text-ink"
        id="notes-heading"
      >
        Notes
      </h3>
      <p className={cn('mt-1.5 mb-0 text-ink-2', cooking ? 'text-[17px] leading-[1.6]' : 'text-[15px] leading-[1.6]')}>
        {recipe.notes}
      </p>
    </aside>
  );
}

// The opaque sheet that holds long text. The chrome around it is glass; a
// recipe being read at the stove is not.
function Sheet({ className, children, ...rest }: React.HTMLAttributes<HTMLElement> & { children: React.ReactNode }) {
  return (
    <section
      className={cn(
        'rounded-[26px] border border-frost/80 bg-[rgba(var(--surface-rgb),0.94)] p-5 shadow-[0_10px_34px_-16px_color-mix(in_srgb,var(--ink)_28%,transparent)] sm:rounded-4xl sm:p-7',
        className,
      )}
      {...rest}
    >
      {children}
    </section>
  );
}

function CookView({
  recipe,
  servings,
  onServings,
  checked,
  onToggle,
  onDone,
}: {
  recipe: RecipeDetail;
  servings: number;
  onServings: (value: number) => void;
  checked: ReadonlySet<number>;
  onToggle: (id: number) => void;
  onDone: () => void;
}) {
  return (
    <div className="cb-rise flex min-w-0 flex-col">
      {/* The bar is inset, so the strip behind it has to run the full width or
          the list scrolls into view beside it. Cook mode all but stops the
          mesh, which is why plain cream reads as nothing here. */}
      <div className="sticky top-0 z-20 -mx-4 mb-7 px-4 pt-3 pb-3 md:-mx-8 md:px-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -bottom-6 bg-gradient-to-b from-cream from-62% to-transparent"
        />
        <div className="relative flex items-center justify-between gap-4 rounded-full border border-frost/80 bg-[rgba(var(--surface-rgb),0.92)] py-2.5 pr-2.5 pl-5 shadow-[var(--cb-menu-shadow)] backdrop-blur-xl backdrop-saturate-150">
          <div className="min-w-0">
            <Eyebrow>Cooking</Eyebrow>
            <h1 className="m-0 truncate font-serif text-[20px] leading-tight font-normal tracking-[-0.02em] text-ink sm:text-[24px]">
              {recipe.name}
            </h1>
          </div>
          <Button variant="primary" onClick={onDone}>
            Done
          </Button>
        </div>
      </div>

      <div className="grid gap-7 lg:grid-cols-[minmax(300px,0.85fr)_minmax(0,1.15fr)] lg:gap-9">
        <Sheet aria-labelledby="ingredients-heading" className="lg:sticky lg:top-24 lg:self-start">
          <SectionHeading className="mb-4" id="ingredients-heading" sub="Tap one off as you go">
            Ingredients
          </SectionHeading>

          <ServingControl
            baseServings={recipe.baseServings}
            servings={servings}
            onChange={onServings}
            size="large"
          />

          <div className="mt-4">
            <IngredientList
              ingredients={recipe.ingredients}
              baseServings={recipe.baseServings}
              servings={servings}
              checkable
              checked={checked}
              onToggle={onToggle}
            />
          </div>
        </Sheet>

        <Sheet aria-labelledby="instructions-heading">
          <SectionHeading className="mb-4" id="instructions-heading" sub={`${recipe.instructions.length} steps`}>
            Instructions
          </SectionHeading>
          <Steps recipe={recipe} cooking />
          <Notes recipe={recipe} cooking />
        </Sheet>
      </div>
    </div>
  );
}

export function RecipeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const recipeId = Number(id);
  const { cooking, setCooking } = useCookMode();

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
  const [checked, setChecked] = useState<ReadonlySet<number>>(() => new Set());

  // Serving state follows the loaded recipe, and resets when a different
  // recipe is opened rather than carrying the previous one's count over.
  useEffect(() => {
    setServings(recipe ? recipe.baseServings : null);
    setChecked(new Set());
  }, [recipe]);

  const toggleChecked = useCallback((ingredientId: number) => {
    setChecked((current) => {
      const next = new Set(current);
      if (!next.delete(ingredientId)) next.add(ingredientId);
      return next;
    });
  }, []);

  if (loading) return <RecipeSkeleton />;

  if (error || !recipe) {
    return (
      <ErrorState error={error!} onRetry={reload}>
        <ButtonLink to="/">Back to the cookbook</ButtonLink>
      </ErrorState>
    );
  }

  const activeServings = servings ?? recipe.baseServings;

  if (cooking) {
    return (
      <CookView
        recipe={recipe}
        servings={activeServings}
        onServings={setServings}
        checked={checked}
        onToggle={toggleChecked}
        onDone={() => setCooking(false)}
      />
    );
  }

  return (
    <div className="cb-rise flex min-w-0 flex-col gap-8">
      <Breadcrumb to="/">Cookbook</Breadcrumb>

      <header className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-9">
        {recipe.image ? (
          <img
            className="aspect-[4/3] w-full rounded-[26px] border border-frost/80 object-cover shadow-[0_18px_48px_-18px_color-mix(in_srgb,var(--ink)_38%,transparent)] sm:rounded-4xl"
            src={recipe.image.detailUrl}
            width={recipe.image.detailWidth}
            height={recipe.image.detailHeight}
            alt={`${recipe.name}, as photographed for this recipe`}
          />
        ) : null}

        <div className={cn('flex min-w-0 flex-col gap-5', !recipe.image && 'lg:col-span-2')}>
          <div className="min-w-0">
            <Eyebrow>{recipe.categoryName}</Eyebrow>
            <h1 className="mt-2 mb-0 font-serif text-[34px] leading-[1.05] font-normal tracking-[-0.03em] text-ink sm:text-[42px]">
              {recipe.name}
            </h1>
            {recipe.description ? (
              <p className="mt-3 mb-0 max-w-140 text-[16px] leading-[1.6] text-ink-2">
                {recipe.description}
              </p>
            ) : null}
          </div>

          {recipe.tags.length > 0 ? (
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {recipe.tags.map((tag) => (
                <li className={chipClass(false, 'cursor-default hover:bg-frost/55')} key={tag.id}>
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

          <div className="flex flex-wrap items-start gap-2.5 border-t border-dashed border-ink/10 pt-5">
            <Button variant="primary" onClick={() => setCooking(true)}>
              <CookingPot aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
              Cook this
            </Button>
            <Button onClick={() => navigate(`/recipes/${recipe.id}/edit`)}>
              <Pencil aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
              Edit recipe
            </Button>

            <DeleteAction recipe={recipe} />
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)] lg:gap-8">
        <Sheet aria-labelledby="ingredients-heading">
          <SectionHeading className="mb-4" id="ingredients-heading" sub="Scaled to your servings">
            Ingredients
          </SectionHeading>

          <ServingControl
            baseServings={recipe.baseServings}
            servings={activeServings}
            onChange={setServings}
          />

          <div className="mt-4">
            <IngredientList
              ingredients={recipe.ingredients}
              baseServings={recipe.baseServings}
              servings={activeServings}
            />
          </div>
        </Sheet>

        <Sheet aria-labelledby="instructions-heading">
          <SectionHeading
            className="mb-4"
            id="instructions-heading"
            sub={recipe.instructions.length === 1 ? '1 step' : `${recipe.instructions.length} steps`}
          >
            Instructions
          </SectionHeading>
          <Steps recipe={recipe} cooking={false} />
          <Notes recipe={recipe} cooking={false} />
        </Sheet>
      </div>
    </div>
  );
}
