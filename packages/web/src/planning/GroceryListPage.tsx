import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  formatQuantity,
  groceryItemText,
  groceryListText,
  UNIT_DEFINITIONS,
  type GroceryItem,
  type GroceryList,
  type MealPlan,
} from '@cookbook/domain';
import { apiGet, apiSend } from '../api/client.js';
import { useCookMode } from '@/components/CookMode';
import { Button, ButtonLink, Input, PageHeader, Panel, Select, Textarea } from '@/components/ui';
import { PlanningDialog, PlanningError, usePlanningAction, usePlanningResource } from './shared.js';

function ItemEditor({
  item,
  busy,
  onSave,
  onClose,
}: {
  item: GroceryItem | null;
  busy: boolean;
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
    item?.quantity ? `${item.quantity.numerator}/${item.quantity.denominator}` : '',
  );
  const [unit, setUnit] = useState(item?.unitText ? 'custom' : (item?.unitCode ?? ''));
  const [custom, setCustom] = useState(item?.unitText ?? '');
  return (
    <PlanningDialog title={item ? 'Edit grocery item' : 'Add an item'} onClose={onClose}>
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
          <Button type="submit" variant="primary">
            {busy ? 'Saving…' : item ? 'Save changes' : 'Add item'}
          </Button>
        </fieldset>
      </form>
    </PlanningDialog>
  );
}

export function GroceryListPage() {
  const { id } = useParams();
  const [shopping, setShopping] = useState(false);
  const [editing, setEditing] = useState<GroceryItem | null | undefined>(undefined);
  const [copyText, setCopyText] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [regenerate, setRegenerate] = useState(false);
  const action = usePlanningAction();
  const { setCooking } = useCookMode();
  const navigate = useNavigate();
  const path = `/api/grocery-lists/${id}`;
  const resource = usePlanningResource<GroceryList>(path);
  const list = resource.data;
  const setList = (updated: GroceryList) => resource.apply(() => updated);
  const load = () => {
    action.clearError();
    resource.reload();
  };
  useEffect(() => {
    setCooking(shopping);
    return () => setCooking(false);
  }, [shopping, setCooking]);
  if (!list || resource.loading || resource.error)
    return (
      <>
        <PlanningError error={resource.error?.message || action.error} reload={load} />
        {!resource.error && !action.error ? <p role="status">Loading grocery list…</p> : null}
      </>
    );
  const mutate = (suffix: string, method: 'POST' | 'PUT' | 'DELETE', body: object) =>
    action.run(async () =>
      setList(await apiSend(path + suffix, method, { ...body, version: list.version })),
    );
  const remaining = list.items.filter((item) => !item.checked);
  const completed = list.items.filter((item) => item.checked);
  return (
    <div className="flex flex-col gap-5">
      {!shopping ? (
        <ButtonLink to={`/meal-plans/${list.mealPlanId}`}>Back to meal plan</ButtonLink>
      ) : null}
      <PageHeader
        title={shopping ? 'Shopping' : 'Grocery list'}
        lede={`${remaining.length} of ${list.items.length} items remaining`}
        actions={
          <Button onClick={() => setShopping(!shopping)}>
            {shopping ? 'Done shopping' : 'Shopping mode'}
          </Button>
        }
      />
      <PlanningError error={editing === undefined ? action.error : ''} reload={load} />
      <p className="sr-only" role="status">
        {notice}
      </p>
      {notice ? <p className="text-ink-2">{notice}</p> : null}
      {!shopping && list.normalization === 'fallback' ? (
        <Panel>
          AI ingredient matching was unavailable. This list uses exact names; similar ingredients
          may appear separately.
        </Panel>
      ) : null}
      {!shopping &&
        list.suggestions.map((suggestion) => (
          <Panel key={suggestion.id}>
            <h2 className="font-serif text-xl">Possible duplicate</h2>
            <p>
              {list.items
                .filter((i) => suggestion.itemIds.includes(i.id))
                .map((i) => groceryItemText(i))
                .join(' + ')}
            </p>
            <p>Merge as “{suggestion.canonicalName}”?</p>
            {suggestion.reason ? <p className="text-sm text-ink-2">{suggestion.reason}</p> : null}
            <div className="flex gap-2">
              <Button
                disabled={action.busy}
                onClick={() => void mutate(`/suggestions/${suggestion.id}`, 'PUT', { merge: true })}
              >
                Merge
              </Button>
              <Button
                disabled={action.busy}
                onClick={() =>
                  void mutate(`/suggestions/${suggestion.id}`, 'PUT', { merge: false })
                }
              >
                Keep separate
              </Button>
            </div>
          </Panel>
        ))}
      {[
        { title: 'To buy', items: remaining },
        { title: 'Completed', items: completed },
      ].map((section) =>
        section.items.length ? (
          <section key={section.title}>
            <h2 className="font-serif text-2xl">{section.title}</h2>
            <ul className="m-0 list-none rounded-[26px] bg-[rgba(var(--surface-rgb),0.94)] px-4 py-2 sm:px-6">
              {section.items.map((item) => (
                <li
                  key={item.id}
                  className="border-b border-dashed border-ink/15 py-3 last:border-0"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="flex min-h-14 min-w-0 flex-1 cursor-pointer items-center gap-4">
                      <input
                        type="checkbox"
                        className="h-6 w-6 shrink-0 accent-ink"
                        disabled={action.busy}
                        checked={item.checked}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          // Respond under the shopper's finger; restore the last saved
                          // state if the write fails so an offline check never looks saved.
                          setList({
                            ...list,
                            items: list.items.map((i) =>
                              i.id === item.id ? { ...i, checked } : i,
                            ),
                          });
                          void (async () => {
                            if (!(await mutate(`/items/${item.id}/checked`, 'PUT', { checked })))
                              setList(list);
                          })();
                        }}
                      />
                      <span
                        className={`${shopping ? 'text-xl' : 'text-lg'} ${item.checked ? 'text-ink-3 line-through' : 'text-ink'}`}
                      >
                        {groceryItemText(item)}
                      </span>
                    </label>
                    {!shopping ? (
                      <div className="flex gap-1">
                        <Button
                          size="small"
                          disabled={action.busy}
                          aria-label={`Edit ${item.name}`}
                          onClick={() => setEditing(item)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="small"
                          disabled={action.busy}
                          aria-label={`Remove ${item.name}`}
                          onClick={() => void mutate(`/items/${item.id}`, 'DELETE', {})}
                        >
                          Remove
                        </Button>
                      </div>
                    ) : null}
                  </div>
                  {!shopping && item.sources.length ? (
                    <details className="ml-10 text-sm text-ink-2">
                      <summary className="min-h-11 cursor-pointer py-3">
                        Where this comes from{item.edited ? ' · manually edited' : ''}
                      </summary>
                      {item.edited ? (
                        <p>
                          Original recipe contributions below; the current quantity includes your
                          edits.
                        </p>
                      ) : null}
                      <ul>
                        {item.sources.map((source) => (
                          <li className="py-1" key={source.key}>
                            {source.recipeName} —{' '}
                            {source.quantity ? formatQuantity(source.quantity) : 'as needed'}{' '}
                            {source.unitCode ?? source.unitText} {source.name}
                            {source.preparation ? `, ${source.preparation}` : ''}
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null,
      )}
      {!list.items.length ? (
        <Panel>Your list is empty. Add anything you need for the next shop.</Panel>
      ) : null}
      <div className="sticky bottom-3 flex flex-wrap gap-2 rounded-3xl border border-frost/80 bg-cream/95 p-4 shadow-lg">
        <Button variant="primary" disabled={action.busy} onClick={() => setEditing(null)}>
          Add item
        </Button>
        <Button
          onClick={() => {
            const text = groceryListText(list.items);
            void (async () => {
              try {
                await navigator.clipboard.writeText(text);
                setNotice('Grocery list copied.');
              } catch {
                setCopyText(text);
              }
            })();
          }}
        >
          Copy list
        </Button>
        {/* "Regenerate list", not "Regenerate": the meal plan one screen away
            has its own regenerate, and that one replaces the meals. Two
            different actions must not share one name. */}
        {!shopping ? (
          <Button disabled={action.busy} onClick={() => setRegenerate(true)}>
            Regenerate list
          </Button>
        ) : null}
      </div>
      {editing !== undefined ? (
        <>
          <ItemEditor
            item={editing}
            busy={action.busy}
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
          {action.error ? (
            <div
              className="fixed inset-x-4 bottom-2 z-[60] rounded-xl bg-cream p-3 text-ink"
              role="alert"
            >
              {action.error}
            </div>
          ) : null}
        </>
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
      {regenerate ? (
        <PlanningDialog title="Generate a fresh list?" onClose={() => setRegenerate(false)}>
          <p>
            This uses the latest meals, serving counts, and recipes. Your current list and its edits
            will remain available from the meal plan.
          </p>
          <PlanningError error={action.error} />
          <Button
            disabled={action.busy}
            variant="primary"
            onClick={() =>
              void action.run(async () => {
                const plan = await apiGet<MealPlan>(`/api/meal-plans/${list.mealPlanId}`);
                const generated = await apiSend<GroceryList>(
                  `/api/meal-plans/${list.mealPlanId}/grocery-lists`,
                  'POST',
                  { version: plan.version },
                );
                setRegenerate(false);
                setList(generated);
                navigate(`/grocery-lists/${generated.id}`);
              })
            }
          >
            {action.busy ? 'Generating…' : 'Generate fresh list'}
          </Button>
        </PlanningDialog>
      ) : null}
    </div>
  );
}
