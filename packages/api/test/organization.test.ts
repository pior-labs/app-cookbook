import type { CategorySummary, TagSummary } from '@cookbook/domain';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closeDatabase } from '../src/db/index.js';
import {
  STARTER_CATEGORIES,
  asUser,
  categoryIdByName,
  createTag,
  createTestApp,
  createUser,
  resetDatabase,
  softDeleteRecipe,
  type AppUnderTest,
  type TestClient,
} from './helpers.js';

// Categories and tags: the pickers the recipe form reads, and the create,
// rename, and delete operations `/organize` performs
// (technical design section 7.3).

const app: AppUnderTest = createTestApp();

let client: TestClient;
let currentUserId: number;

async function createRecipe(overrides: Record<string, unknown> = {}) {
  const response = await client.post('/api/recipes', {
    name: 'Weeknight Chili',
    description: 'A one-pot chili.',
    baseServings: 4,
    categoryId: await categoryIdByName('Dinner'),
    ingredients: [{ name: 'Ground beef' }],
    instructions: [{ body: 'Brown the beef.' }],
    ...overrides,
  });

  expect(response.status).toBe(201);
  return response.json();
}

afterAll(async () => {
  await closeDatabase();
});

beforeEach(async () => {
  await resetDatabase();
  currentUserId = (await createUser()).id;
  client = asUser(app, currentUserId);
});

describe('GET /api/categories', () => {
  it('lists the starter categories alphabetically with zero counts', async () => {
    const response = await client.get('/api/categories');
    expect(response.status).toBe(200);

    const categories = (await response.json()) as CategorySummary[];
    expect(categories.map((category) => category.name)).toEqual(
      [...STARTER_CATEGORIES].sort((a, b) => a.localeCompare(b)),
    );
    expect(categories.every((category) => category.activeRecipeCount === 0)).toBe(true);
  });

  it('counts only live recipes', async () => {
    await createRecipe();
    await createRecipe({ name: 'Second Chili' });

    const categories = (await (await client.get('/api/categories')).json()) as CategorySummary[];
    const dinner = categories.find((category) => category.name === 'Dinner');
    const dessert = categories.find((category) => category.name === 'Dessert');

    expect(dinner?.activeRecipeCount).toBe(2);
    expect(dessert?.activeRecipeCount).toBe(0);
  });

  it('requires authentication', async () => {
    expect((await asUser(app, null).get('/api/categories')).status).toBe(401);
  });
});

describe('GET /api/tags', () => {
  it('returns an empty list before any tag exists', async () => {
    expect(await (await client.get('/api/tags')).json()).toEqual([]);
  });

  it('lists tags alphabetically with active recipe counts', async () => {
    const weeknight = await createTag('Weeknight');
    await createTag('Batch cooking');

    await createRecipe({ tagIds: [weeknight] });

    const tags = (await (await client.get('/api/tags')).json()) as TagSummary[];
    expect(tags.map((tag) => tag.name)).toEqual(['Batch cooking', 'Weeknight']);
    expect(tags.find((tag) => tag.name === 'Weeknight')?.activeRecipeCount).toBe(1);
    expect(tags.find((tag) => tag.name === 'Batch cooking')?.activeRecipeCount).toBe(0);
  });

  it('requires authentication', async () => {
    expect((await asUser(app, null).get('/api/tags')).status).toBe(401);
  });
});

describe('POST /api/tags', () => {
  it('creates a tag the recipe form can immediately use', async () => {
    const response = await client.post('/api/tags', { name: 'Weeknight' });

    expect(response.status).toBe(201);
    const tag = (await response.json()) as { id: number; name: string };
    expect(tag.name).toBe('Weeknight');

    await createRecipe({ tagIds: [tag.id] });
  });

  it('rejects a duplicate regardless of case', async () => {
    await client.post('/api/tags', { name: 'Weeknight' });
    const response = await client.post('/api/tags', { name: '  weeknight  ' });

    expect(response.status).toBe(409);
    const body = (await response.json()) as { error: { code: string; fields: Record<string, string[]> } };
    expect(body.error.code).toBe('tag_already_exists');
    expect(body.error.fields.name).toBeDefined();
  });

  it('rejects an empty name with a field-scoped message', async () => {
    const response = await client.post('/api/tags', { name: '   ' });

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string; fields: Record<string, string[]> } };
    expect(body.error.code).toBe('validation_error');
    expect(body.error.fields.name).toBeDefined();
  });

  it('requires authentication', async () => {
    const response = await asUser(app, null).post('/api/tags', { name: 'Weeknight' });
    expect(response.status).toBe(401);
  });
});

describe('POST /api/categories', () => {
  it('creates a category a recipe can immediately use', async () => {
    const response = await client.post('/api/categories', { name: 'Sides' });

    expect(response.status).toBe(201);
    const category = (await response.json()) as { id: number; name: string };
    expect(category.name).toBe('Sides');

    await createRecipe({ categoryId: category.id });
  });

  it('rejects a duplicate regardless of case', async () => {
    const response = await client.post('/api/categories', { name: '  dinner ' });

    expect(response.status).toBe(409);
    const body = (await response.json()) as {
      error: { code: string; fields: Record<string, string[]> };
    };
    expect(body.error.code).toBe('category_already_exists');
    expect(body.error.fields.name).toBeDefined();
  });

  it('requires authentication', async () => {
    expect((await asUser(app, null).post('/api/categories', { name: 'Sides' })).status).toBe(401);
  });
});

describe('PUT /api/categories/:id', () => {
  it('renames a category', async () => {
    const id = await categoryIdByName('Snack');
    const response = await client.put(`/api/categories/${id}`, { name: 'Snacks' });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id, name: 'Snacks' });

    const categories = (await (await client.get('/api/categories')).json()) as CategorySummary[];
    expect(categories.map((category) => category.name)).toContain('Snacks');
  });

  it('accepts a change of case on the category’s own name', async () => {
    const id = await categoryIdByName('Snack');
    const response = await client.put(`/api/categories/${id}`, { name: 'SNACK' });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ name: 'SNACK' });
  });

  it('rejects a rename onto another category', async () => {
    const id = await categoryIdByName('Snack');
    const response = await client.put(`/api/categories/${id}`, { name: 'dinner' });

    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe('category_already_exists');
  });

  it('returns 404 for a category that does not exist', async () => {
    const response = await client.put('/api/categories/9999', { name: 'Sides' });

    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe('category_not_found');
  });

  it('rejects a malformed ID', async () => {
    expect((await client.put('/api/categories/abc', { name: 'Sides' })).status).toBe(400);
  });
});

describe('DELETE /api/categories/:id', () => {
  it('deletes a category nothing is filed under', async () => {
    const id = await categoryIdByName('Snack');

    expect((await client.delete(`/api/categories/${id}`)).status).toBe(204);

    const categories = (await (await client.get('/api/categories')).json()) as CategorySummary[];
    expect(categories.map((category) => category.name)).not.toContain('Snack');
  });

  it('explains exactly what blocks the delete when live recipes use it', async () => {
    await createRecipe();
    const response = await client.delete(`/api/categories/${await categoryIdByName('Dinner')}`);

    expect(response.status).toBe(409);
    const body = (await response.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('category_in_use');
    expect(body.error.message).toContain('1 recipe');
  });

  // A trashed recipe is restorable, so its category must stay valid
  // (technical design section 10).
  it('refuses while only a trashed recipe references it, and says so', async () => {
    const recipe = await createRecipe();
    await softDeleteRecipe(recipe.id, currentUserId);

    const response = await client.delete(`/api/categories/${await categoryIdByName('Dinner')}`);

    expect(response.status).toBe(409);
    const body = (await response.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('category_in_use');
    expect(body.error.message).toContain('Trash');
  });

  it('returns 404 for a category that does not exist', async () => {
    expect((await client.delete('/api/categories/9999')).status).toBe(404);
  });
});

describe('PUT /api/tags/:id', () => {
  it('renames a tag without disturbing its recipes', async () => {
    const id = await createTag('Weeknight');
    await createRecipe({ tagIds: [id] });

    const response = await client.put(`/api/tags/${id}`, { name: 'Weeknights' });
    expect(response.status).toBe(200);

    const tags = (await (await client.get('/api/tags')).json()) as TagSummary[];
    expect(tags).toEqual([expect.objectContaining({ name: 'Weeknights', activeRecipeCount: 1 })]);
  });

  it('rejects a rename onto another tag', async () => {
    await createTag('Weeknight');
    const other = await createTag('Batch cooking');

    const response = await client.put(`/api/tags/${other}`, { name: 'weeknight' });

    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe('tag_already_exists');
  });

  it('returns 404 for a tag that does not exist', async () => {
    expect((await client.put('/api/tags/9999', { name: 'Weeknight' })).status).toBe(404);
  });
});

describe('DELETE /api/tags/:id', () => {
  it('deletes the tag and removes it from its recipes', async () => {
    const id = await createTag('Weeknight');
    const recipe = await createRecipe({ tagIds: [id] });

    expect((await client.delete(`/api/tags/${id}`)).status).toBe(204);

    expect(await (await client.get('/api/tags')).json()).toEqual([]);
    const reloaded = (await (await client.get(`/api/recipes/${recipe.id}`)).json()) as {
      tags: unknown[];
    };
    expect(reloaded.tags).toEqual([]);
  });

  it('returns 404 for a tag that does not exist', async () => {
    expect((await client.delete('/api/tags/9999')).status).toBe(404);
  });
});
