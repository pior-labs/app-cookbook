import { normalizeWhitespace, type TrashedRecipe } from '@cookbook/domain';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiRequestError } from '../api/client.js';
import { deleteRecipeForever, listTrash, restoreRecipe } from '../api/trash.js';
import { useCursorPages } from '../api/useCursorPages.js';
import { AppShell } from '../AppShell.js';
import { ErrorState } from '../recipes/states.jsx';

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
    <li className="rc-trash__row">
      <div className="rc-trash__main">
        <div className="rc-trash__identity">
          <p className="rc-eyebrow">{recipe.categoryName}</p>
          <h2 className="rc-trash__name">{recipe.name}</h2>
          {recipe.description ? (
            <p className="rc-trash__description">{recipe.description}</p>
          ) : null}
          <p className="rc-trash__meta">
            Deleted {formatDeletedAt(recipe.deletedAt)} by {recipe.deletedByName}
          </p>
        </div>

        <div className="rc-trash__actions">
          <button
            className="rc-button rc-button--primary rc-button--small"
            type="button"
            aria-label={`Restore ${recipe.name}`}
            disabled={busy}
            onClick={() => void attempt(() => onRestore(recipe.id))}
          >
            Restore
          </button>
          <button
            className="rc-button rc-button--ghost rc-button--small"
            type="button"
            aria-label={`Delete ${recipe.name} forever`}
            disabled={busy}
            onClick={() => {
              setMessage(null);
              setTyped('');
              setConfirming(true);
            }}
          >
            Delete forever
          </button>
        </div>
      </div>

      {confirming ? (
        <form
          className="rc-trash__confirm"
          onSubmit={(event) => {
            event.preventDefault();
            void submitDelete();
          }}
        >
          <label className="rc-field__label" htmlFor={confirmId}>
            Type “{recipe.name}” to delete it forever
          </label>
          <p className="rc-trash__warning">
            The recipe, its photo, and everyone’s ratings go with it. Nothing here can bring it
            back.
          </p>
          <div className="rc-trash__confirm-row">
            <input
              className="rc-input"
              id={confirmId}
              value={typed}
              autoFocus
              autoComplete="off"
              onChange={(event) => setTyped(event.target.value)}
            />
            <button className="rc-button rc-button--danger rc-button--small" disabled={busy}>
              Delete forever
            </button>
            <button
              className="rc-button rc-button--ghost rc-button--small"
              type="button"
              disabled={busy}
              onClick={() => {
                setConfirming(false);
                setMessage(null);
              }}
            >
              Keep it
            </button>
          </div>
        </form>
      ) : null}

      {message ? (
        <p className="rc-trash__message" role="alert">
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
    <AppShell>
      <main className="rc-page rc-page--narrow">
        <h1 className="rc-page__title">Trash</h1>
        <p className="rc-page__lede">
          Deleted recipes stay here until someone removes them for good. Restoring one brings back
          its ingredients, photo, tags, and every rating it had.
        </p>

        {pages.loading ? (
          <div className="rc-trash" role="status" aria-live="polite">
            <span className="rc-visually-hidden">Loading Trash…</span>
            <div className="rc-skeleton__line" />
            <div className="rc-skeleton__line" />
            <div className="rc-skeleton__line" />
          </div>
        ) : pages.error ? (
          <ErrorState error={pages.error} onRetry={pages.reload}>
            <Link className="rc-button rc-button--ghost" to="/">
              Back to the cookbook
            </Link>
          </ErrorState>
        ) : pages.items.length === 0 ? (
          <div className="rc-state">
            <p className="rc-state__title">Trash is empty.</p>
            <p className="rc-state__body">
              Deleting a recipe puts it here first, so nothing is ever lost by accident.
            </p>
            <div className="rc-state__actions">
              <Link className="rc-button rc-button--primary" to="/recipes">
                Browse recipes
              </Link>
            </div>
          </div>
        ) : (
          <>
            <ul className="rc-trash__list">
              {pages.items.map((recipe) => (
                <TrashRow
                  key={recipe.id}
                  recipe={recipe}
                  onRestore={(id) => afterChange(restoreRecipe(id))}
                  onDeleteForever={(id) => afterChange(deleteRecipeForever(id))}
                />
              ))}
            </ul>

            {pages.moreError ? (
              <p className="rc-form__banner" role="alert">
                {pages.moreError.message}
              </p>
            ) : null}

            {pages.hasMore ? (
              <div className="rc-results__more">
                <button
                  className="rc-button rc-button--ghost"
                  type="button"
                  disabled={pages.loadingMore}
                  onClick={pages.loadMore}
                >
                  {pages.loadingMore ? 'Loading…' : 'Load more'}
                </button>
              </div>
            ) : null}
          </>
        )}
      </main>
    </AppShell>
  );
}
