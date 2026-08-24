import { normalizeWhitespace, type TrashedRecipe } from '@cookbook/domain';
import { useState } from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
import { ApiRequestError } from '../api/client.js';
import { deleteRecipeForever, listTrash, restoreRecipe } from '../api/trash.js';
import { useCursorPages } from '../api/useCursorPages.js';
import {
  Button,
  ButtonLink,
  Eyebrow,
  FieldLabel,
  Input,
  PageHeader,
} from '@/components/ui';
import { Banner, EmptyState, ErrorState } from '../recipes/states.jsx';

// Trash: everything that was deleted, and the two things that can be done about
// it (technical design sections 10 and 11.1). Restoring is one press because a
// deletion is usually the mistake. Destroying a recipe is not, so it asks for
// the recipe's name first and says plainly that nothing can bring it back.

function formatDeletedAt(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? 'recently'
    : date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

// Typed confirmation, compared the way a person reads a name rather than the
// way a database stores one: spacing and capitalization are not the point.
function namesMatch(typed: string, name: string): boolean {
  return normalizeWhitespace(typed).toLowerCase() === normalizeWhitespace(name).toLowerCase();
}

interface RowProps {
  recipe: TrashedRecipe;
  onRestore: (id: number) => Promise<void>;
  onDeleteForever: (id: number) => Promise<void>;
}

function TrashRow({ recipe, onRestore, onDeleteForever }: RowProps) {
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const confirmId = `trash-${recipe.id}-confirm`;

  // Both actions fail into the same place: an in-row message, so the row a cook
  // is looking at is the row that explains what happened (section 11.3). Only
  // the failure path clears `busy`: a success reloads Trash, which replaces the
  // rows, and touching state on the way out would only be a write to a row that
  // is already gone.
  const attempt = async (action: () => Promise<void>) => {
    setBusy(true);
    setMessage(null);

    try {
      await action();
    } catch (error) {
      setMessage(
        error instanceof ApiRequestError ? error.message : 'Something went wrong. Try again.',
      );
      setBusy(false);
    }
  };

  const submitDelete = async () => {
    if (!namesMatch(typed, recipe.name)) {
      setMessage(`Type “${recipe.name}” exactly to delete it forever.`);
      return;
    }

    await attempt(() => onDeleteForever(recipe.id));
  };

  return (
    <li className="rounded-[26px] border border-frost/80 bg-[rgba(var(--surface-rgb),0.75)] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Eyebrow>{recipe.categoryName}</Eyebrow>
          <h2 className="mt-1.5 mb-0 font-serif text-[21px] leading-tight font-normal tracking-[-0.02em] text-ink">
            {recipe.name}
          </h2>
          {recipe.description ? (
            <p className="mt-1.5 mb-0 max-w-140 text-[14px] text-ink-2">{recipe.description}</p>
          ) : null}
          <p className="mt-2 mb-0 font-serif text-[13px] italic text-ink-3">
            Deleted {formatDeletedAt(recipe.deletedAt)} by {recipe.deletedByName}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            variant="primary"
            size="small"
            aria-label={`Restore ${recipe.name}`}
            disabled={busy}
            onClick={() => void attempt(() => onRestore(recipe.id))}
          >
            <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.1} />
            Restore
          </Button>
          <Button
            variant="quiet"
            size="small"
            aria-label={`Delete ${recipe.name} forever`}
            disabled={busy}
            onClick={() => {
              setMessage(null);
              setTyped('');
              setConfirming(true);
            }}
          >
            <Trash2 aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.1} />
            Delete forever
          </Button>
        </div>
      </div>

      {confirming ? (
        <form
          className="mt-4 rounded-2xl border border-[var(--cb-danger-border)] bg-[var(--cb-danger-surface)] p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submitDelete();
          }}
        >
          <FieldLabel htmlFor={confirmId}>Type “{recipe.name}” to delete it forever</FieldLabel>
          <p className="mt-1.5 mb-0 text-[13px] text-ink-2">
            The recipe, its photo, and everyone’s ratings go with it. Nothing here can bring it
            back.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            <Input
              className="min-w-0 flex-1 sm:max-w-72"
              id={confirmId}
              value={typed}
              autoFocus
              autoComplete="off"
              onChange={(event) => setTyped(event.target.value)}
            />
            <Button variant="danger" size="small" type="submit" disabled={busy}>
              Delete forever
            </Button>
            <Button
              variant="quiet"
              size="small"
              disabled={busy}
              onClick={() => {
                setConfirming(false);
                setMessage(null);
              }}
            >
              Keep it
            </Button>
          </div>
        </form>
      ) : null}

      {message ? (
        <p className="mt-3 mb-0 text-[13px] font-medium text-[var(--cb-danger-ink-strong)]" role="alert">
          {message}
        </p>
      ) : null}
    </li>
  );
}

export function TrashPage() {
  const pages = useCursorPages<TrashedRecipe>('trash', (cursor, signal) =>
    listTrash(cursor, signal),
  );

  // Both actions change what belongs in Trash, so the list is refetched rather
  // than patched: a restored recipe is no longer in it, and guessing at the
  // rest of the page would only be right until the next cursor.
  const afterChange = async (run: Promise<void>) => {
    await run;
    pages.reload();
  };

  return (
    <div className="cb-rise flex min-w-0 max-w-4xl flex-col gap-7">
      <PageHeader
        title="Trash"
        lede="Deleted recipes stay here until someone removes them for good. Restoring one brings back its ingredients, photo, tags, and every rating it had."
      />

      {pages.loading ? (
        <div className="flex flex-col gap-3" role="status" aria-live="polite">
          <span className="sr-only">Loading Trash…</span>
          <div className="h-28 rounded-[26px] bg-[var(--cb-muted-track)]" />
          <div className="h-28 rounded-[26px] bg-[var(--cb-muted-track)]" />
          <div className="h-28 rounded-[26px] bg-[var(--cb-muted-track)]" />
        </div>
      ) : pages.error ? (
        <ErrorState error={pages.error} onRetry={pages.reload}>
          <ButtonLink to="/">Back to the cookbook</ButtonLink>
        </ErrorState>
      ) : pages.items.length === 0 ? (
        <EmptyState
          title="Trash is empty."
          body="Deleting a recipe puts it here first, so nothing is ever lost by accident."
        >
          <ButtonLink to="/recipes" variant="primary">
            Browse recipes
          </ButtonLink>
        </EmptyState>
      ) : (
        <>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {pages.items.map((recipe) => (
              <TrashRow
                key={recipe.id}
                recipe={recipe}
                onRestore={(id) => afterChange(restoreRecipe(id))}
                onDeleteForever={(id) => afterChange(deleteRecipeForever(id))}
              />
            ))}
          </ul>

          {pages.moreError ? <Banner>{pages.moreError.message}</Banner> : null}

          {pages.hasMore ? (
            <div className="flex justify-center pt-1">
              <Button disabled={pages.loadingMore} onClick={pages.loadMore}>
                {pages.loadingMore ? 'Loading…' : 'Load more'}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
