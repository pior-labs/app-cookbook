import { useState } from 'react';
import type { MealPlan } from '@cookbook/domain';
import { Button, FieldHint, FieldLabel, Input } from '@/components/ui';
import { PlanningDialog, PlanningError } from './shared.js';

// The dialogs that act on a whole plan. Both the shelf of plans and a plan's
// own page open them, so they live apart from either.

// Naming a plan is one optional field, and it is the same field whether the
// plan is being created or renamed afterwards. One dialog for both, so the two
// cannot drift into asking for the name in two different ways.
export function PlanNameDialog({
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
// before it goes. The list is named on its own because it is the thing most
// likely to be in use: someone may be standing in a shop with it.
export function DeletePlanDialog({
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
  return (
    <PlanningDialog title="Delete this meal plan?" onClose={onClose}>
      <p className="mt-0 text-ink-2">
        <span className="font-serif text-[17px] text-ink">
          {plan.name || 'This untitled meal plan'}
        </span>{' '}
        and its {plan.items.length} {plan.items.length === 1 ? 'meal' : 'meals'} will be deleted.
        {plan.groceryListId != null
          ? ' Its grocery list goes too, including anything ticked off while shopping.'
          : null}
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
