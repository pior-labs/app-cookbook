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
  type AppUnderTest,
  type TestClient,
} from './helpers.js';

// Read access to categories and tags, which the recipe form depends on
// (technical design section 7.3).

const app: AppUnderTest = createTestApp();

let client: TestClient;

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
  client = asUser(app, (await createUser()).id);
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
