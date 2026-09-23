import { z } from 'zod';
import { checkItemSchema, resolveMergeSchema, versionInputSchema } from '@cookbook/domain';
import { Hono } from 'hono';
import type { AppEnv } from '../middleware/context.js';
import { idParam, parseBody } from './http.js';
import * as service from '../services/planning.js';
import { recommendMeals } from '../services/recommendations.js';

// Services validate raw inputs so MCP and HTTP cannot diverge. Parsing JSON
// here still supplies the normal error envelope for malformed request bodies.
const body = (c: Parameters<typeof parseBody>[0]) => parseBody(c, z.unknown());
export const mealPlansRoute = new Hono<AppEnv>();
mealPlansRoute.get('/', async (c) => c.json(await service.listMealPlans()));
mealPlansRoute.post('/', async (c) =>
  c.json(await service.createMealPlan(await body(c), c.get('userId')), 201),
);
mealPlansRoute.post('/recommendations', async (c) =>
  c.json(await recommendMeals(await body(c), c.get('userId'))),
);
mealPlansRoute.get('/:id', async (c) => c.json(await service.getMealPlan(idParam(c, 'meal plan'))));
mealPlansRoute.put('/:id', async (c) =>
  c.json(await service.renameMealPlan(idParam(c, 'meal plan'), await body(c), c.get('userId'))),
);
mealPlansRoute.delete('/:id', async (c) => {
  const { version } = await parseBody(c, versionInputSchema);
  await service.deleteMealPlan(idParam(c, 'meal plan'), version, c.get('userId'));
  return c.body(null, 204);
});
mealPlansRoute.post('/:id/items', async (c) =>
  c.json(
    await service.addRecipeToMealPlan(idParam(c, 'meal plan'), await body(c), c.get('userId')),
  ),
);
mealPlansRoute.put('/:id/items/:itemId', async (c) =>
  c.json(
    await service.updateMealPlanItem(
      idParam(c, 'meal plan'),
      idParam(c, 'meal', 'itemId'),
      await body(c),
      c.get('userId'),
    ),
  ),
);
mealPlansRoute.delete('/:id/items/:itemId', async (c) => {
  const { version } = await parseBody(c, versionInputSchema);
  return c.json(
    await service.removeRecipeFromMealPlan(
      idParam(c, 'meal plan'),
      idParam(c, 'meal', 'itemId'),
      version,
      c.get('userId'),
    ),
  );
});
mealPlansRoute.put('/:id/meals', async (c) =>
  c.json(await service.applyMealProposal(idParam(c, 'meal plan'), await body(c), c.get('userId'))),
);
// The plan's lifecycle (ADR 0010). Each takes the plan version and returns the
// plan; saving is also what builds or rebuilds its one grocery list.
for (const [path, run] of [
  ['confirm', service.confirmMealPlan],
  ['reopen', service.reopenMealPlan],
  ['complete', service.completeMealPlan],
  ['resume', service.resumeMealPlan],
] as const)
  mealPlansRoute.post(`/:id/${path}`, async (c) => {
    const { version } = await parseBody(c, versionInputSchema);
    return c.json(await run(idParam(c, 'meal plan'), version, c.get('userId')));
  });
export const groceryListsRoute = new Hono<AppEnv>();
groceryListsRoute.get('/:id', async (c) =>
  c.json(await service.getGroceryList(idParam(c, 'grocery list'))),
);
groceryListsRoute.post('/:id/items', async (c) =>
  c.json(
    await service.addGroceryListItem(idParam(c, 'grocery list'), await body(c), c.get('userId')),
  ),
);
groceryListsRoute.put('/:id/items/:itemId', async (c) =>
  c.json(
    await service.updateGroceryListItem(
      idParam(c, 'grocery list'),
      idParam(c, 'grocery item', 'itemId'),
      await body(c),
      c.get('userId'),
    ),
  ),
);
groceryListsRoute.put('/:id/items/:itemId/checked', async (c) => {
  const { version, checked } = await parseBody(c, checkItemSchema);
  return c.json(
    await service.checkGroceryListItem(
      idParam(c, 'grocery list'),
      idParam(c, 'grocery item', 'itemId'),
      version,
      checked,
      c.get('userId'),
    ),
  );
});
groceryListsRoute.delete('/:id/items/:itemId', async (c) => {
  const { version } = await parseBody(c, versionInputSchema);
  return c.json(
    await service.removeGroceryListItem(
      idParam(c, 'grocery list'),
      idParam(c, 'grocery item', 'itemId'),
      version,
      c.get('userId'),
    ),
  );
});
groceryListsRoute.put('/:id/suggestions/:suggestionId', async (c) => {
  const { version, merge } = await parseBody(c, resolveMergeSchema);
  return c.json(
    await service.resolveGroceryMerge(
      idParam(c, 'grocery list'),
      idParam(c, 'suggestion', 'suggestionId'),
      version,
      merge,
      c.get('userId'),
    ),
  );
});
