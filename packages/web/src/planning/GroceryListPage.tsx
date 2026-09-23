import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { GroceryList } from '@cookbook/domain';
import { Breadcrumb } from '@/components/ui';
import { PlanningError, usePlanningResource } from './shared.js';

// A grocery list used to be its own screen. It is now part of the plan it was
// built from (ADR 0010), so this address only exists for links made before
// that - a bookmark, a shared tab, an id an assistant handed out - and sends
// them to the plan, replacing itself so Back does not bounce through it.
export function GroceryListPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const resource = usePlanningResource<GroceryList>(`/api/grocery-lists/${id}`);
  const planId = resource.data?.mealPlanId;

  useEffect(() => {
    if (planId != null) navigate(`/meal-plans/${planId}`, { replace: true });
  }, [planId, navigate]);

  return resource.error ? (
    <div className="flex flex-col gap-6">
      <Breadcrumb to="/meal-plans">All meal plans</Breadcrumb>
      <PlanningError
        error={
          resource.error.isNotFound
            ? 'This grocery list no longer exists. Its meal plan may have been deleted.'
            : resource.error.message
        }
        reload={resource.error.isNotFound ? undefined : resource.reload}
      />
    </div>
  ) : (
    <p className="text-ink-2" role="status">
      Opening grocery list…
    </p>
  );
}
