import { categoryTagNameSchema, TAG_COLORS, tagColorSchema } from '@cookbook/domain';
import { useCallback, useState } from 'react';
import { Ban, Palette, Pencil, Plus, Trash2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ApiRequestError } from '../api/client.js';
import {
  createCategory,
  deleteCategory,
  deleteTag,
  renameCategory,
  updateTag,
  type OrganizationRecord,
  type TagRecord,
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
  focusRing,
  tagChipStyle,
} from '@/components/ui';
import { cn } from '@/lib/utils';
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

// A row is a card in a two-column grid rather than a full-width strip: a
// household's tags are a set to look over, and a list one screen tall reads as
// a queue to work through. A tag's own colour washes the card it sits on
// (`.cb-row-tint`), so the set is scanned by colour before it is read.
const ROW =
  'rounded-[20px] border border-frost/70 bg-[rgba(var(--surface-rgb),0.62)] p-2.5 pl-3.5 ' +
  'transition-[box-shadow,border-color] duration-200 ' +
  'hover:shadow-[0_12px_30px_-18px_color-mix(in_srgb,var(--ink)_45%,transparent)]';

// The actions are icons because there are three of them on every row, twice
// per line of the grid: the words that used to carry them cost more width than
// the names they sat beside. Each keeps the label it had, where it counts.
function RowAction({
  label,
  icon: Icon,
  tone = 'default',
  expanded,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  tone?: 'default' | 'danger';
  expanded?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-expanded={expanded}
      onClick={onClick}
      className={cn(
        'inline-grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full border p-0',
        'transition-colors duration-200 pointer-coarse:h-11 pointer-coarse:w-11',
        expanded
          ? 'border-ink/20 bg-frost/90 text-ink'
          : 'border-transparent bg-[rgba(var(--surface-rgb),0.55)] text-ink-3',
        tone === 'danger'
          ? 'hover:border-destructive/35 hover:bg-destructive/10 hover:text-destructive'
          : 'hover:border-frost/80 hover:bg-frost/85 hover:text-ink',
        focusRing,
      )}
    >
      <Icon aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
    </button>
  );
}

// The number is the glance; the phrase is what a screen reader is owed.
function CountPill({ count }: { count: number }) {
  return (
    <span className="inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-ink/6 px-1.5 font-mono text-[11px] text-ink-3">
      <span aria-hidden="true">{count}</span>
      <span className="sr-only">{count === 1 ? '1 recipe' : `${count} recipes`}</span>
    </span>
  );
}

// The palette, as the colour itself rather than as a swatch of a named thing:
// nobody picks "plum", they pick the one that looks right next to the others.
// The names are still there for anyone who cannot see the difference, in the
// label of each button.
//
// The hex box beside them is the way out of the palette: the column stores any
// six-digit colour, so a household that wants its own is not held to seven.
function ColorPicker({
  value,
  subject,
  commit = 'button',
  onSelect,
}: {
  value: string | null;
  subject: string;
  // How a typed colour is committed. On a row it needs its own Save, because
  // nothing else there commits anything. In the create panel the Add button
  // commits everything, so the hex applies as soon as it is a colour and only
  // explains itself when the box is left holding something that is not one.
  commit?: 'button' | 'live';
  onSelect: (color: string | null) => void;
}) {
  const [hex, setHex] = useState(value ?? '');
  const [hexError, setHexError] = useState<string | null>(null);

  // The stored colour can change under the box - a swatch was clicked, or the
  // list reloaded after a save - and the box has to follow it, or it would go
  // on offering to save a colour that is already off the tag.
  const [lastValue, setLastValue] = useState(value);
  if (lastValue !== value) {
    setLastValue(value);
    setHex(value ?? '');
    setHexError(null);
  }

  const swatch =
    'h-9 w-9 shrink-0 cursor-pointer rounded-full border-2 transition-transform hover:scale-110 motion-reduce:transform-none';

  // The rule the API applies, so a bad colour is caught here rather than after
  // a round trip. An emptied box means the same thing as the crossed-out
  // swatch.
  const readHex = (text: string) => {
    const entered = text.trim();
    if (entered === '') return { color: null as string | null, error: null as string | null };

    const parsed = tagColorSchema.safeParse(entered.startsWith('#') ? entered : `#${entered}`);
    return parsed.success
      ? { color: parsed.data ?? null, error: null }
      : { color: null, error: parsed.error.issues[0]?.message ?? 'Enter a colour like #c96442.' };
  };

  const saveHex = () => {
    const read = readHex(hex);
    setHexError(read.error);
    if (read.error) return;

    onSelect(read.color);
  };

  // Live: a colour takes effect the moment it is one, and a half-typed hex is
  // not an error until the box is left.
  const typeHex = (text: string) => {
    setHex(text);
    setHexError(null);

    const read = readHex(text);
    if (commit === 'live' && !read.error) onSelect(read.color);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-label={`Colour for ${subject}`}
      >
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

        {/* Typed rather than clicked, so it needs its own commit: a colour is
            half-written for most of the keystrokes that make it. */}
        <input
          aria-label={`Hex colour for ${subject}`}
          aria-invalid={hexError != null}
          className={`h-9 w-28 rounded-full border border-frost/80 bg-[rgba(var(--surface-rgb),0.92)] px-3 text-center text-[13px] tracking-wide text-ink uppercase transition-[border-color,box-shadow] duration-200 placeholder:text-ink-3 focus:border-accent/45 focus:shadow-[var(--cb-focus-shadow)] focus:outline-none ${focusRing}`}
          maxLength={7}
          placeholder="#c96442"
          value={hex}
          onChange={(event) => typeHex(event.target.value)}
          onBlur={() => {
            if (commit !== 'live') return;
            setHexError(readHex(hex).error);
          }}
          onKeyDown={(event) => {
            // On a row the picker sits inside the rename form, so Enter has to
            // save the colour rather than submit that form. In the create panel
            // Enter belongs to the panel: it adds what is being made.
            if (event.key !== 'Enter' || commit === 'live') return;
            event.preventDefault();
            saveHex();
          }}
        />
        {commit === 'button' ? (
          <Button size="small" variant="primary" onClick={saveHex}>
            Save
          </Button>
        ) : null}
      </div>

      {hexError ? <FieldError>{hexError}</FieldError> : null}
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

  const dot = onRecolor ? (
    <span
      aria-hidden="true"
      className={
        item.color
          ? 'cb-swatch h-9 w-9 shrink-0 rounded-full shadow-[0_4px_12px_-3px_color-mix(in_srgb,var(--tag-color)_70%,transparent),inset_0_0_0_1px_rgba(var(--frost-rgb),0.5)]'
          : 'h-9 w-9 shrink-0 rounded-full border border-dashed border-ink/20'
      }
      style={tagChipStyle(item.color)}
    />
  ) : null;

  return (
    // An open row takes the whole line: the colours, the rename, and the delete
    // confirmation all need more width than half a grid gives them, and half a
    // row of swatches wrapping under a Save button is not a palette.
    <li
      className={cn(ROW, item.color ? 'cb-row-tint' : '', mode !== 'idle' ? 'sm:col-span-2' : '')}
      style={tagChipStyle(item.color)}
    >
      {mode === 'renaming' ? (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void submitRename();
          }}
        >
          <label className="sr-only" htmlFor={inputId}>
            Rename {item.name}
          </label>
          <Input
            className="min-h-10 min-w-0 flex-1 py-1.5"
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
        // A row is measured against itself, not the window: the same row is
        // half a grid on a desktop, a whole one when it opens, and the width
        // of a phone in between. Narrow, the name keeps the line to itself and
        // the actions take the one below - three touch targets and a count
        // leave a name about a word wide, which is how "Comfort" came to be
        // set as "Comf ort".
        <div className="@container">
          <div className="flex flex-col gap-2 @min-[21rem]:flex-row @min-[21rem]:items-center @min-[21rem]:gap-3">
            <div className="flex min-w-0 items-center gap-3">
              {/* The tag as it is actually seen elsewhere: the row says what
                  the choice looks like, not which hex it was. */}
              {dot}

              {/* Two lines at most: a row in a grid cannot grow without
                  bound, and the whole name is in the title and in the label
                  of every action beside it. */}
              <span
                className="min-w-0 flex-1 font-serif text-[17px] tracking-[-0.01em] break-words text-ink line-clamp-2"
                title={item.name}
              >
                {item.name}
              </span>
            </div>

            <div className="flex shrink-0 items-center gap-1 border-t border-dashed border-ink/12 pt-2 @min-[21rem]:ml-auto @min-[21rem]:border-0 @min-[21rem]:pt-0">
              <CountPill count={item.activeRecipeCount} />
              <RowAction
                label={`Rename ${item.name}`}
                icon={Pencil}
                onClick={() => {
                  setDraft(item.name);
                  setMessage(null);
                  setMode('renaming');
                }}
              />
              {onRecolor ? (
                <RowAction
                  label={`Colour ${item.name}`}
                  icon={Palette}
                  expanded={mode === 'coloring'}
                  onClick={() => {
                    setMessage(null);
                    setMode(mode === 'coloring' ? 'idle' : 'coloring');
                  }}
                />
              ) : null}
              <RowAction
                label={`Delete ${item.name}`}
                icon={Trash2}
                tone="danger"
                onClick={() => {
                  setMessage(null);
                  setMode('confirming');
                }}
              />
            </div>
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

// Making something is a step of its own now, not a form standing open under
// every list: the button sits in the heading, and the panel it opens is the
// only thing on the screen asking to be filled in.
function CreatePanel({
  label,
  submitLabel,
  placeholder,
  withColor = false,
  onCreate,
  onClose,
}: {
  label: string;
  submitLabel: string;
  placeholder: string;
  // A tag is given its colour where it is made, so the first thing a cook sees
  // after adding one is the tag as it will look everywhere else. A category has
  // no colour, so its panel is a name and two buttons.
  withColor?: boolean;
  onCreate: (name: string, color: string | null) => Promise<void>;
  onClose: () => void;
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
      // The panel stays open and empty: tags arrive in handfuls, and closing
      // after each one would make the second tag a second errand.
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
      className="cb-rise mb-3.5 rounded-[22px] border border-frost/70 bg-[rgba(var(--surface-rgb),0.78)] p-4 shadow-[0_12px_34px_-22px_color-mix(in_srgb,var(--ink)_50%,transparent)] motion-reduce:animate-none sm:p-5"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
      }}
    >
      <label className="mb-2 block font-serif text-[13px] italic text-ink-3" htmlFor={inputId}>
        {label}
      </label>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
        <Input
          autoFocus
          className="min-h-10 min-w-0 flex-1 rounded-full py-1.5 sm:max-w-60"
          id={inputId}
          placeholder={placeholder}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />

        {/* The colour commits as it is picked rather than behind its own Save:
            in here, the one button that commits anything is Add. */}
        {withColor ? (
          <ColorPicker commit="live" subject="the new tag" value={color} onSelect={setColor} />
        ) : null}

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Button disabled={busy} onClick={onClose} size="small" variant="quiet">
            Cancel
          </Button>
          <Button disabled={busy} size="small" type="submit" variant="primary">
            <Plus aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.4} />
            {submitLabel}
          </Button>
        </div>
      </div>

      {message ? (
        <div className="mt-2.5">
          <FieldError>{message}</FieldError>
        </div>
      ) : null}
    </form>
  );
}

// The button that opens a section's create panel. It says what will be made
// rather than "Add", so the two on this screen are told apart by name and not
// by which heading they happen to sit in.
function AddButton({
  kind,
  open,
  onToggle,
}: {
  kind: 'category' | 'tag';
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <Button aria-expanded={open} size="small" variant={open ? 'ghost' : 'primary'} onClick={onToggle}>
      <Plus
        aria-hidden="true"
        className={cn('h-3.5 w-3.5 transition-transform duration-200', open ? 'rotate-45' : '')}
        strokeWidth={2.4}
      />
      New {kind}
    </Button>
  );
}

// A section is the page itself rather than a card on it: two panels of glass
// holding two grids of glass rows was one material too many, and the rows are
// the thing to look at.
function Section({
  id,
  title,
  sub,
  count,
  action,
  children,
}: {
  id: string;
  title: string;
  sub: string;
  count: number;
  // The one thing this section can be told to do, at the end of its own
  // heading rather than at the bottom of its list.
  action: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="min-w-0">
      {/* Wide enough, the action ends the heading line. On a phone there is no
          room beside "Categories 6 One per recipe", and an action wrapped under
          the heading it belongs to sits closer to the first row of the list
          than to its own section - so it goes above the heading instead, by
          order rather than by markup: the heading is still read first. */}
      <div className="mb-3.5 flex flex-col items-start gap-2 px-0.5 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-3 sm:gap-y-1">
        <div className="order-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 sm:order-none sm:contents">
          <h2
            className="m-0 font-serif text-[24px] leading-none font-normal tracking-[-0.02em] text-ink sm:text-[27px]"
            id={id}
          >
            {title}
          </h2>
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-ink/6 px-2 font-mono text-[11px] text-ink-3">
            {count}
          </span>
          <span className="font-serif text-sm italic text-ink-3">{sub}</span>
        </div>
        <span className="order-1 sm:order-none sm:ml-auto">{action}</span>
      </div>

      {children}
    </section>
  );
}

// Rows sit two to a line where there is room. `items-start` so a row that has
// opened its colours or its delete confirmation grows on its own rather than
// stretching the one beside it.
const GRID = 'm-0 grid list-none grid-cols-1 items-start gap-2.5 p-0 sm:grid-cols-2';

export function OrganizePage() {
  const loadCategories = useCallback((signal: AbortSignal) => listCategories(signal), []);
  const loadTags = useCallback((signal: AbortSignal) => listTags(signal), []);

  const categories = useApiResource(loadCategories, []);
  const tags = useApiResource(loadTags, []);

  // Creating and deleting change what is in a list and how much uses the rest
  // of it, so those refetch. Renaming and recolouring change neither: the
  // response already says what the row became, so it is written straight into
  // the row and nothing else on the screen moves.
  const afterCategoryChange = async (run: Promise<unknown>) => {
    await run;
    categories.reload();
  };

  const afterTagChange = async (run: Promise<unknown>) => {
    await run;
    tags.reload();
  };

  const applyTagEdit = async (run: Promise<TagRecord>) => {
    const tag = await run;
    tags.apply((list) =>
      list.map((row) => (row.id === tag.id ? { ...row, name: tag.name, color: tag.color } : row)),
    );
  };

  const applyCategoryRename = async (run: Promise<OrganizationRecord>) => {
    const category = await run;
    categories.apply((list) =>
      list.map((row) => (row.id === category.id ? { ...row, name: category.name } : row)),
    );
  };

  // One panel at a time: two open forms on a screen whose job is to list what
  // already exists is two things asking to be filled in.
  const [adding, setAdding] = useState<'category' | 'tag' | null>(null);

  const error = categories.error ?? tags.error;
  // Only the first load has nothing to show. A refetch behind an already-drawn
  // list keeps the list: replacing it with the skeleton would throw the screen
  // away to redraw the one row that changed.
  const loading = (categories.loading && !categories.data) || (tags.loading && !tags.data);

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
          <Section
            action={
              <AddButton
                kind="category"
                open={adding === 'category'}
                onToggle={() => setAdding(adding === 'category' ? null : 'category')}
              />
            }
            count={(categories.data ?? []).length}
            id="organize-categories"
            sub="One per recipe"
            title="Categories"
          >
            {adding === 'category' ? (
              <CreatePanel
                label="New category"
                placeholder="e.g. Breakfast"
                submitLabel="Add category"
                onClose={() => setAdding(null)}
                onCreate={(name) => afterCategoryChange(createCategory(name))}
              />
            ) : null}

            <ul className={GRID}>
              {(categories.data ?? []).map((category) => (
                <ManagedRow
                  key={category.id}
                  item={category}
                  kind="category"
                  deleteWarning={`Delete "${category.name}"? This only works while no recipe, live or in Trash, is filed under it.`}
                  onRename={(id, name) => applyCategoryRename(renameCategory(id, name))}
                  onDelete={(id) => afterCategoryChange(deleteCategory(id))}
                />
              ))}
            </ul>
          </Section>

          <Section
            action={
              <AddButton
                kind="tag"
                open={adding === 'tag'}
                onToggle={() => setAdding(adding === 'tag' ? null : 'tag')}
              />
            }
            count={(tags.data ?? []).length}
            id="organize-tags"
            sub="As many as you like"
            title="Tags"
          >
            {adding === 'tag' ? (
              <CreatePanel
                withColor
                label="New tag"
                placeholder="e.g. Weeknight"
                submitLabel="Add tag"
                onClose={() => setAdding(null)}
                onCreate={(name, color) => afterTagChange(createTagRequest(name, color))}
              />
            ) : null}

            {(tags.data ?? []).length === 0 ? (
              <FieldHint>No tags yet. Add one here, or create one while writing a recipe.</FieldHint>
            ) : (
              <ul className={GRID}>
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
                    onRename={(id, name) => applyTagEdit(updateTag(id, { name }))}
                    onDelete={(id) => afterTagChange(deleteTag(id))}
                    onRecolor={(id, color) =>
                      applyTagEdit(updateTag(id, { name: tag.name, color }))
                    }
                  />
                ))}
              </ul>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
