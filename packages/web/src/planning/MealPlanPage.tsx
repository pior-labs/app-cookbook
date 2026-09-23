import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, ShoppingBasket, Sparkles } from 'lucide-react';
import type { MealPlan } from '@cookbook/domain';
import { apiSend } from '../api/client.js';
import { useCookMode } from '@/components/CookMode';
import { BrowsePage } from '../discovery/BrowsePage.js';
import { RecipeCardSkeleton } from '../discovery/RecipeCard.js';
import { EmptyState } from '../recipes/states.js';
import {
  BackButton,
  Breadcrumb,
  Button,
  Input,
  MenuDivider,
  MenuItem,
  OverflowMenu,
  PageHeader,
  SectionHeading,
} from '@/components/ui';
import { DeletePlanDialog, PlanNameDialog } from './dialogs.js';
import { GroceryList } from './GroceryList.js';
import { MealCard } from './MealCard.js';
import { MealStrip } from './MealStrip.js';
import { Recommendations } from './Recommendations.js';
import { PlanningError, usePlanningAction, usePlanningResource } from './shared.js';

// One page for the whole life of a plan (ADR 0010). While it is a draft the
// page is for choosing meals, and saving it is the one thing it asks for. Once
// saved it is the grocery list, with the meals stepped back to a strip above
// it. The sticky bar always holds the one thing to do next.

// The bar that follows the plan down the page. Glass, like every other floating
// surface in the app.
const STICKY_BAR =
  'sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-4xl ' +
  'border border-frost/80 bg-[rgba(var(--surface-rgb),0.82)] py-3 pr-3 pl-5 ' +
  'shadow-[var(--cb-menu-shadow)] backdrop-blur-xl backdrop-saturate-150';

function onDay(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : ` ${date.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}`;
}

// Where the plan is, said once above its name.
function stageLine(plan: MealPlan): string {
  if (plan.status === 'done') return `Done${onDay(plan.completedAt)}`;
  if (plan.status === 'confirmed') return `Saved${onDay(plan.confirmedAt)}`;
  return plan.groceryListId != null ? 'Changing the meals' : 'Planning';
}

// Servings is the one control a cook touches repeatedly, and a round trip per
// tap leaves the number lagging the finger while every other control on the
// page sits disabled. The card takes each tap immediately and the plan is
// written once the tapping settles, which also stops three quick taps racing
// each other for the same plan version. A write that fails reloads the plan,
// so an unsaved number never stays on screen looking saved.
const SERVINGS_SETTLE_MS = 500;

export function MealPlanPage() {
  const { id } = useParams();
  const [choosing, setChoosing] = useState<number | 'add' | null>(null);
  const [servings, setServings] = useState(2);
  const [help, setHelp] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [shopping, setShopping] = useState(false);
  const [notice, setNotice] = useState('');
  const [listWasRebuilt, setListWasRebuilt] = useState(false);
  const action = usePlanningAction();
  const navigate = useNavigate();
  const { setCooking } = useCookMode();
  const path = `/api/meal-plans/${id}`;
  const resource = usePlanningResource<MealPlan>(path);
  const plan = resource.data;

  // Shopping is cook mode for a trolley: the navigation goes, the screen stays
  // awake, and the room calms. Only while there is a list to shop from.
  const inShop = shopping && plan?.groceryListId != null && plan.status !== 'done';
  useEffect(() => {
    setCooking(inShop);
    return () => setCooking(false);
  }, [inShop, setCooking]);

  // The committing loop reads the version the last write returned rather than
  // the one this render closed over, so a queued tap is never stale.
  const latest = useRef<MealPlan | null>(null);
  latest.current = plan;
  const targets = useRef(new Map<number, number>());
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const setPlan = (updated: MealPlan) => {
    latest.current = updated;
    resource.apply(() => updated);
  };
  const load = () => {
    action.clearError();
    resource.reload();
  };

  // Writes whatever the cook has tapped but not yet saved, and resolves only
  // once it has landed. Every other action on the page goes through this
  // first, so a tap can never be overtaken - and then discarded - by the
  // action the cook took right after it. Saving the plan most of all: a tap
  // that missed the save would be missing from the list.
  const flushServings = async (): Promise<boolean> => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    const queued = [...targets.current.entries()];
    targets.current.clear();
    if (!queued.length) return true;

    const ok = await action.run(async () => {
      for (const [itemId, count] of queued) {
        const version = latest.current?.version;
        if (version == null) return;
        setPlan(
          await apiSend<MealPlan>(`${path}/items/${itemId}`, 'PUT', { servings: count, version }),
        );
      }
    });
    if (!ok) resource.reload();
    return ok;
  };

  const changeServings = (itemId: number, count: number) => {
    resource.apply((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === itemId ? { ...item, servings: count } : item)),
    }));
    targets.current.set(itemId, count);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flushServings(), SERVINGS_SETTLE_MS);
  };

  const openHelp = () => void flushServings().then(() => setHelp(true));

  if (!plan || resource.loading || resource.error)
    return (
      <div className="flex flex-col gap-6">
        <PlanningError error={resource.error?.message || action.error} reload={load} />
        {!resource.error && !action.error ? (
          <RecipeCardSkeleton count={2} label="Loading meal plan…" />
        ) : null}
      </div>
    );

  const mutate = async (suffix: string, method: 'POST' | 'PUT' | 'DELETE', body: object) => {
    if (!(await flushServings())) return false;
    return action.run(async () => {
      const version = latest.current?.version;
      if (version == null) return;
      setPlan(await apiSend(path + suffix, method, { ...body, version }));
    });
  };

  if (choosing != null)
    return (
      <div className="flex flex-col gap-5">
        <BackButton onClick={() => setChoosing(null)}>Back to meal plan</BackButton>
        <PageHeader
          title={choosing === 'add' ? 'Add a meal' : 'Change this meal'}
          lede="Pick a recipe. You can change the servings on the card afterwards."
          actions={
            <label className="flex items-center gap-2 text-[13px] text-ink-2">
              Planned servings
              <Input
                aria-label="Planned servings"
                type="number"
                min={1}
                max={100}
                className="w-20"
                value={servings}
                onChange={(e) => setServings(Number(e.target.value))}
              />
            </label>
          }
        />
        <PlanningError error={action.error} reload={load} />
        <fieldset disabled={action.busy} className="m-0 min-w-0 border-0 p-0">
          <BrowsePage
            onSelect={(recipe) => {
              void (async () => {
                const ok = await mutate(
                  choosing === 'add' ? '/items' : `/items/${choosing}`,
                  choosing === 'add' ? 'POST' : 'PUT',
                  { recipeId: recipe.id, servings },
                );
                if (ok) setChoosing(null);
              })();
            }}
          />
        </fieldset>
      </div>
    );

  const draft = plan.status === 'draft';
  const listId = plan.groceryListId;
  const addMeal = () => {
    setServings(2);
    setChoosing('add');
  };
  const totalServings = plan.items.reduce((sum, item) => sum + item.servings, 0);

  const save = () =>
    void (async () => {
      setNotice('');
      const rebuilding = listId != null;
      if (await mutate('/confirm', 'POST', {})) {
        setListWasRebuilt(rebuilding);
        setNotice(
          rebuilding
            ? 'Saved. Your grocery list is updated, and what you had ticked off is kept.'
            : 'Saved. Your grocery list is ready.',
        );
      }
    })();
  const step = (suffix: '/reopen' | '/complete' | '/resume') =>
    void (async () => {
      setNotice('');
      await mutate(suffix, 'POST', {});
    })();

  const lede = inShop
    ? null
    : draft
      ? "Choose meals and set your servings. When you're happy, save the plan and it becomes your grocery list."
      : plan.status === 'confirmed'
        ? 'Your meals are set and your grocery list is ready.'
        : 'This plan is done. Its list is kept to look back on.';

  return (
    <div className="flex flex-col gap-6">
      {!inShop ? <Breadcrumb to="/meal-plans">All meal plans</Breadcrumb> : null}
      <PageHeader
        kicker={inShop ? plan.name || 'Your meal plan' : stageLine(plan)}
        title={inShop ? 'Shopping' : plan.name || 'Your meal plan'}
        lede={lede}
        // These act on the plan itself rather than on what is in it, so they
        // sit against its name rather than out with the page's actions.
        titleAction={
          inShop ? null : (
            <OverflowMenu label="Meal plan options" disabled={action.busy}>
              <MenuItem
                onSelect={() => {
                  action.clearError();
                  setRenaming(true);
                }}
              >
                Rename plan
              </MenuItem>
              {/* Deliberately a menu item rather than a button on the page: a
                  saved plan is meant to stay saved, and changing it is the
                  exception. Nothing is lost by it, so it does not ask. */}
              {plan.status === 'confirmed' ? (
                <>
                  <MenuItem onSelect={() => step('/reopen')}>Edit plan</MenuItem>
                  <MenuItem onSelect={() => step('/complete')}>Mark as done</MenuItem>
                </>
              ) : null}
              <MenuDivider />
              <MenuItem
                tone="danger"
                onSelect={() => {
                  action.clearError();
                  setDeleting(true);
                }}
              >
                Delete plan
              </MenuItem>
            </OverflowMenu>
          )
        }
        // An empty draft offers "Help me choose" inside its own panel, next to
        // the alternative. Offering it twice on one screen would only make a
        // cook wonder whether the two differ.
        actions={
          draft && plan.items.length ? (
            <Button onClick={openHelp} disabled={action.busy}>
              <Sparkles aria-hidden="true" className="h-4 w-4" strokeWidth={2.1} />
              Help me choose
            </Button>
          ) : plan.status === 'done' ? (
            <Button onClick={() => step('/resume')} disabled={action.busy}>
              Back to shopping
            </Button>
          ) : null
        }
      />
      {/* A dialog shows its own failures, so the page does not also announce
          them behind it. */}
      <PlanningError error={renaming || deleting ? '' : action.error} reload={load} />
      <p className="sr-only" role="status">
        {notice}
      </p>
      {/* Shown only when it tells someone something the page does not: that a
          rebuild kept their ticks. A first save is announced, but the lede
          already says the list is ready. */}
      {notice && !inShop && listWasRebuilt ? (
        <p className="m-0 text-[14px] text-ink-2">{notice}</p>
      ) : null}

      {draft ? (
        <>
          {/* An empty plan holds the two ways to fill it, rather than
              describing them and leaving the controls somewhere else. */}
          {!plan.items.length ? (
            <EmptyState
              title="What sounds good?"
              body="Pick a recipe you already know, or describe the week you want and get a few suggestions."
            >
              <Button variant="primary" onClick={addMeal}>
                <Plus aria-hidden="true" className="h-4 w-4" strokeWidth={2.4} />
                Add a meal
              </Button>
              <Button onClick={openHelp}>
                <Sparkles aria-hidden="true" className="h-4 w-4" strokeWidth={2.1} />
                Help me choose
              </Button>
            </EmptyState>
          ) : null}
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-4 p-0 sm:gap-5">
            {plan.items.map((item, index) => (
              <MealCard
                key={item.id}
                item={item}
                index={index}
                count={plan.items.length}
                busy={action.busy}
                actions={{
                  onChangeServings: (count) => changeServings(item.id, count),
                  onChangeRecipe: () => {
                    setServings(item.servings);
                    setChoosing(item.id);
                  },
                  onRemove: () => void mutate(`/items/${item.id}`, 'DELETE', {}),
                  onMove: (position) => void mutate(`/items/${item.id}`, 'PUT', { position }),
                }}
              />
            ))}
          </ul>
        </>
      ) : !inShop ? (
        <section className="flex flex-col gap-3" aria-labelledby="plan-meals-heading">
          <SectionHeading id="plan-meals-heading">Meals</SectionHeading>
          <MealStrip items={plan.items} />
        </section>
      ) : null}

      {/* The list stays on the page while a saved plan is being changed: the
          person changing it and the person shopping from it are on the same
          page now, and it must not vanish from under the one in the shop. It
          is keyed to the save, so a save that rebuilt it is read afresh. */}
      {listId != null ? (
        <GroceryList
          key={`${listId}:${plan.confirmedAt ?? 'open'}`}
          listId={listId}
          mode={inShop ? 'shopping' : plan.status === 'done' ? 'readonly' : 'edit'}
          rebuilding={draft}
        />
      ) : null}

      {draft && plan.items.length ? (
        <div className={STICKY_BAR}>
          <p className="m-0 text-[13px] text-ink-2">
            <span className="font-serif text-[15px] text-ink tabular-nums">
              {plan.items.length}
            </span>{' '}
            {plan.items.length === 1 ? 'meal' : 'meals'} ·{' '}
            <span className="font-serif text-[15px] text-ink tabular-nums">{totalServings}</span>{' '}
            servings
          </p>
          <div className="flex flex-wrap gap-3">
            <Button disabled={action.busy || plan.items.length >= 50} onClick={addMeal}>
              <Plus aria-hidden="true" className="h-4 w-4" strokeWidth={2.4} />
              Add a meal
            </Button>
            {/* Saving is also when the list is built, which means a model call.
                It says what it is doing for the few seconds that takes. */}
            <Button
              variant="primary"
              disabled={action.busy || plan.items.some((i) => i.unavailable)}
              onClick={save}
            >
              {action.busy ? 'Building your list…' : 'Save meal plan'}
            </Button>
          </div>
        </div>
      ) : null}
      {plan.status === 'confirmed' && listId != null ? (
        <div className={STICKY_BAR}>
          <p className="m-0 text-[13px] text-ink-2">
            {inShop ? 'The screen stays on while you shop.' : 'Your list is ready.'}
          </p>
          <Button variant="primary" onClick={() => setShopping(!inShop)}>
            {inShop ? null : <ShoppingBasket aria-hidden="true" className="h-4 w-4" strokeWidth={2.1} />}
            {inShop ? 'Done shopping' : 'Start shopping'}
          </Button>
        </div>
      ) : null}

      {renaming ? (
        <PlanNameDialog
          title="Rename meal plan"
          submitLabel="Save name"
          busyLabel="Saving…"
          initialName={plan.name}
          busy={action.busy}
          error={action.error}
          onSubmit={(name) => {
            void (async () => {
              if (await mutate('', 'PUT', { name })) setRenaming(false);
            })();
          }}
          onClose={() => setRenaming(false)}
        />
      ) : null}
      {deleting ? (
        <DeletePlanDialog
          plan={plan}
          busy={action.busy}
          error={action.error}
          onClose={() => setDeleting(false)}
          onConfirm={() =>
            void (async () => {
              // Settle any pending servings tap first: it would otherwise fire
              // its write against a plan that is already gone.
              await flushServings();
              const ok = await action.run(async () => {
                await apiSend(path, 'DELETE', { version: latest.current?.version });
              });
              if (ok) navigate('/meal-plans', { replace: true });
            })()
          }
        />
      ) : null}
      {help ? (
        <Recommendations plan={plan} onApplied={setPlan} onClose={() => setHelp(false)} />
      ) : null}
    </div>
  );
}
