import { listRecipesQuerySchema } from '@cookbook/domain';
import { Hono } from 'hono';
import type { AppEnv } from '../middleware/context.js';
import {
  deleteRecipeForever,
  listTrash,
  restoreFromTrash,
} from '../services/trash.js';
import { idParam, parseQuery } from './http.js';

// Trash: what has been deleted, and the two things that can be done about it
// (technical design section 7.3). HTTP parsing only; the service owns the
// separate deleted-recipe scope every statement behind these routes uses.

// Trash has one inherent order - most recently deleted first - so it takes the
// page controls of browse and none of its sorting or filtering.
const trashQuerySchema = listRecipesQuerySchema.pick({ cursor: true, limit: true });

export const trashRoute = new Hono<AppEnv>();

trashRoute.get('/', async (c) => c.json(await listTrash(parseQuery(c, trashQuerySchema))));

// Restoring is not a write against the recipe's own resource: while it is in
// Trash, `/api/recipes/:id` is a 404 (section 10).
trashRoute.post('/:id/restore', async (c) => {
  await restoreFromTrash(idParam(c, 'recipe'));

  return c.body(null, 204);
});

// Permanent deletion. The recipe-name confirmation this needs is the screen's
// job (section 10): the API's guard is that the recipe must already be in
// Trash, so nothing live can be destroyed in one request.
trashRoute.delete('/:id', async (c) => {
  await deleteRecipeForever(idParam(c, 'recipe'), c.get('requestId'));

  return c.body(null, 204);
});
