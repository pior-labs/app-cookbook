import { categoryTagNameSchema } from '@cookbook/domain';
import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiRequestError } from '../api/client.js';
import {
  createCategory,
  deleteCategory,
  deleteTag,
  renameCategory,
  renameTag,
} from '../api/discovery.js';
import { useApiResource } from '../api/hooks.js';
import { createTag as createTagRequest, listCategories, listTags } from '../api/recipes.js';
import { AppShell } from '../AppShell.js';
import { ErrorState } from '../recipes/states.js';

// Category and tag management (technical design sections 7.3 and 11.1). The
// API owns every rule; this screen's job is to explain the outcome, especially
// the conflicts that block a delete (section 11.3).

interface ManagedItem {
  id: number;
  name: string;
  activeRecipeCount: number;
}

// Same rule the API applies, so an obviously empty name is caught before a
// round trip rather than after one.
function validateName(name: string): string | null {
  const parsed = categoryTagNameSchema.safeParse(name);
  return parsed.success ? null : (parsed.error.issues[0]?.message ?? 'Enter a name.');
}

interface RowProps {
  item: ManagedItem;
  kind: 'category' | 'tag';
  deleteWarning: string;
  onRename: (id: number, name: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

function ManagedRow({ item, kind, deleteWarning, onRename, onDelete }: RowProps) {
  const [mode, setMode] = useState<'idle' | 'renaming' | 'confirming'>('idle');
  const [draft, setDraft] = useState(item.name);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const inputId = `${kind}-${item.id}-name`;

  // Every failure lands in the same place: an in-row message, so the row a cook
  // is looking at is the row that explains what happened.
  const attempt = async (action: () => Promise<void>) => {
    setBusy(true);
    setMessage(null);

    try {
      await action();
      setMode('idle');
    } catch (error) {
      setMessage(
        error instanceof ApiRequestError ? error.message : 'Something went wrong. Try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  const submitRename = async () => {
    const invalid = validateName(draft);
    if (invalid) {
      setMessage(invalid);
      return;
    }

    await attempt(() => onRename(item.id, draft.trim()));
  };

  return (
    <li className="rc-manage__row">
      {mode === 'renaming' ? (
        <form
          className="rc-manage__rename"
          onSubmit={(event) => {
            event.preventDefault();
            void submitRename();
          }}
        >
          <label className="rc-visually-hidden" htmlFor={inputId}>
            Rename {item.name}
          </label>
          <input
            className="rc-input"
            id={inputId}
            value={draft}
            autoFocus
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="rc-manage__actions">
            <button className="rc-button rc-button--primary rc-button--small" disabled={busy}>
              Save
            </button>
            <button
              className="rc-button rc-button--ghost rc-button--small"
              type="button"
              disabled={busy}
              onClick={() => {
                setDraft(item.name);
                setMessage(null);
                setMode('idle');
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="rc-manage__main">
          <span className="rc-manage__name">{item.name}</span>
          <span className="rc-manage__count">
            {item.activeRecipeCount === 1 ? '1 recipe' : `${item.activeRecipeCount} recipes`}
          </span>

          <div className="rc-manage__actions">
            {/* The visible word is enough beside the name; the label spells
                out which row a screen reader is on. */}
            <button
              className="rc-button rc-button--ghost rc-button--small"
              type="button"
              aria-label={`Rename ${item.name}`}
              onClick={() => {
                setDraft(item.name);
                setMessage(null);
                setMode('renaming');
              }}
            >
              Rename
            </button>
            <button
              className="rc-button rc-button--ghost rc-button--small"
              type="button"
              aria-label={`Delete ${item.name}`}
              onClick={() => {
                setMessage(null);
                setMode('confirming');
              }}
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {mode === 'confirming' ? (
        <div className="rc-manage__confirm">
          <p className="rc-manage__warning">{deleteWarning}</p>
          <div className="rc-manage__actions">
            <button
              className="rc-button rc-button--primary rc-button--small"
              type="button"
              aria-label={`Yes, delete ${item.name}`}
              disabled={busy}
              onClick={() => void attempt(() => onDelete(item.id))}
            >
              Yes, delete
            </button>
            <button
              className="rc-button rc-button--ghost rc-button--small"
              type="button"
              disabled={busy}
              onClick={() => setMode('idle')}
            >
              Keep it
            </button>
          </div>
        </div>
      ) : null}

      {message ? (
        <p className="rc-manage__message" role="alert">
          {message}
        </p>
      ) : null}
    </li>
  );
}

function CreateForm({
  label,
  submitLabel,
  onCreate,
}: {
  label: string;
  submitLabel: string;
  onCreate: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputId = `${submitLabel.toLowerCase().replace(/\W+/g, '-')}-name`;

  const submit = async () => {
    const invalid = validateName(name);
    if (invalid) {
      setMessage(invalid);
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      await onCreate(name.trim());
      setName('');
    } catch (error) {
      // The entered name stays in the box, so a duplicate can be corrected
      // rather than retyped (section 11.2).
      setMessage(
        error instanceof ApiRequestError ? error.message : 'Something went wrong. Try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="rc-manage__create"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <label className="rc-field__label" htmlFor={inputId}>
        {label}
      </label>
      <div className="rc-manage__create-row">
        <input
          className="rc-input"
          id={inputId}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <button className="rc-button rc-button--primary" disabled={busy}>
          {submitLabel}
        </button>
      </div>
      {message ? (
        <p className="rc-field__error" role="alert">
          {message}
        </p>
      ) : null}
    </form>
  );
}

export function OrganizePage() {
  const loadCategories = useCallback((signal: AbortSignal) => listCategories(signal), []);
  const loadTags = useCallback((signal: AbortSignal) => listTags(signal), []);

  const categories = useApiResource(loadCategories, []);
  const tags = useApiResource(loadTags, []);

  // Counts change with almost every action here, so each list refetches rather
  // than guessing at the new number.
  const afterCategoryChange = async (run: Promise<unknown>) => {
    await run;
    categories.reload();
  };

  const afterTagChange = async (run: Promise<unknown>) => {
    await run;
    tags.reload();
  };

  const error = categories.error ?? tags.error;
  const loading = categories.loading || tags.loading;

  return (
    <AppShell>
      <main className="rc-page rc-page--narrow">
        <h1 className="rc-page__title">Organize</h1>
        <p className="rc-page__lede">
          Categories file a recipe in exactly one place. Tags describe it in as many ways as you
          like.
        </p>

        {loading ? (
          <div className="rc-manage" role="status" aria-live="polite">
            <span className="rc-visually-hidden">Loading categories and tags…</span>
            <div className="rc-skeleton__line" />
            <div className="rc-skeleton__line" />
            <div className="rc-skeleton__line" />
          </div>
        ) : error ? (
          <ErrorState
            error={error}
            onRetry={() => {
              categories.reload();
              tags.reload();
            }}
          >
            <Link className="rc-button rc-button--ghost" to="/">
              Back to the cookbook
            </Link>
          </ErrorState>
        ) : (
          <>
            <section className="rc-manage" aria-labelledby="organize-categories">
              <h2 className="rc-section-heading" id="organize-categories">
                Categories
              </h2>

              <ul className="rc-manage__list">
                {(categories.data ?? []).map((category) => (
                  <ManagedRow
                    key={category.id}
                    item={category}
                    kind="category"
                    deleteWarning={`Delete "${category.name}"? This only works while no recipe, live or in Trash, is filed under it.`}
                    onRename={(id, name) => afterCategoryChange(renameCategory(id, name))}
                    onDelete={(id) => afterCategoryChange(deleteCategory(id))}
                  />
                ))}
              </ul>

              <CreateForm
                label="New category"
                submitLabel="Add category"
                onCreate={(name) => afterCategoryChange(createCategory(name))}
              />
            </section>

            <section className="rc-manage" aria-labelledby="organize-tags">
              <h2 className="rc-section-heading" id="organize-tags">
                Tags
              </h2>

              {(tags.data ?? []).length === 0 ? (
                <p className="rc-field__hint">
                  No tags yet. Add one here, or create one while writing a recipe.
                </p>
              ) : (
                <ul className="rc-manage__list">
                  {(tags.data ?? []).map((tag) => (
                    <ManagedRow
                      key={tag.id}
                      item={tag}
                      kind="tag"
                      deleteWarning={
                        tag.activeRecipeCount > 0
                          ? `Delete "${tag.name}"? It will be removed from ${
                              tag.activeRecipeCount === 1
                                ? '1 recipe'
                                : `${tag.activeRecipeCount} recipes`
                            }. The recipes themselves are untouched.`
                          : `Delete "${tag.name}"? Nothing uses it yet.`
                      }
                      onRename={(id, name) => afterTagChange(renameTag(id, name))}
                      onDelete={(id) => afterTagChange(deleteTag(id))}
                    />
                  ))}
                </ul>
              )}

              <CreateForm
                label="New tag"
                submitLabel="Add tag"
                onCreate={(name) => afterTagChange(createTagRequest(name))}
              />
            </section>
          </>
        )}
      </main>
    </AppShell>
  );
}
