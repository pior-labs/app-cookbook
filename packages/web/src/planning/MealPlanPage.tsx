import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, RefreshCw, Sparkles } from 'lucide-react';
import type { GroceryList, MealPlan } from '@cookbook/domain';
import { apiSend } from '../api/client.js';
import { BrowsePage } from '../discovery/BrowsePage.js';
import { RecipeCardSkeleton } from '../discovery/RecipeCard.js';
import {
  BackButton,
  Breadcrumb,
  Button,
  ButtonLink,
  FieldHint,
  FieldLabel,
  Input,
  MenuDivider,
  MenuItem,
  OverflowMenu,
  PageHeader,
  Panel,
  SectionHeading,
} from '@/components/ui';
import { EmptyState } from '../recipes/states.js';
import {
  PlanningDialog,
  PlanningError,
  usePlanningAction,
  usePlanningResource,
} from './shared.js';
import { MealCard } from './MealCard.js';
import { PlanCard } from './PlanCard.js';
import { Recommendations } from './Recommendations.js';

// The bar that follows the plan down the page: what the plan currently adds up
// to on one side, and what to do about it on the other. Glass, like every other
// floating surface in the app, rather than the flat cream panel this painted.
const STICKY_BAR =
  'sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-4xl ' +
  'border border-frost/80 bg-[rgba(var(--surface-rgb),0.82)] py-3 pr-3 pl-5 ' +
  'shadow-[var(--cb-menu-shadow)] backdrop-blur-xl backdrop-saturate-150';

// Naming a plan is one optional field, and it is the same field whether the
// plan is being created or renamed afterwards. One dialog for both, so the two
// cannot drift into asking for the name in two different ways.
function PlanNameDialog({
  title,
  submitLabel,
  busyLabel,
  initialName,
  busy,
  error,
  onSubmit,
  onClose,
}: {
  title: string;
  submitLabel: string;
  busyLabel: string;
  initialName: string;
  busy: boolean;
  error: string;
  onSubmit: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialName);

  return (
    <PlanningDialog title={title} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(name);
        }}
      >
        <fieldset disabled={busy} className="m-0 flex flex-col gap-4 border-0 p-0">
          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor="plan-name">Plan name (optional)</FieldLabel>
            <Input
              id="plan-name"
              data-overlay-autofocus="true"
              aria-label="Plan name"
              placeholder="Weekend meals"
              value={name}
              maxLength={160}
              onChange={(e) => setName(e.target.value)}
              // Opening a rename with the cursor at the end of the existing
              // name, rather than in front of it.
              onFocus={(e) => e.target.setSelectionRange(name.length, name.length)}
            />
            <FieldHint>Leave it blank and it stays an untitled plan.</FieldHint>
          </div>
          <PlanningError error={error} />
          <Button className="self-start" variant="primary" type="submit">
            {busy ? busyLabel : submitLabel}
          </Button>
        </fieldset>
      </form>
    </PlanningDialog>
  );
}

// Deleting a plan is not recoverable, so the dialog says what goes with it
// before it goes - and says it in counts, because "and its grocery lists" is
// easy to skim past when the number is two and you are shopping from one.
function DeletePlanDialog({
  plan,
  busy,
  error,
  onConfirm,
  onClose,
}: {
  plan: MealPlan;
  busy: boolean;
  error: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const lists = plan.groceryListIds.length;

  return (
    <PlanningDialog title="Delete this meal plan?" onClose={onClose}>
      <p className="mt-0 text-ink-2">
        <span className="font-serif text-[17px] text-ink">
          {plan.name || 'This untitled meal plan'}
        </span>{' '}
        and its {plan.items.length} {plan.items.length === 1 ? 'meal' : 'meals'} will be deleted.
        {lists ? (
          <>
            {' '}
            Its {lists === 1 ? 'grocery list goes too' : `${lists} grocery lists go too`}, including
            anything ticked off while shopping.
          </>
        ) : null}
      </p>
      <p className="text-ink-2">Your recipes are not affected. This cannot be undone.</p>
      <PlanningError error={error} />
      <div className="mt-5 flex flex-wrap gap-2.5">
        <Button variant="danger" disabled={busy} onClick={onConfirm}>
          {busy ? 'Deleting…' : 'Delete meal plan'}
        </Button>
        <Button data-overlay-autofocus="true" onClick={onClose}>
          Keep it
        </Button>
      </div>
    </PlanningDialog>
  );
}

// The index is a shelf of plans, so the plans get the page. Naming a new one is
// a single optional field, and a form sitting permanently above the shelf made
// an empty text box the first thing on a screen whose job is usually getting
// back to the plan already in progress.
export function MealPlansPage() {
  const resource = usePlanningResource<MealPlan[]>('/api/meal-plans');
  const plans = resource.data ?? [];
  const loaded = !resource.loading;
  const [creating, setCreating] = useState(false);
  const [renamingPlan, setRenamingPlan] = useState<MealPlan | null>(null);
  const [deletingPlan, setDeletingPlan] = useState<MealPlan | null>(null);
  const action = usePlanningAction();
  const navigate = useNavigate();
  const load = () => {
    action.clearError();
    resource.reload();
  };
  const create = (name: string) =>
    void action.run(async () => {
      const plan = await apiSend<MealPlan>('/api/meal-plans', 'POST', { name });
      navigate(`/meal-plans/${plan.id}`);
    });
  const openCreate = () => {
    action.clearError();
    setCreating(true);
  };
  // Both of these act on a plan that is not open, so they finish by reloading
  // the shelf rather than by writing a single card back.
  const renamePlan = (name: string) =>
    void (async () => {
      const target = renamingPlan;
      if (!target) return;
      const ok = await action.run(async () => {
        await apiSend(`/api/meal-plans/${target.id}`, 'PUT', { name, version: target.version });
      });
      if (ok) {
        setRenamingPlan(null);
        resource.reload();
      }
    })();
  const removePlan = () =>
    void (async () => {
      const target = deletingPlan;
      if (!target) return;
      const ok = await action.run(async () => {
        await apiSend(`/api/meal-plans/${target.id}`, 'DELETE', { version: target.version });
      });
      if (ok) {
        setDeletingPlan(null);
        resource.reload();
      }
    })();
  const dialogOpen = creating || renamingPlan != null || deletingPlan != null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Meal plans"
        lede="A few dinners, a weekend away, or whatever comes next."
        actions={
          <Button variant="primary" onClick={openCreate} disabled={action.busy}>
            <Plus aria-hidden="true" className="h-4 w-4" strokeWidth={2.4} />
            New meal plan
          </Button>
        }
      />
      {/* While the dialog is open it shows its own failures, so the page does
          not also announce them behind it. */}
      <PlanningError
        error={dialogOpen ? '' : action.error || resource.error?.message || ''}
        reload={load}
      />

      {!loaded && !resource.error ? (
        <RecipeCardSkeleton count={3} label="Loading meal plans…" />
      ) : null}

      {loaded && !plans.length ? (
        <EmptyState
          title="No plans yet"
          body="A meal plan collects a few recipes and the servings you want of each, then turns the whole thing into one grocery list."
        >
          <Button variant="primary" onClick={openCreate} disabled={action.busy}>
            <Plus aria-hidden="true" className="h-4 w-4" strokeWidth={2.4} />
            New meal plan
          </Button>
        </EmptyState>
      ) : null}

      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-4 p-0 sm:gap-5">
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            busy={action.busy}
            onRename={() => {
              action.clearError();
              setRenamingPlan(plan);
            }}
            onDelete={() => {
              action.clearError();
              setDeletingPlan(plan);
            }}
          />
        ))}
      </ul>

      {creating ? (
        <PlanNameDialog
          title="New meal plan"
          submitLabel="Create meal plan"
          busyLabel="Creating…"
          initialName=""
          busy={action.busy}
          error={action.error}
          onSubmit={create}
          onClose={() => setCreating(false)}
        />
      ) : null}
      {renamingPlan ? (
        <PlanNameDialog
          title="Rename meal plan"
          submitLabel="Save name"
          busyLabel="Saving…"
          initialName={renamingPlan.name}
          busy={action.busy}
          error={action.error}
          onSubmit={renamePlan}
          onClose={() => setRenamingPlan(null)}
        />
      ) : null}
      {deletingPlan ? (
        <DeletePlanDialog
          plan={deletingPlan}
          busy={action.busy}
          error={action.error}
          onConfirm={removePlan}
          onClose={() => setDeletingPlan(null)}
        />
      ) : null}
    </div>
  );
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
  const [regenerating, setRegenerating] = useState(false);
  const action = usePlanningAction();
  const navigate = useNavigate();
  const path = `/api/meal-plans/${id}`;
  const resource = usePlanningResource<MealPlan>(path);
  const plan = resource.data;

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
  // action the cook took right after it.
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

  const addMeal = () => {
    setServings(2);
    setChoosing('add');
  };
  // A plan someone has already built a shopping list from has been committed
  // to, which is what makes replacing its meals worth confirming.
  const hasList = plan.groceryListIds.length > 0;
  const totalServings = plan.items.reduce((sum, item) => sum + item.servings, 0);

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb to="/meal-plans">All meal plans</Breadcrumb>
      <PageHeader
        title={plan.name || 'Your meal plan'}
        lede="Choose meals. Set your servings. You’re ready to shop."
        // Both of these act on the plan itself rather than on what is in it, so
        // they sit against its name rather than out with the page's actions.
        titleAction={
          <OverflowMenu label="Meal plan options" disabled={action.busy}>
            <MenuItem
              onSelect={() => {
                action.clearError();
                setRenaming(true);
              }}
            >
              Rename plan
            </MenuItem>
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
        }
        // The same door, named for what is behind it at the time. On a plan
        // still being assembled, suggestions are an invitation. Once a grocery
        // list exists the plan has been committed to and shopped from, so the
        // same action is a replacement, and it says so and asks first.
        //
        // An empty plan offers neither here: it offers "Help me choose" inside
        // its own panel, next to the alternative, and offering it twice on one
        // screen would only make a cook wonder whether the two differ.
        actions={
          plan.items.length ? (
            hasList ? (
              <Button
                onClick={() => {
                  action.clearError();
                  setRegenerating(true);
                }}
                disabled={action.busy}
              >
                <RefreshCw aria-hidden="true" className="h-4 w-4" strokeWidth={2.1} />
                Regenerate plan
              </Button>
            ) : (
              <Button onClick={openHelp} disabled={action.busy}>
                <Sparkles aria-hidden="true" className="h-4 w-4" strokeWidth={2.1} />
                Help me choose
              </Button>
            )
          ) : null
        }
      />
      {/* A dialog shows its own failures, so the page does not also announce
          them behind it. */}
      <PlanningError error={renaming || deleting || regenerating ? '' : action.error} reload={load} />

      {/* An empty plan holds the two ways to fill it, rather than describing
          them and leaving the controls somewhere else on the page. */}
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

      {plan.items.length ? (
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
          {/* One name for one action, in both states and on the screen it
              opens: "Add another meal" was also a lie on an empty plan. */}
          <Button disabled={action.busy || plan.items.length >= 50} onClick={addMeal}>
            <Plus aria-hidden="true" className="h-4 w-4" strokeWidth={2.4} />
            Add a meal
          </Button>
          <Button
            variant="primary"
            disabled={action.busy || plan.items.some((i) => i.unavailable)}
            onClick={() =>
              void (async () => {
                if (!(await flushServings())) return;
                await action.run(async () => {
                  const version = latest.current?.version;
                  if (version == null) return;
                  const list = await apiSend<GroceryList>(path + '/grocery-lists', 'POST', {
                    version,
                  });
                  navigate(`/grocery-lists/${list.id}`);
                });
              })()
            }
          >
            {action.busy ? 'Working…' : 'Generate grocery list'}
          </Button>
          </div>
        </div>
      ) : null}

      {plan.groceryListIds.length ? (
        <Panel>
          <SectionHeading>Grocery lists</SectionHeading>
          <p>Each list keeps its own edits and shopping progress.</p>
          <div className="flex flex-wrap gap-2">
            {plan.groceryListIds.map((listId, index) => (
              <ButtonLink key={listId} to={`/grocery-lists/${listId}`}>
                {index === 0 ? 'Latest list' : `Earlier list ${plan.groceryListIds.length - index}`}
              </ButtonLink>
            ))}
          </div>
        </Panel>
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
      {regenerating ? (
        <PlanningDialog
          title="Replace the meals in this plan?"
          onClose={() => setRegenerating(false)}
        >
          <p className="mt-0 text-ink-2">
            Choosing new meals replaces all {plan.items.length}{' '}
            {plan.items.length === 1 ? 'meal' : 'meals'} in this plan. You will see the suggestions
            before anything changes.
          </p>
          <p className="text-ink-2">
            {/* The lists are the reason this asks at all, so it says plainly
                that they survive - the worry is losing a shop already done. */}
            Your {plan.groceryListIds.length === 1 ? 'grocery list stays' : 'grocery lists stay'}{' '}
            as {plan.groceryListIds.length === 1 ? 'it is' : 'they are'}, with anything already
            ticked off. A list only changes when you regenerate it.
          </p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            <Button
              variant="primary"
              onClick={() => {
                setRegenerating(false);
                openHelp();
              }}
            >
              Choose new meals
            </Button>
            <Button data-overlay-autofocus="true" onClick={() => setRegenerating(false)}>
              Keep these meals
            </Button>
          </div>
        </PlanningDialog>
      ) : null}
      {help ? (
        <Recommendations plan={plan} onApplied={setPlan} onClose={() => setHelp(false)} />
      ) : null}
    </div>
  );
}
