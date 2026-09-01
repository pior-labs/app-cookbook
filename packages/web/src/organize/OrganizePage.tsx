import { categoryTagNameSchema } from '@cookbook/domain';
import { useCallback, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
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
import {
  Button,
  ButtonLink,
  FieldError,
  FieldHint,
  FieldLabel,
  Input,
  PageHeader,
  SectionHeading,
} from '@/components/ui';
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

const ROW =
  'rounded-[22px] border border-frost/70 bg-[rgba(var(--surface-rgb),0.62)] p-3.5 transition-colors';

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
    <li className={ROW}>
      {mode === 'renaming' ? (
        <form
          className="flex flex-wrap items-center gap-2.5"
          onSubmit={(event) => {
            event.preventDefault();
            void submitRename();
          }}
        >
          <label className="sr-only" htmlFor={inputId}>
            Rename {item.name}
          </label>
          <Input
            className="min-w-0 flex-1 sm:max-w-72"
            id={inputId}
            value={draft}
            autoFocus
            onChange={(event) => setDraft(event.target.value)}
          />
          <Button variant="primary" size="small" type="submit" disabled={busy}>
            Save
          </Button>
          <Button
            variant="quiet"
            size="small"
            disabled={busy}
            onClick={() => {
              setDraft(item.name);
              setMessage(null);
              setMode('idle');
            }}
          >
            Cancel
          </Button>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {/* `flex-auto`, not `flex-1`: the name has to bring its own width to
              the wrap calculation, or the row keeps everything on one line and
              hands the name a box narrower than the word in it - which a single
              word cannot wrap out of, so it prints over the count. It still
              grows into the free space, so a wide row is unchanged. */}
          <span className="min-w-0 flex-auto break-words font-serif text-[18px] tracking-[-0.01em] text-ink">
            {item.name}
          </span>
          <span className="shrink-0 font-serif text-[13px] italic text-ink-3">
            {item.activeRecipeCount === 1 ? '1 recipe' : `${item.activeRecipeCount} recipes`}
          </span>

          <div className="flex shrink-0 gap-1.5">
            {/* The visible word is enough beside the name; the label spells
                out which row a screen reader is on. */}
            <Button
              variant="quiet"
              size="small"
              aria-label={`Rename ${item.name}`}
              onClick={() => {
                setDraft(item.name);
                setMessage(null);
                setMode('renaming');
              }}
            >
              <Pencil aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
              Rename
            </Button>
            <Button
              variant="quiet"
              size="small"
              aria-label={`Delete ${item.name}`}
              onClick={() => {
                setMessage(null);
                setMode('confirming');
              }}
            >
              <Trash2 aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
              Delete
            </Button>
          </div>
        </div>
      )}

      {mode === 'confirming' ? (
        <div className="mt-3 rounded-2xl border border-[var(--cb-danger-border)] bg-[var(--cb-danger-surface)] p-3.5">
          <p className="m-0 text-[14px] text-ink">{deleteWarning}</p>
          <div className="mt-3 flex flex-wrap gap-2.5">
            <Button
              variant="danger"
              size="small"
              aria-label={`Yes, delete ${item.name}`}
              disabled={busy}
              onClick={() => void attempt(() => onDelete(item.id))}
            >
              Yes, delete
            </Button>
            <Button variant="quiet" size="small" disabled={busy} onClick={() => setMode('idle')}>
              Keep it
            </Button>
          </div>
        </div>
      ) : null}

      {message ? (
        <p className="mt-2.5 mb-0 text-[13px] font-medium text-[var(--cb-danger-ink-strong)]" role="alert">
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
      className="mt-4 flex flex-col gap-1.5 border-t border-dashed border-ink/10 pt-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
      <div className="flex flex-wrap items-center gap-2.5">
        <Input
          className="min-w-0 flex-1 sm:max-w-72"
          id={inputId}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Button variant="primary" type="submit" disabled={busy}>
          <Plus aria-hidden="true" className="h-4 w-4" strokeWidth={2.3} />
          {submitLabel}
        </Button>
      </div>
      {message ? <FieldError>{message}</FieldError> : null}
    </form>
  );
}

function Sheet({
  children,
  labelledBy,
}: {
  children: React.ReactNode;
  labelledBy: string;
}) {
  return (
    <section
      className="rounded-[26px] border border-frost/80 bg-[rgba(var(--surface-rgb),0.9)] p-5 shadow-[0_10px_34px_-16px_color-mix(in_srgb,var(--ink)_28%,transparent)] sm:rounded-4xl sm:p-7"
      aria-labelledby={labelledBy}
    >
      {children}
    </section>
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
    <div className="cb-rise flex min-w-0 flex-col gap-7">
      <PageHeader
        title="Organize"
        lede="Categories file a recipe in exactly one place. Tags describe it in as many ways as you like."
      />

      {loading ? (
        <div className="flex flex-col gap-2.5" role="status" aria-live="polite">
          <span className="sr-only">Loading categories and tags…</span>
          <div className="h-14 rounded-[22px] bg-[var(--cb-muted-track)]" />
          <div className="h-14 rounded-[22px] bg-[var(--cb-muted-track)]" />
          <div className="h-14 rounded-[22px] bg-[var(--cb-muted-track)]" />
        </div>
      ) : error ? (
        <ErrorState
          error={error}
          onRetry={() => {
            categories.reload();
            tags.reload();
          }}
        >
          <ButtonLink to="/">Back to the cookbook</ButtonLink>
        </ErrorState>
      ) : (
        <>
          <Sheet labelledBy="organize-categories">
            <SectionHeading className="mb-4" id="organize-categories" sub="One per recipe">
              Categories
            </SectionHeading>

            <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
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
          </Sheet>

          <Sheet labelledBy="organize-tags">
            <SectionHeading className="mb-4" id="organize-tags" sub="As many as you like">
              Tags
            </SectionHeading>

            {(tags.data ?? []).length === 0 ? (
              <FieldHint>No tags yet. Add one here, or create one while writing a recipe.</FieldHint>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
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
          </Sheet>
        </>
      )}
    </div>
  );
}
