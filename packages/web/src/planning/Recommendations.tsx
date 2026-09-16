import { useState } from 'react';
import type { MealPlan, MealProposal, RecommendationPreferences } from '@cookbook/domain';
import { apiSend } from '../api/client.js';
import { useOrganization } from '../recipes/useRecipeEditor.js';
import { Button, Input, Select, Textarea } from '@/components/ui';
import { PlanningDialog, PlanningError, usePlanningAction } from './shared.js';

export function Recommendations({
  plan,
  onApplied,
  onClose,
}: {
  plan: MealPlan;
  onApplied: (plan: MealPlan) => void;
  onClose: () => void;
}) {
  const [preferences, setPreferences] = useState<RecommendationPreferences>({
    count: 5,
    servings: 2,
    tagIds: [],
    preferFavorites: false,
    avoidRecentlyUsed: false,
    preference: '',
  });
  const [proposal, setProposal] = useState<MealProposal | null>(null);
  const organization = useOrganization();
  const action = usePlanningAction();
  const change = (value: Partial<RecommendationPreferences>) => {
    setPreferences((p) => ({ ...p, ...value }));
    setProposal(null);
  };
  const generate = () =>
    void action.run(async () =>
      setProposal(await apiSend('/api/meal-plans/recommendations', 'POST', preferences)),
    );
  return (
    <PlanningDialog title="Help me choose" onClose={onClose}>
      <PlanningError error={action.error} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          generate();
        }}
      >
        <fieldset disabled={action.busy} className="m-0 grid gap-4 border-0 p-0 sm:grid-cols-2">
          <label>
            Number of meals
            <Input
              type="number"
              min={1}
              max={20}
              required
              value={preferences.count}
              onChange={(e) => change({ count: Number(e.target.value) })}
            />
          </label>
          <label>
            Servings per meal
            <Input
              type="number"
              min={1}
              max={100}
              required
              value={preferences.servings}
              onChange={(e) => change({ servings: Number(e.target.value) })}
            />
          </label>
          <label>
            Maximum total minutes
            <Input
              type="number"
              min={1}
              max={10080}
              placeholder="Any"
              value={preferences.maxTotalMinutes ?? ''}
              onChange={(e) =>
                change({ maxTotalMinutes: e.target.value ? Number(e.target.value) : undefined })
              }
            />
          </label>
          <label>
            Minimum rating
            <Select
              value={preferences.minRating ?? ''}
              onChange={(e) =>
                change({ minRating: e.target.value ? Number(e.target.value) : undefined })
              }
            >
              <option value="">Any rating</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} stars
                </option>
              ))}
            </Select>
          </label>
          <label>
            Category
            <Select
              value={preferences.categoryId ?? ''}
              onChange={(e) =>
                change({ categoryId: e.target.value ? Number(e.target.value) : undefined })
              }
            >
              <option value="">All categories</option>
              {organization.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </label>
          <div>
            <p className="mt-0">Tags</p>
            <div className="flex flex-wrap gap-3">
              {organization.tags.map((tag) => (
                <label key={tag.id} className="flex min-h-11 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={preferences.tagIds.includes(tag.id)}
                    onChange={(e) =>
                      change({
                        tagIds: e.target.checked
                          ? [...preferences.tagIds, tag.id]
                          : preferences.tagIds.filter((id) => id !== tag.id),
                      })
                    }
                  />
                  {tag.name}
                </label>
              ))}
            </div>
          </div>
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              checked={preferences.preferFavorites}
              onChange={(e) => change({ preferFavorites: e.target.checked })}
            />
            Prefer my favorites
          </label>
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              checked={preferences.avoidRecentlyUsed}
              onChange={(e) => change({ avoidRecentlyUsed: e.target.checked })}
            />
            Avoid recipes in the last five plans
          </label>
          <label className="sm:col-span-2">
            Anything else?
            <Textarea
              placeholder="Mostly chicken. No pasta more than twice."
              maxLength={1000}
              value={preferences.preference}
              onChange={(e) => change({ preference: e.target.value })}
            />
          </label>
          <Button type="submit" variant="primary">
            {action.busy ? 'Choosing meals…' : proposal ? 'Regenerate' : 'Suggest meals'}
          </Button>
        </fieldset>
      </form>
      {proposal ? (
        <section className="mt-6 border-t border-ink/15 pt-4" aria-label="Suggested meal plan">
          <h3 className="font-serif text-2xl">Suggested meal plan</h3>
          <p role="status">{proposal.explanation}</p>
          {proposal.candidateLimitReached ? (
            <p>
              Suggestions consider the first 100 matching recipes. Narrow the filters to explore
              other choices.
            </p>
          ) : null}
          {proposal.meals.length < preferences.count ? (
            <p>Only {proposal.meals.length} matching meals are available.</p>
          ) : null}
          <ul>
            {proposal.meals.map((meal) => (
              <li className="py-2" key={meal.recipeId}>
                {meal.recipeName} · {meal.servings} servings
              </li>
            ))}
          </ul>
          {plan.items.length ? (
            <p>
              This replaces the {plan.items.length} meals in your plan. Existing grocery lists stay
              available.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <Button
              variant="primary"
              disabled={action.busy || !proposal.meals.length}
              onClick={() =>
                void action.run(async () => {
                  const updated = await apiSend<MealPlan>(
                    `/api/meal-plans/${plan.id}/meals`,
                    'PUT',
                    {
                      version: plan.version,
                      meals: proposal.meals.map(({ recipeId, servings }) => ({
                        recipeId,
                        servings,
                      })),
                    },
                  );
                  onApplied(updated);
                  onClose();
                })
              }
            >
              Use this plan
            </Button>
            <Button onClick={onClose}>Cancel</Button>
          </div>
        </section>
      ) : null}
    </PlanningDialog>
  );
}
