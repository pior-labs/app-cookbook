import { useState } from 'react';
import {
  formatQuantity,
  groceryItemText,
  groceryListText,
  UNIT_DEFINITIONS,
  type GroceryItem,
  type GroceryList as GroceryListData,
} from '@cookbook/domain';
import { apiSend } from '../api/client.js';
import { cn } from '@/lib/utils';
import {
  Button,
  Input,
  MenuDivider,
  MenuItem,
  OverflowMenu,
  Panel,
  SectionHeading,
  Select,
  Textarea,
} from '@/components/ui';
import { PlanningDialog, PlanningError, usePlanningAction, usePlanningResource } from './shared.js';

// A plan's one grocery list, drawn inside the plan it belongs to. There used to
// be a separate list screen, reached from a panel of "Latest list" and
// "Earlier list 2" buttons; with one list per plan (ADR 0010) the list is part
// of the plan, and the plan page is where it is shopped from.
//
// - `edit`: the list as it stands once the plan is saved, every control out.
// - `shopping`: read at arm's length in a shop. Bigger, and only the tick.
// - `readonly`: the week is done. Kept to look back on, and to copy.

export type GroceryListMode = 'edit' | 'shopping' | 'readonly';

// What a rebuild says about an item it could not carry forward as it was.
const CHANGED_SINCE: Record<NonNullable<GroceryItem['changedSince']>, string> = {
  edited: 'Your meals changed since you edited this, so it shows the new amount.',
  ticked: 'Your meals changed since you ticked this off. Check you have enough.',
  removed: 'You removed this earlier, but your meals now need a different amount.',
};

// The amount on its own, so the name can lead the row. In a shop you look for
// the thing first and check how much second.
function amountText(item: Pick<GroceryItem, 'quantity' | 'unitCode' | 'unitText'>): string {
  return [item.quantity ? formatQuantity(item.quantity) : '', item.unitCode ?? item.unitText ?? '']
    .filter(Boolean)
    .join(' ');
}

// Which meals an item is for, in one quiet line. It answers "why is this on my
// list" at a glance, which is what the old "Where this comes from" toggle made
// every row spend a line asking. The per-recipe amounts are in the edit
// dialog, the one moment they are needed.
function captionFor(item: GroceryItem): string {
  if (!item.sources.length) return 'Added by you';
  const meals = [...new Set(item.sources.map((s) => s.recipeName))].join(' · ');
  return item.edited ? `${meals} · amount edited` : meals;
}

function ItemEditor({
  item,
  busy,
  error,
  onSave,
  onClose,
}: {
  item: GroceryItem | null;
  busy: boolean;
  error: string;
  onSave: (value: {
    name: string;
    quantity: string;
    unitCode: string | null;
    unitText: string | null;
    checked: boolean;
  }) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(item?.name ?? '');
  const [quantity, setQuantity] = useState(
    // "4 1/2", the way it was typed, rather than "9/2".
    item?.quantity ? formatQuantity(item.quantity, { unicode: false }) : '',
  );
  const [unit, setUnit] = useState(item?.unitText ? 'custom' : (item?.unitCode ?? ''));
  const [custom, setCustom] = useState(item?.unitText ?? '');
  return (
    <PlanningDialog title={item ? 'Edit grocery item' : 'Add an item'} onClose={onClose}>
      {item?.sources.length ? (
        <section className="mb-5 rounded-2xl bg-[var(--cb-muted-track)] px-4 py-3">
          <h3 className="m-0 text-[13px] font-medium text-ink-2">What the meals asked for</h3>
          <ul className="m-0 mt-1.5 list-none p-0">
            {item.sources.map((source) => (
              <li key={source.key} className="flex justify-between gap-4 py-1 text-[14px]">
                <span className="min-w-0 text-ink">
                  {source.recipeName}
                  {source.preparation ? (
                    <span className="text-ink-3">, {source.preparation}</span>
                  ) : null}
                </span>
                <span className="shrink-0 text-ink-2 tabular-nums">
                  {amountText(source) || 'as needed'}
                </span>
              </li>
            ))}
          </ul>
          {item.edited ? (
            <p className="mt-1.5 mb-0 text-[12.5px] text-ink-3">
              The amount on your list is your own edit.
            </p>
          ) : null}
        </section>
      ) : null}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            name,
            quantity,
            unitCode: unit && unit !== 'custom' ? unit : null,
            unitText: unit === 'custom' ? custom : null,
            checked: item?.checked ?? false,
          });
        }}
      >
        <fieldset disabled={busy} className="m-0 flex flex-col gap-4 border-0 p-0">
          <label>
            Item name
            <Input
              required
              maxLength={160}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Milk, bananas, paper towels…"
            />
          </label>
          <label>
            Quantity (optional)
            <Input
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="1, 0.5, or 1 1/2"
            />
          </label>
          <label>
            Unit
            <Select value={unit} onChange={(e) => setUnit(e.target.value)}>
              <option value="">No unit / count</option>
              {UNIT_DEFINITIONS.map((unit) => (
                <option key={unit.code} value={unit.code}>
                  {unit.plural}
                </option>
              ))}
              <option value="custom">Custom unit</option>
            </Select>
          </label>
          {unit === 'custom' ? (
            <label>
              Custom unit
              <Input
                required
                maxLength={40}
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="bunch, can, pack"
              />
            </label>
          ) : null}
          <PlanningError error={error} />
          <Button type="submit" variant="primary">
            {busy ? 'Saving…' : item ? 'Save changes' : 'Add item'}
          </Button>
        </fieldset>
      </form>
    </PlanningDialog>
  );
}

// Progress a shopper can read across a trolley: a bar, not a fraction.
function Progress({ left, total }: { left: number; total: number }) {
  const done = total - left;
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <div
        className="h-2 min-w-16 flex-1 overflow-hidden rounded-full bg-[var(--cb-muted-track)]"
        role="progressbar"
        aria-label="Items ticked off"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
      >
        <div
          className="h-full rounded-full bg-ink transition-[width] duration-300 ease-out motion-reduce:transition-none"
          style={{ width: total ? `${(done / total) * 100}%` : '0%' }}
        />
      </div>
      <p className="m-0 shrink-0 text-[13px] text-ink-2 tabular-nums">
        {left ? `${left} of ${total} left` : 'All ticked off'}
      </p>
    </div>
  );
}

export function GroceryList({
  listId,
  mode,
  rebuilding,
}: {
  listId: number;
  mode: GroceryListMode;
  // The plan was reopened. The list stays usable, and says it will update.
  rebuilding: boolean;
}) {
  const [editing, setEditing] = useState<GroceryItem | null | undefined>(undefined);
  const [copyText, setCopyText] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const action = usePlanningAction();
  const path = `/api/grocery-lists/${listId}`;
  const resource = usePlanningResource<GroceryListData>(path);
  const list = resource.data;
  const setList = (updated: GroceryListData) => resource.apply(() => updated);
  const load = () => {
    action.clearError();
    resource.reload();
  };

  if (!list || resource.loading || resource.error)
    return (
      <section aria-label="Grocery list" className="flex flex-col gap-4">
        <PlanningError error={resource.error?.message || action.error} reload={load} />
        {!resource.error && !action.error ? (
          <p className="m-0 text-ink-2" role="status">
            Loading grocery list…
          </p>
        ) : null}
      </section>
    );

  const mutate = (suffix: string, method: 'POST' | 'PUT' | 'DELETE', body: object) =>
    action.run(async () =>
      setList(await apiSend(path + suffix, method, { ...body, version: list.version })),
    );
  const editable = mode === 'edit';
  const tickable = mode !== 'readonly';
  const remaining = list.items.filter((item) => !item.checked);
  const completed = list.items.filter((item) => item.checked);

  const copy = () => {
    const text = groceryListText(list.items);
    void (async () => {
      try {
        await navigator.clipboard.writeText(text);
        setNotice('Grocery list copied.');
      } catch {
        setCopyText(text);
      }
    })();
  };

  return (
    <section aria-labelledby="grocery-list-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-x-5 gap-y-3">
        <SectionHeading id="grocery-list-heading" className={mode === 'shopping' ? 'sr-only' : ''}>
          Grocery list
        </SectionHeading>
        <div className="flex flex-wrap gap-2">
          {tickable ? (
            <Button size="small" disabled={action.busy} onClick={() => setEditing(null)}>
              Add item
            </Button>
          ) : null}
          <Button size="small" onClick={copy}>
            Copy list
          </Button>
        </div>
      </div>
      {list.items.length ? <Progress left={remaining.length} total={list.items.length} /> : null}

      <PlanningError error={editing === undefined ? action.error : ''} reload={load} />
      <p className="sr-only" role="status">
        {notice}
      </p>
      {notice ? <p className="m-0 text-[14px] text-ink-2">{notice}</p> : null}

      {rebuilding ? (
        <Panel className="py-4 sm:py-5">
          <p className="m-0 text-[14px] text-ink-2">
            The meals are being changed. You can keep using this list, and saving the plan
            updates it while keeping what you have ticked off or added.
          </p>
        </Panel>
      ) : null}
      {editable && list.normalization === 'fallback' ? (
        <Panel className="py-4 sm:py-5">
          <p className="m-0 text-[14px] text-ink-2">
            AI ingredient matching was unavailable. This list uses exact names, so similar
            ingredients may appear separately.
          </p>
        </Panel>
      ) : null}

      {/* Folded, so a handful of questions never pushes the list itself below
          the fold. The list is what someone opened this to read. */}
      {editable && list.suggestions.length ? (
        <details className="theme-glass rounded-[26px] px-5 py-1 sm:px-6">
          <summary className="min-h-12 cursor-pointer py-3 font-serif text-[17px] text-ink">
            {list.suggestions.length === 1
              ? '1 possible duplicate'
              : `${list.suggestions.length} possible duplicates`}
            <span className="ml-2 font-sans text-[13px] text-ink-3">Review</span>
          </summary>
          <ul className="m-0 flex list-none flex-col gap-4 p-0 pb-4">
            {list.suggestions.map((suggestion) => (
              <li key={suggestion.id} className="border-t border-dashed border-ink/15 pt-4">
                <p className="m-0 text-ink">
                  {list.items
                    .filter((i) => suggestion.itemIds.includes(i.id))
                    .map((i) => groceryItemText(i))
                    .join(' + ')}
                </p>
                <p className="mt-1 mb-0 text-[14px] text-ink-2">
                  Merge as “{suggestion.canonicalName}”?
                  {suggestion.reason ? ` ${suggestion.reason}` : ''}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button
                    size="small"
                    disabled={action.busy}
                    onClick={() =>
                      void mutate(`/suggestions/${suggestion.id}`, 'PUT', { merge: true })
                    }
                  >
                    Merge
                  </Button>
                  <Button
                    size="small"
                    disabled={action.busy}
                    onClick={() =>
                      void mutate(`/suggestions/${suggestion.id}`, 'PUT', { merge: false })
                    }
                  >
                    Keep separate
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {[
        { title: 'To buy', items: remaining },
        { title: 'Ticked off', items: completed },
      ].map((section) =>
        section.items.length ? (
          <div key={section.title}>
            <h3 className="mt-0 mb-2 font-serif text-[20px] font-normal text-ink">
              {section.title}
            </h3>
            <ul className="m-0 list-none rounded-[26px] bg-[rgba(var(--surface-rgb),0.94)] px-4 py-1 sm:px-6">
              {section.items.map((item) => {
                const amount = amountText(item);
                const caption = mode === 'shopping' || item.checked ? null : captionFor(item);
                return (
                  <li
                    key={item.id}
                    className="flex items-center gap-2 border-b border-dashed border-ink/12 last:border-0"
                  >
                    <label
                      className={cn(
                        'flex min-h-14 min-w-0 flex-1 items-center gap-4 py-2.5',
                        tickable ? 'cursor-pointer' : '',
                      )}
                    >
                      <input
                        type="checkbox"
                        className="h-6 w-6 shrink-0 accent-ink"
                        // Read aloud the way it would be said: "2 paper towels".
                        aria-label={groceryItemText(item)}
                        // The meals it is for, and any warning, are read after
                        // the name rather than lost with the visual layout.
                        aria-describedby={
                          [caption ? `item-${item.id}-for` : '', item.changedSince ? `item-${item.id}-changed` : '']
                            .filter(Boolean)
                            .join(' ') || undefined
                        }
                        disabled={!tickable || action.busy}
                        checked={item.checked}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          // Respond under the shopper's finger; restore the last saved
                          // state if the write fails so an offline check never looks saved.
                          setList({
                            ...list,
                            items: list.items.map((i) =>
                              i.id === item.id ? { ...i, checked, changedSince: undefined } : i,
                            ),
                          });
                          void (async () => {
                            if (!(await mutate(`/items/${item.id}/checked`, 'PUT', { checked })))
                              setList(list);
                          })();
                        }}
                      />
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        {/* Hidden from screen readers only because the checkbox
                            already says it, in speaking order. */}
                        <span className="flex items-baseline justify-between gap-4" aria-hidden="true">
                          <span
                            className={cn(
                              'block min-w-0 first-letter:uppercase',
                              mode === 'shopping' ? 'text-xl' : 'text-[17px]',
                              item.checked ? 'text-ink-3 line-through' : 'text-ink',
                            )}
                          >
                            {item.name}
                          </span>
                          {amount ? (
                            <span
                              className={cn(
                                'shrink-0 tabular-nums',
                                mode === 'shopping' ? 'text-lg' : 'text-[15px]',
                                item.checked ? 'text-ink-3' : 'text-ink-2',
                              )}
                            >
                              {amount}
                            </span>
                          ) : null}
                        </span>
                        {caption ? (
                          <span id={`item-${item.id}-for`} className="truncate text-[12.5px] text-ink-3">
                            {caption}
                          </span>
                        ) : null}
                        {/* Said wherever the list is read, shopping included: a
                            tick that no longer covers the amount matters most
                            in the shop. */}
                        {item.changedSince ? (
                          <span
                            id={`item-${item.id}-changed`}
                            className="text-[12.5px] text-[var(--cb-danger-ink-strong)]"
                          >
                            {CHANGED_SINCE[item.changedSince]}
                          </span>
                        ) : null}
                      </span>
                    </label>
                    {editable ? (
                      <OverflowMenu
                        label={`Options for ${item.name}`}
                        disabled={action.busy}
                        size="small"
                        quiet
                      >
                        <MenuItem onSelect={() => setEditing(item)}>Edit</MenuItem>
                        <MenuDivider />
                        <MenuItem
                          tone="danger"
                          onSelect={() => void mutate(`/items/${item.id}`, 'DELETE', {})}
                        >
                          Remove
                        </MenuItem>
                      </OverflowMenu>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null,
      )}
      {!list.items.length ? (
        <Panel>
          <p className="m-0 text-ink-2">
            The list is empty. Add anything you need for the next shop.
          </p>
        </Panel>
      ) : null}

      {editing !== undefined ? (
        <ItemEditor
          item={editing}
          busy={action.busy}
          error={action.error}
          onClose={() => setEditing(undefined)}
          onSave={(value) => {
            void (async () => {
              const ok = await mutate(
                editing ? `/items/${editing.id}` : '/items',
                editing ? 'PUT' : 'POST',
                value,
              );
              if (ok) setEditing(undefined);
            })();
          }}
        />
      ) : null}
      {copyText != null ? (
        <PlanningDialog title="Copy grocery list" onClose={() => setCopyText(null)}>
          <p>Clipboard access isn’t available. Select and copy the text below.</p>
          <Textarea
            aria-label="Grocery list text"
            readOnly
            value={copyText}
            onFocus={(e) => e.target.select()}
          />
        </PlanningDialog>
      ) : null}
    </section>
  );
}
