import { categoryTagNameSchema, TAG_COLORS } from '@cookbook/domain';
import { useCallback, useState } from 'react';
import { Ban, Palette, Pencil, Plus, Trash2 } from 'lucide-react';
import { ApiRequestError } from '../api/client.js';
import {
  createCategory,
  deleteCategory,
  deleteTag,
  renameCategory,
  updateTag,
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
  focusRing,
  tagChipStyle,
} from '@/components/ui';
import { ErrorState } from '../recipes/states.js';

// Category and tag management (technical design sections 7.3 and 11.1). The
// API owns every rule; this screen's job is to explain the outcome, especially
// the conflicts that block a delete (section 11.3).

interface ManagedItem {
  id: number;
  name: string;
  activeRecipeCount: number;
  // Tags carry a colour; categories do not. A category row simply never gets
  // one, rather than the two kinds of row being two components.
  color?: string | null;
}

// Same rule the API applies, so an obviously empty name is caught before a
// round trip rather than after one.
function validateName(name: string): string | null {
  const parsed = categoryTagNameSchema.safeParse(name);
  return parsed.success ? null : (parsed.error.issues[0]?.message ?? 'Enter a name.');
}

const ROW =
  'rounded-[22px] border border-frost/70 bg-[rgba(var(--surface-rgb),0.62)] p-3.5 transition-colors';

// The palette, as the colour itself rather than as a swatch of a named thing:
// nobody picks "plum", they pick the one that looks right next to the others.
// The names are still there for anyone who cannot see the difference, in the
// label of each button.
function ColorPicker({
  value,
  subject,
  onSelect,
}: {
  value: string | null;
  subject: string;
  onSelect: (color: string | null) => void;
}) {
  const swatch =
    'h-9 w-9 shrink-0 cursor-pointer rounded-full border-2 transition-transform hover:scale-110 motion-reduce:transform-none';

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={`Colour for ${subject}`}>
      {TAG_COLORS.map((color) => {
        const selected = color.value === value;

        return (
          <button
            key={color.value}
            type="button"
            aria-label={color.name}
            aria-pressed={selected}
            className={`cb-swatch ${swatch} ${selected ? 'border-ink' : 'border-frost/70'} ${focusRing}`}
            style={tagChipStyle(color.value)}
            onClick={() => onSelect(color.value)}
          />
        );
      })}

      {/* No colour is a choice on the same row as the others, not the absence
          of one: it is how a tag goes back to the neutral chip. */}
      <button
        type="button"
        aria-label="No colour"
        aria-pressed={value == null}
        className={`${swatch} grid place-items-center bg-[rgba(var(--surface-rgb),0.9)] text-ink-3 ${
          value == null ? 'border-ink' : 'border-frost/70'
        } ${focusRing}`}
        onClick={() => onSelect(null)}
      >
        <Ban aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
      </button>
    </div>
  );
}

interface RowProps {
  item: ManagedItem;
  kind: 'category' | 'tag';
  deleteWarning: string;
  onRename: (id: number, name: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  // Tags only: categories are filed under, not described with, so they carry
  // no colour.
  onRecolor?: (id: number, color: string | null) => Promise<void>;
}

function ManagedRow({ item, kind, deleteWarning, onRename, onDelete, onRecolor }: RowProps) {
  const [mode, setMode] = useState<'idle' | 'renaming' | 'confirming' | 'coloring'>('idle');
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
          {/* The tag as it is actually seen elsewhere: the row says what the
              choice looks like, not which hex it was. */}
          {onRecolor ? (
            <span
              aria-hidden="true"
              className={
                item.color
                  ? 'cb-swatch h-4 w-4 shrink-0 rounded-full'
                  : 'h-4 w-4 shrink-0 rounded-full border border-dashed border-ink/25'
              }
              style={tagChipStyle(item.color)}
            />
          ) : null}
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
            {onRecolor ? (
              <Button
                variant="quiet"
                size="small"
                aria-label={`Colour ${item.name}`}
                aria-expanded={mode === 'coloring'}
                onClick={() => {
                  setMessage(null);
                  setMode(mode === 'coloring' ? 'idle' : 'coloring');
                }}
              >
                <Palette aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
                Colour
              </Button>
            ) : null}
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

      {/* Picking saves at once. A colour is one tap to set and one to change,
          so a Save button beside it would only be a second tap on the way to
          the same place. */}
      {mode === 'coloring' && onRecolor ? (
        <div className="mt-3 border-t border-dashed border-ink/10 pt-3">
          <ColorPicker
            value={item.color ?? null}
            subject={item.name}
            onSelect={(color) => void attempt(() => onRecolor(item.id, color))}
          />
        </div>
      ) : null}

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
  withColor = false,
  onCreate,
}: {
  label: string;
  submitLabel: string;
  // A tag is given its colour where it is made, so the first thing a cook sees
  // after adding one is the tag as it will look everywhere else.
  withColor?: boolean;
  onCreate: (name: string, color: string | null) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [color, setColor] = useState<string | null>(null);
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
      await onCreate(name.trim(), color);
      setName('');
      setColor(null);
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
      {withColor ? (
        <div className="mt-1.5">
          <ColorPicker value={color} subject="the new tag" onSelect={setColor} />
        </div>
      ) : null}
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
                    onRename={(id, name) => afterTagChange(updateTag(id, { name }))}
                    onDelete={(id) => afterTagChange(deleteTag(id))}
                    onRecolor={(id, color) =>
                      afterTagChange(updateTag(id, { name: tag.name, color }))
                    }
                  />
                ))}
              </ul>
            )}

            <CreateForm
              label="New tag"
              submitLabel="Add tag"
              withColor
              onCreate={(name, color) => afterTagChange(createTagRequest(name, color))}
            />
          </Sheet>
        </>
      )}
    </div>
  );
}
