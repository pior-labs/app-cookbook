import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import type { MealPlan } from '@cookbook/domain';
import { apiSend } from '../api/client.js';
import { RecipeCardSkeleton } from '../discovery/RecipeCard.js';
import { EmptyState } from '../recipes/states.js';
import { Button, PageHeader, SectionHeading } from '@/components/ui';
import { DeletePlanDialog, PlanNameDialog } from './dialogs.js';
import { PlanCard } from './PlanCard.js';
import { PlanningError, usePlanningAction, usePlanningResource } from './shared.js';

const SHELF =
  'm-0 grid list-none grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-4 p-0 sm:gap-5';

// The index is a shelf of plans, so the plans get the page. Naming a new one is
// a single optional field, and a form sitting permanently above the shelf made
// an empty text box the first thing on a screen whose job is usually getting
// back to the plan already in progress.
//
// Done plans sit apart, below. A finished week is still worth finding, but it
// is not what anyone opens this page to get back to.
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
  // These act on a plan that is not open, so they finish by reloading the shelf
  // rather than by writing a single card back.
  const act = (target: MealPlan, suffix: string, method: 'POST' | 'PUT' | 'DELETE', body = {}) =>
    action.run(async () => {
      await apiSend(`/api/meal-plans/${target.id}${suffix}`, method, {
        ...body,
        version: target.version,
      });
      resource.reload();
    });
  const renamePlan = (name: string) =>
    void (async () => {
      if (renamingPlan && (await act(renamingPlan, '', 'PUT', { name }))) setRenamingPlan(null);
    })();
  const removePlan = () =>
    void (async () => {
      if (deletingPlan && (await act(deletingPlan, '', 'DELETE'))) setDeletingPlan(null);
    })();
  const dialogOpen = creating || renamingPlan != null || deletingPlan != null;

  const active = plans.filter((plan) => plan.status !== 'done');
  const done = plans.filter((plan) => plan.status === 'done');
  const card = (plan: MealPlan) => (
    <PlanCard
      key={plan.id}
      plan={plan}
      busy={action.busy}
      onRename={() => {
        action.clearError();
        setRenamingPlan(plan);
      }}
      // Marking a week done is the gentle way to clear a stale plan off the
      // shelf, so it is offered where stale plans are noticed.
      onComplete={() => void act(plan, '/complete', 'POST')}
      onResume={() => void act(plan, '/resume', 'POST')}
      onDelete={() => {
        action.clearError();
        setDeletingPlan(plan);
      }}
    />
  );

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
      {/* While a dialog is open it shows its own failures, so the page does
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
          body="A meal plan collects a few recipes and the servings you want of each. Save it when you're happy, and it becomes one grocery list."
        >
          <Button variant="primary" onClick={openCreate} disabled={action.busy}>
            <Plus aria-hidden="true" className="h-4 w-4" strokeWidth={2.4} />
            New meal plan
          </Button>
        </EmptyState>
      ) : null}

      {active.length ? <ul className={SHELF}>{active.map(card)}</ul> : null}

      {done.length ? (
        <section className="mt-4 flex flex-col gap-4" aria-labelledby="done-plans-heading">
          <SectionHeading id="done-plans-heading" sub="Finished plans, kept to look back on.">
            Done
          </SectionHeading>
          <ul className={SHELF}>{done.map(card)}</ul>
        </section>
      ) : null}

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
