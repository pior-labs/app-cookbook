import { createTagSchema } from '@cookbook/domain';
import { Hono } from 'hono';
import { validationError, zodValidationError } from '../errors.js';
import type { AppEnv } from '../middleware/context.js';
import { createTag, listCategories, listTags } from '../services/organization.js';

// Read access to categories and tags for the recipe form, plus inline tag
// creation (technical design section 7.3). Rename and delete arrive with
// `/organize`.

export const categoriesRoute = new Hono<AppEnv>();

categoriesRoute.get('/', async (c) => c.json(await listCategories()));

export const tagsRoute = new Hono<AppEnv>();

tagsRoute.get('/', async (c) => c.json(await listTags()));

tagsRoute.post('/', async (c) => {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw validationError('Send a JSON request body.');
  }

  const parsed = createTagSchema.safeParse(raw);
  if (!parsed.success) {
    throw zodValidationError(parsed.error);
  }

  return c.json(await createTag(parsed.data.name), 201);
});
