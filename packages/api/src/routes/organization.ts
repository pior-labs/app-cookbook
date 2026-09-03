import {
  createCategorySchema,
  createTagSchema,
  renameCategorySchema,
  updateTagSchema,
} from '@cookbook/domain';
import { Hono } from 'hono';
import type { AppEnv } from '../middleware/context.js';
import { idParam, parseBody } from './http.js';
import {
  createCategory,
  createTag,
  listCategories,
  listTags,
  removeCategory,
  removeTag,
  renameCategory,
  updateTagDetails,
} from '../services/organization.js';

// Categories and tags for the recipe form and for `/organize`
// (technical design section 7.3). HTTP parsing only; the service owns the
// uniqueness and in-use rules.

export const categoriesRoute = new Hono<AppEnv>();

categoriesRoute.get('/', async (c) => c.json(await listCategories()));

categoriesRoute.post('/', async (c) => {
  const input = await parseBody(c, createCategorySchema);

  return c.json(await createCategory(input.name), 201);
});

categoriesRoute.put('/:id', async (c) => {
  const categoryId = idParam(c, 'category');
  const input = await parseBody(c, renameCategorySchema);

  return c.json(await renameCategory(categoryId, input.name));
});

categoriesRoute.delete('/:id', async (c) => {
  await removeCategory(idParam(c, 'category'));

  return c.body(null, 204);
});

export const tagsRoute = new Hono<AppEnv>();

tagsRoute.get('/', async (c) => c.json(await listTags()));

tagsRoute.post('/', async (c) => {
  const input = await parseBody(c, createTagSchema);

  return c.json(await createTag(input.name, input.color ?? null), 201);
});

tagsRoute.put('/:id', async (c) => {
  const tagId = idParam(c, 'tag');
  const input = await parseBody(c, updateTagSchema);

  return c.json(await updateTagDetails(tagId, input));
});

tagsRoute.delete('/:id', async (c) => {
  await removeTag(idParam(c, 'tag'));

  return c.body(null, 204);
});
