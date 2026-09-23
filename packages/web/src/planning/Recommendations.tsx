import { useEffect, useRef, useState } from 'react';
import { ChevronDown, RefreshCw, Sparkles } from 'lucide-react';
import type { MealPlan, MealProposal, RecommendationPreferences } from '@cookbook/domain';
import { apiSend } from '../api/client.js';
import { timeLabel } from '../discovery/RecipeCard.js';
import { useOrganization } from '../recipes/useRecipeEditor.js';
import {
  BackButton,
  Button,
  chipLabelClass,
  FieldLabel,
  Input,
  Select,
  tagChipLabelClass,
  tagChipStyle,
  Textarea,
} from '@/components/ui';
import { Thumb } from './MealStrip.js';
import { PlanningDialog, PlanningError, usePlanningAction } from './shared.js';

// Asking and answering are two steps, not one long form. When they shared a
// scroll, the answer landed below the fold under a thin rule, and the only sign
// anything had happened was the button above it quietly renaming itself.
//
// The ask leads with the sentence, because that is the part only the model can
// use; the filters are real but secondary, so they fold away. The answer is
// its own screen, with its own title and focus, showing dishes rather than a
// list of names.

type Preferences = RecommendationPreferences;

const START: Preferences = {
  count: 5,
  servings: 2,
  tagIds: [],
  preferFavorites: false,
  avoidRecentlyUsed: false,
  preference: '',
};

// How many of the folded options are doing something, so "More options" says
// when it is holding back choices that shape the result.
function optionsSet(p: Preferences): number {
  return (
    Number(p.maxTotalMinutes != null) +
    Number(p.minRating != null) +
    Number(p.categoryId != null) +
    p.tagIds.length +
    Number(p.preferFavorites) +
    Number(p.avoidRecentlyUsed)
  );
}

function Ask({
  preferences,
  busy,
  onChange,
  onSubmit,
}: {
  preferences: Preferences;
  busy: boolean;
  onChange: (value: Partial<Preferences>) => void;
  onSubmit: () => void;
}) {
  const organization = useOrganization();
  const set = optionsSet(preferences);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <fieldset disabled={busy} className="m-0 flex flex-col gap-5 border-0 p-0">
        <div className="flex flex-col gap-2">
          <label
            htmlFor="suggest-preference"
            className="font-serif text-[22px] leading-tight text-ink sm:text-[24px]"
          >
            What are you in the mood for?
          </label>
          <Textarea
            id="suggest-preference"
            data-overlay-autofocus="true"
            className="min-h-28 text-[16px]"
            placeholder="Mostly chicken, nothing over an hour, and one vegetarian night."
            maxLength={1000}
            value={preferences.preference}
            onChange={(e) => onChange({ preference: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor="suggest-count">Number of meals</FieldLabel>
            <Input
              id="suggest-count"
              type="number"
              inputMode="numeric"
              min={1}
              max={20}
              required
              value={preferences.count}
              onChange={(e) => onChange({ count: Number(e.target.value) })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor="suggest-servings">Servings per meal</FieldLabel>
            <Input
              id="suggest-servings"
              type="number"
              inputMode="numeric"
              min={1}
              max={100}
              required
              value={preferences.servings}
              onChange={(e) => onChange({ servings: Number(e.target.value) })}
            />
          </div>
        </div>

        {/* Open by default when something in it is set, so a returning
            "Change what you asked for" shows the choices that shaped the
            answer. */}
        <details className="group rounded-[20px] border border-frost/80 px-4" open={set > 0}>
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 text-[14px] font-medium text-ink [&::-webkit-details-marker]:hidden">
            <span>
              More options
              {set ? <span className="ml-2 font-normal text-ink-3">{set} set</span> : null}
            </span>
            <ChevronDown
              aria-hidden="true"
              className="h-4 w-4 text-ink-3 transition-transform group-open:rotate-180 motion-reduce:transition-none"
            />
          </summary>
          <div className="flex flex-col gap-4 pb-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor="suggest-minutes">Ready within (minutes)</FieldLabel>
                <Input
                  id="suggest-minutes"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={10080}
                  placeholder="Any time"
                  value={preferences.maxTotalMinutes ?? ''}
                  onChange={(e) =>
                    onChange({ maxTotalMinutes: e.target.value ? Number(e.target.value) : undefined })
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor="suggest-rating">Rated at least</FieldLabel>
                <Select
                  id="suggest-rating"
                  value={preferences.minRating ?? ''}
                  onChange={(e) =>
                    onChange({ minRating: e.target.value ? Number(e.target.value) : undefined })
                  }
                >
                  <option value="">Any rating</option>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? 'star' : 'stars'}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor="suggest-category">Category</FieldLabel>
                <Select
                  id="suggest-category"
                  value={preferences.categoryId ?? ''}
                  onChange={(e) =>
                    onChange({ categoryId: e.target.value ? Number(e.target.value) : undefined })
                  }
                >
                  <option value="">All categories</option>
                  {organization.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {organization.tags.length ? (
              <fieldset className="m-0 border-0 p-0">
                <legend className="mb-2 text-[13px] font-medium text-ink-2">
                  Only recipes tagged
                </legend>
                <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                  {organization.tags.map((tag) => {
                    const on = preferences.tagIds.includes(tag.id);
                    return (
                      <li key={tag.id}>
                        <label className={tagChipLabelClass(tag.color, on)} style={tagChipStyle(tag.color)}>
                          <input
                            className="sr-only"
                            type="checkbox"
                            checked={on}
                            onChange={() =>
                              onChange({
                                tagIds: on
                                  ? preferences.tagIds.filter((id) => id !== tag.id)
                                  : [...preferences.tagIds, tag.id],
                              })
                            }
                          />
                          <span>{tag.name}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <label className={chipLabelClass(preferences.preferFavorites)}>
                <input
                  className="sr-only"
                  type="checkbox"
                  checked={preferences.preferFavorites}
                  onChange={(e) => onChange({ preferFavorites: e.target.checked })}
                />
                Prefer my favorites
              </label>
              <label className={chipLabelClass(preferences.avoidRecentlyUsed)}>
                <input
                  className="sr-only"
                  type="checkbox"
                  checked={preferences.avoidRecentlyUsed}
                  onChange={(e) => onChange({ avoidRecentlyUsed: e.target.checked })}
                />
                Skip recipes from my last five plans
              </label>
            </div>
          </div>
        </details>

        <Button type="submit" variant="primary" className="self-start">
          <Sparkles aria-hidden="true" className="h-4 w-4" strokeWidth={2.1} />
          {busy ? 'Choosing meals…' : 'Suggest meals'}
        </Button>
      </fieldset>
    </form>
  );
}

function Answer({
  plan,
  proposal,
  requested,
  busy,
  onBack,
  onRetry,
  onUse,
  onCancel,
}: {
  plan: MealPlan;
  proposal: MealProposal;
  requested: number;
  busy: boolean;
  onBack: () => void;
  onRetry: () => void;
  onUse: () => void;
  onCancel: () => void;
}) {
  // The answer replaces the question in the same dialog, so focus moves to it
  // and a screen reader hears that there is something new to read.
  const intro = useRef<HTMLDivElement>(null);
  useEffect(() => {
    intro.current?.focus();
  }, [proposal]);

  const empty = !proposal.meals.length;

  return (
    <div className="flex flex-col gap-5">
      <BackButton onClick={onBack}>Change what you asked for</BackButton>

      <div ref={intro} tabIndex={-1} className="outline-none" role="status">
        {/* The model's reasoning reads as its voice. When the model was not
            reached, the same slot carries a plain notice instead, not a quote. */}
        <p
          className={
            proposal.mode === 'llm'
              ? 'm-0 font-serif text-[18px] leading-snug text-ink italic'
              : 'm-0 text-[14px] text-ink-2'
          }
        >
          {proposal.explanation}
        </p>
      </div>

      {!empty ? (
        <ul
          className={`m-0 flex list-none flex-col gap-2 p-0 transition-opacity ${busy ? 'opacity-50' : ''}`}
          aria-busy={busy}
        >
          {proposal.meals.map((meal) => {
            const time = timeLabel(meal.totalMinutes);
            return (
              <li
                key={meal.recipeId}
                className="flex items-center gap-3 rounded-[20px] border border-frost/80 bg-[rgba(var(--surface-rgb),0.7)] p-2 pr-4"
              >
                <Thumb item={meal} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-serif text-[17px] leading-tight text-ink">
                    {meal.recipeName}
                  </span>
                  <span className="text-[12.5px] text-ink-3">
                    {[meal.categoryName, time].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className="shrink-0 text-[13px] text-ink-2 tabular-nums">
                  {meal.servings} servings
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}

      {/* Said only when true, in the order they matter. */}
      {!empty && proposal.meals.length < requested ? (
        <p className="m-0 text-[14px] text-ink-2">
          You asked for {requested}, and only {proposal.meals.length} recipes match.
        </p>
      ) : null}
      {proposal.candidateLimitReached ? (
        <p className="m-0 text-[13px] text-ink-3">
          Suggestions come from the first 100 matching recipes. Narrow the options to reach
          others.
        </p>
      ) : null}
      {!empty && plan.items.length ? (
        <p className="m-0 text-[14px] text-ink-2">
          Using these replaces the {plan.items.length}{' '}
          {plan.items.length === 1 ? 'meal' : 'meals'} in your plan.
          {/* Suggestions only run on a draft, so any list here belongs to a
              plan being changed, and it only moves when the plan is saved. */}
          {plan.groceryListId != null
            ? ' Your grocery list stays as it is until you save the plan.'
            : null}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2.5">
        {!empty ? (
          <Button variant="primary" disabled={busy} onClick={onUse}>
            Use this plan
          </Button>
        ) : null}
        <Button disabled={busy} onClick={onRetry}>
          <RefreshCw aria-hidden="true" className="h-4 w-4" strokeWidth={2.1} />
          {busy ? 'Choosing meals…' : 'Try again'}
        </Button>
        <Button variant="quiet" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function Recommendations({
  plan,
  onApplied,
  onClose,
}: {
  plan: MealPlan;
  onApplied: (plan: MealPlan) => void;
  onClose: () => void;
}) {
  const [preferences, setPreferences] = useState<Preferences>(START);
  const [proposal, setProposal] = useState<MealProposal | null>(null);
  const action = usePlanningAction();

  const suggest = () =>
    void action.run(async () =>
      setProposal(await apiSend('/api/meal-plans/recommendations', 'POST', preferences)),
    );
  const use = (chosen: MealProposal) =>
    void action.run(async () => {
      const updated = await apiSend<MealPlan>(`/api/meal-plans/${plan.id}/meals`, 'PUT', {
        version: plan.version,
        meals: chosen.meals.map(({ recipeId, servings }) => ({ recipeId, servings })),
      });
      onApplied(updated);
      onClose();
    });

  return (
    <PlanningDialog title={proposal ? 'Suggested meal plan' : 'Help me choose'} onClose={onClose}>
      <div className="mb-4 empty:hidden">
        <PlanningError error={action.error} />
      </div>
      {proposal ? (
        <Answer
          plan={plan}
          proposal={proposal}
          requested={preferences.count}
          busy={action.busy}
          onBack={() => {
            action.clearError();
            setProposal(null);
          }}
          onRetry={suggest}
          onUse={() => use(proposal)}
          onCancel={onClose}
        />
      ) : (
        <Ask
          preferences={preferences}
          busy={action.busy}
          onChange={(value) => setPreferences((p) => ({ ...p, ...value }))}
          onSubmit={suggest}
        />
      )}
    </PlanningDialog>
  );
}
