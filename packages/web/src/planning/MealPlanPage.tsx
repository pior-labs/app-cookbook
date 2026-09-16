import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { GroceryList, MealPlan } from '@cookbook/domain';
import { apiSend } from '../api/client.js';
import { BrowsePage } from '../discovery/BrowsePage.js';
import { Button, ButtonLink, Input, PageHeader, Panel, SectionHeading } from '@/components/ui';
import { PlanningError, usePlanningAction, usePlanningResource } from './shared.js';
import { Recommendations } from './Recommendations.js';

export function MealPlansPage() {
  const resource = usePlanningResource<MealPlan[]>('/api/meal-plans');
  const plans = resource.data ?? [];
  const loaded = !resource.loading;
  const [name, setName] = useState('');
  const action = usePlanningAction();
  const navigate = useNavigate();
  const load = () => {
    action.clearError();
    resource.reload();
  };
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Meal plans"
        lede="A few dinners, a weekend away, or whatever comes next."
      />
      <PlanningError error={action.error || resource.error?.message || ''} reload={load} />
      <Panel>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void action.run(async () => {
              const plan = await apiSend<MealPlan>('/api/meal-plans', 'POST', { name });
              navigate(`/meal-plans/${plan.id}`);
            });
          }}
        >
          <label className="min-w-0 flex-1">
            Plan name <span className="text-ink-3">(optional)</span>
            <Input
              placeholder="Weekend meals"
              value={name}
              maxLength={160}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <Button variant="primary" type="submit" disabled={action.busy}>
            Create meal plan
          </Button>
        </form>
      </Panel>
      {!loaded && !action.error ? <p role="status">Loading meal plans…</p> : null}
      {loaded && !plans.length ? (
        <p className="text-ink-2">Start a plan, choose your meals, then make one shopping list.</p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        {plans.map((plan) => (
          <Panel key={plan.id}>
            <SectionHeading>{plan.name || 'Untitled meal plan'}</SectionHeading>
            <p className="text-ink-2">
              {plan.items.length} meals · {plan.items.reduce((sum, item) => sum + item.servings, 0)}{' '}
              servings
            </p>
            <ButtonLink to={`/meal-plans/${plan.id}`}>Continue</ButtonLink>
          </Panel>
        ))}
      </div>
    </div>
  );
}

export function MealPlanPage() {
  const { id } = useParams();
  const [choosing, setChoosing] = useState<number | 'add' | null>(null);
  const [servings, setServings] = useState(2);
  const [help, setHelp] = useState(false);
  const action = usePlanningAction();
  const navigate = useNavigate();
  const path = `/api/meal-plans/${id}`;
  const resource = usePlanningResource<MealPlan>(path);
  const plan = resource.data;
  const setPlan = (updated: MealPlan) => resource.apply(() => updated);
  const load = () => {
    action.clearError();
    resource.reload();
  };
  if (!plan || resource.loading || resource.error)
    return (
      <>
        <PlanningError error={resource.error?.message || action.error} reload={load} />
        {!resource.error && !action.error ? <p role="status">Loading meal plan…</p> : null}
      </>
    );
  const mutate = (suffix: string, method: 'POST' | 'PUT' | 'DELETE', body: object) =>
    action.run(async () =>
      setPlan(await apiSend(path + suffix, method, { ...body, version: plan.version })),
    );
  if (choosing != null)
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-4">
          <Button onClick={() => setChoosing(null)}>Back to meal plan</Button>
          <label>
            Planned servings
            <Input
              aria-label="Planned servings"
              type="number"
              min={1}
              max={100}
              value={servings}
              onChange={(e) => setServings(Number(e.target.value))}
            />
          </label>
        </div>
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
  return (
    <div className="flex flex-col gap-6">
      <ButtonLink to="/meal-plans">All meal plans</ButtonLink>
      <PageHeader
        title={plan.name || 'Your meal plan'}
        lede="Choose meals. Set your servings. You’re ready to shop."
        actions={
          <Button onClick={() => setHelp(true)} disabled={action.busy}>
            Help me choose
          </Button>
        }
      />
      <PlanningError error={action.error} reload={load} />
      {!plan.items.length ? (
        <Panel>
          <SectionHeading>What sounds good?</SectionHeading>
          <p>Choose a recipe you know, or ask for a few suggestions.</p>
        </Panel>
      ) : null}
      <ol className="m-0 grid list-none gap-4 p-0 lg:grid-cols-2">
        {plan.items.map((item, index) => (
          <li key={item.id}>
            <Panel className="h-full">
              <p className="m-0 text-sm text-ink-3">Meal {index + 1}</p>
              <h2 className="my-2 font-serif text-2xl">
                {item.unavailable ? (
                  item.recipeName
                ) : (
                  <Link to={`/recipes/${item.recipeId}`}>{item.recipeName}</Link>
                )}
              </h2>
              {item.unavailable ? (
                <p role="status">
                  This recipe is unavailable. Change or remove it before generating groceries.
                </p>
              ) : null}
              <div className="my-4 flex items-center gap-3">
                <Button
                  aria-label={`Fewer servings for meal ${index + 1}`}
                  disabled={action.busy || item.servings <= 1}
                  onClick={() =>
                    void mutate(`/items/${item.id}`, 'PUT', { servings: item.servings - 1 })
                  }
                >
                  −
                </Button>
                <span className="font-serif text-2xl tabular-nums">
                  {item.servings} <span className="text-base">servings</span>
                </span>
                <Button
                  aria-label={`More servings for meal ${index + 1}`}
                  disabled={action.busy || item.servings >= 100}
                  onClick={() =>
                    void mutate(`/items/${item.id}`, 'PUT', { servings: item.servings + 1 })
                  }
                >
                  +
                </Button>
              </div>
              <div className="flex flex-wrap gap-1">
                <Button
                  size="small"
                  disabled={action.busy}
                  onClick={() => {
                    setServings(item.servings);
                    setChoosing(item.id);
                  }}
                >
                  Change
                </Button>
                <Button
                  size="small"
                  disabled={action.busy}
                  onClick={() => void mutate(`/items/${item.id}`, 'DELETE', {})}
                >
                  Remove
                </Button>
                <Button
                  size="small"
                  aria-label={`Move meal ${index + 1} earlier`}
                  disabled={action.busy || index === 0}
                  onClick={() => void mutate(`/items/${item.id}`, 'PUT', { position: index - 1 })}
                >
                  ↑
                </Button>
                <Button
                  size="small"
                  aria-label={`Move meal ${index + 1} later`}
                  disabled={action.busy || index === plan.items.length - 1}
                  onClick={() => void mutate(`/items/${item.id}`, 'PUT', { position: index + 1 })}
                >
                  ↓
                </Button>
              </div>
            </Panel>
          </li>
        ))}
      </ol>
      <div className="sticky bottom-3 flex flex-wrap gap-3 rounded-3xl border border-frost/80 bg-cream/95 p-4 shadow-lg">
        <Button
          disabled={action.busy || plan.items.length >= 50}
          onClick={() => {
            setServings(2);
            setChoosing('add');
          }}
        >
          + Add another meal
        </Button>
        <Button
          variant="primary"
          disabled={action.busy || !plan.items.length || plan.items.some((i) => i.unavailable)}
          onClick={() =>
            void action.run(async () => {
              const list = await apiSend<GroceryList>(path + '/grocery-lists', 'POST', {
                version: plan.version,
              });
              navigate(`/grocery-lists/${list.id}`);
            })
          }
        >
          {action.busy ? 'Working…' : 'Generate grocery list'}
        </Button>
      </div>
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
      {help ? (
        <Recommendations plan={plan} onApplied={setPlan} onClose={() => setHelp(false)} />
      ) : null}
    </div>
  );
}
