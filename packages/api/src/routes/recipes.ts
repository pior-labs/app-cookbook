import { createRecipeSchema, idParamSchema, updateRecipeSchema } from '@cookbook/domain';
import { Hono, type Context } from 'hono';
import type { z } from 'zod';
import { validationError, zodValidationError } from '../errors.js';
import type { AppEnv } from '../middleware/context.js';
import { createRecipe, getRecipe, updateRecipe } from '../services/recipes.js';

// HTTP parsing and response mapping only. Domain schemas own the rules, and
// the service owns the transaction (technical design section 3).

function recipeIdParam(c: Context<AppEnv>): number {
  const parsed = idParamSchema.safeParse(c.req.param('id'));

  if (!parsed.success) {
    throw validationError('That is not a valid recipe ID.', { id: ['Expected a recipe ID.'] });
  }

  return parsed.data;
}

async function parseBody<T extends z.ZodType>(c: Context<AppEnv>, schema: T): Promise<z.infer<T>> {
  let raw: unknown;

  try {
    raw = await c.req.json();
  } catch {
    throw validationError('Send a JSON request body.');
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw zodValidationError(parsed.error);
  }

  return parsed.data;
}

export const recipesRoute = new Hono<AppEnv>();

recipesRoute.post('/', async (c) => {
  const input = await parseBody(c, createRecipeSchema);
  const recipe = await createRecipe(input, c.get('userId'));

  return c.json(recipe, 201);
});

recipesRoute.get('/:id', async (c) => {
  const recipe = await getRecipe(recipeIdParam(c), c.get('userId'));

  return c.json(recipe);
});

recipesRoute.put('/:id', async (c) => {
  const recipeId = recipeIdParam(c);
  const input = await parseBody(c, updateRecipeSchema);
  const recipe = await updateRecipe(recipeId, input, c.get('userId'));

  return c.json(recipe);
});
