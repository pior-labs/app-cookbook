import { createRecipeSchema, listRecipesQuerySchema, updateRecipeSchema } from '@cookbook/domain';
import { Hono, type Context } from 'hono';
import type { AppEnv } from '../middleware/context.js';
import { searchRecipes } from '../services/discovery.js';
import { createRecipe, getRecipe, updateRecipe } from '../services/recipes.js';
import { idParam, parseBody, parseQuery } from './http.js';
import { registerPhotoRoutes } from './photos.js';

// HTTP parsing and response mapping only. Domain schemas own the rules, and
// the service owns the transaction (technical design section 3).

function recipeIdParam(c: Context<AppEnv>): number {
  return idParam(c, 'recipe');
}

export const recipesRoute = new Hono<AppEnv>();

// Browse and search. The query schema is strict, so an unknown or malformed
// filter fails loudly rather than silently returning an unfiltered list that
// looks like a search result (section 9).
recipesRoute.get('/', async (c) =>
  c.json(await searchRecipes(parseQuery(c, listRecipesQuerySchema), c.get('userId'))),
);

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

// The primary photo hangs off the recipe path but is replaced independently of
// the recipe JSON transaction, so an upload failure never discards form data
// (section 7.4).
registerPhotoRoutes(recipesRoute, recipeIdParam);
