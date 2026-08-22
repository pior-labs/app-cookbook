import type { RecipeDetail } from '@cookbook/domain';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closeDatabase } from '../src/db/index.js';
import {
  asUser,
  categoryIdByName,
  createTag,
  createTestApp,
  createUser,
  resetDatabase,
  type AppUnderTest,
  type TestClient,
} from './helpers.js';

// Integration coverage for the recipe aggregate: create, read, update,
// validation, and optimistic concurrency (technical design section 14.2).

const app: AppUnderTest = createTestApp();

let dinnerId: number;
let user: { id: number };
let client: TestClient;

function recipeBody(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Weeknight Chili',
    description: 'A one-pot chili the household actually finishes.',
    baseServings: 4,
    prepMinutes: 15,
    cookMinutes: 45,
    notes: 'Better the next day.',
    categoryId: dinnerId,
    sourceUrl: 'https://example.test/chili',
    ingredients: [
      { name: 'Ground beef', quantity: '1 1/2', unitCode: 'lb' },
      { name: 'Yellow onion', quantity: '1', preparation: 'diced' },
      { name: 'Salt' },
    ],
    instructions: [{ body: 'Brown the beef.' }, { body: 'Simmer everything for 45 minutes.' }],
    ...overrides,
  };
}

async function createRecipe(overrides: Record<string, unknown> = {}): Promise<RecipeDetail> {
  const response = await client.post('/api/recipes', recipeBody(overrides));
  expect(response.status).toBe(201);
  return (await response.json()) as RecipeDetail;
}

function updateBodyFrom(recipe: RecipeDetail, overrides: Record<string, unknown> = {}) {
  return recipeBody({ version: recipe.version, ...overrides });
}

afterAll(async () => {
  await closeDatabase();
});

beforeEach(async () => {
  await resetDatabase();
  dinnerId = await categoryIdByName('Dinner');
  user = await createUser();
  client = asUser(app, user.id);
});

describe('authorization boundary', () => {
  it('rejects unauthenticated recipe reads with the error envelope', async () => {
    const response = await asUser(app, null).get('/api/recipes/1');

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: 'unauthorized', message: 'Sign in to continue.', fields: {} },
    });
  });

  it('rejects unauthenticated recipe writes', async () => {
    const response = await asUser(app, null).post('/api/recipes', recipeBody());

    expect(response.status).toBe(401);
  });

  it('leaves the health endpoints public', async () => {
    expect((await app.request('/health')).status).toBe(200);
    expect((await app.request('/api/health')).status).toBe(200);
  });

  it('returns a request ID on both successful and rejected requests', async () => {
    const rejected = await asUser(app, null).get('/api/recipes/1');
    expect(rejected.headers.get('x-request-id')).toBeTruthy();

    const echoed = await app.request('/health', { headers: { 'x-request-id': 'trace-me' } });
    expect(echoed.headers.get('x-request-id')).toBe('trace-me');
  });
});

describe('POST /api/recipes', () => {
  it('creates the full aggregate and returns it at version 1', async () => {
    const recipe = await createRecipe();

    expect(recipe.id).toBeGreaterThan(0);
    expect(recipe.version).toBe(1);
    expect(recipe.name).toBe('Weeknight Chili');
    expect(recipe.categoryId).toBe(dinnerId);
    expect(recipe.categoryName).toBe('Dinner');
    expect(recipe.createdByUserId).toBe(user.id);
    expect(recipe.totalMinutes).toBe(60);
    expect(recipe.sourceUrl).toBe('https://example.test/chili');
    expect(recipe.sourceText).toBeNull();
    expect(recipe.hasImage).toBe(false);
    expect(recipe.image).toBeNull();
    expect(recipe.rating).toEqual({ average: null, count: 0 });
    expect(recipe.userState).toEqual({ favorite: false, rating: null });
    expect(recipe.tags).toEqual([]);
  });

  it('stores quantities as exact reduced fractions and derives positions', async () => {
    const recipe = await createRecipe();

    expect(recipe.ingredients.map((ingredient) => ingredient.position)).toEqual([0, 1, 2]);
    expect(recipe.ingredients[0]).toMatchObject({
      name: 'Ground beef',
      quantity: { numerator: 3, denominator: 2 },
      unitCode: 'lb',
      unitText: null,
      preparation: null,
    });
    expect(recipe.ingredients[1]).toMatchObject({
      quantity: { numerator: 1, denominator: 1 },
      preparation: 'diced',
    });
    // "Salt" carries no quantity, the `salt to taste` case.
    expect(recipe.ingredients[2].quantity).toBeNull();
    expect(recipe.instructions.map((step) => step.position)).toEqual([0, 1]);
  });

  it('ignores a client-supplied position and derives it from array order', async () => {
    const response = await client.post(
      '/api/recipes',
      recipeBody({
        instructions: [{ body: 'Second step.', position: 99 }, { body: 'First step.' }],
      }),
    );

    // Unknown fields are rejected for mutations, so a stray position is a
    // validation error rather than a silently honored ordering hint.
    expect(response.status).toBe(400);
  });

  it('attaches existing tags', async () => {
    const quick = await createTag('Quick');
    const freezer = await createTag('Freezer');

    const recipe = await createRecipe({ tagIds: [quick, freezer] });

    expect(recipe.tags.map((tag) => tag.name)).toEqual(['Freezer', 'Quick']);
  });

  it('takes created-by from the session and refuses it in the body', async () => {
    const other = await createUser();

    const rejected = await client.post(
      '/api/recipes',
      recipeBody({ createdByUserId: other.id }),
    );
    expect(rejected.status).toBe(400);

    const recipe = await createRecipe();
    expect(recipe.createdByUserId).toBe(user.id);
  });
});

describe('GET /api/recipes/:id', () => {
  it('returns the stored aggregate', async () => {
    const created = await createRecipe();
    const response = await client.get(`/api/recipes/${created.id}`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(created);
  });

  it('returns 404 for a recipe that does not exist', async () => {
    const response = await client.get('/api/recipes/424242');

    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe('recipe_not_found');
  });

  it('rejects a non-numeric id', async () => {
    const response = await client.get('/api/recipes/not-an-id');

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe('validation_error');
  });
});

describe('PUT /api/recipes/:id', () => {
  it('replaces editable fields and bumps the version', async () => {
    const created = await createRecipe();
    const response = await client.put(
      `/api/recipes/${created.id}`,
      updateBodyFrom(created, {
        name: 'Sunday Chili',
        baseServings: 8,
        sourceUrl: null,
        sourceText: 'Grandma',
      }),
    );

    expect(response.status).toBe(200);
    const updated = (await response.json()) as RecipeDetail;
    expect(updated.version).toBe(2);
    expect(updated.name).toBe('Sunday Chili');
    expect(updated.baseServings).toBe(8);
    expect(updated.sourceUrl).toBeNull();
    expect(updated.sourceText).toBe('Grandma');
    expect(updated.createdAt).toBe(created.createdAt);
  });

  it('replaces ordered child collections wholesale', async () => {
    const created = await createRecipe();
    const response = await client.put(
      `/api/recipes/${created.id}`,
      updateBodyFrom(created, {
        ingredients: [{ name: 'Black beans', quantity: '2', unitText: 'cans' }],
        instructions: [{ body: 'Open the cans.' }],
      }),
    );

    const updated = (await response.json()) as RecipeDetail;
    expect(updated.ingredients).toHaveLength(1);
    expect(updated.ingredients[0]).toMatchObject({
      position: 0,
      name: 'Black beans',
      unitCode: null,
      unitText: 'cans',
    });
    expect(updated.instructions).toHaveLength(1);
    expect(updated.instructions[0].position).toBe(0);
  });

  it('replaces tag assignments', async () => {
    const quick = await createTag('Quick');
    const freezer = await createTag('Freezer');
    const created = await createRecipe({ tagIds: [quick] });

    const response = await client.put(
      `/api/recipes/${created.id}`,
      updateBodyFrom(created, { tagIds: [freezer] }),
    );

    const updated = (await response.json()) as RecipeDetail;
    expect(updated.tags.map((tag) => tag.name)).toEqual(['Freezer']);
  });

  it('rejects a stale version with a conflict instead of overwriting', async () => {
    const created = await createRecipe();
    const first = await client.put(
      `/api/recipes/${created.id}`,
      updateBodyFrom(created, { name: 'First save' }),
    );
    expect(first.status).toBe(200);

    const second = await client.put(
      `/api/recipes/${created.id}`,
      updateBodyFrom(created, { name: 'Second save' }),
    );

    expect(second.status).toBe(409);
    expect((await second.json()).error.code).toBe('recipe_version_conflict');

    const current = (await (await client.get(`/api/recipes/${created.id}`)).json()) as RecipeDetail;
    expect(current.name).toBe('First save');
    expect(current.version).toBe(2);
  });

  it('leaves the aggregate untouched when the update fails', async () => {
    const created = await createRecipe();
    const response = await client.put(
      `/api/recipes/${created.id}`,
      updateBodyFrom(created, { categoryId: 999_999, name: 'Never saved' }),
    );

    expect(response.status).toBe(400);
    const current = (await (await client.get(`/api/recipes/${created.id}`)).json()) as RecipeDetail;
    expect(current.name).toBe('Weeknight Chili');
    expect(current.version).toBe(1);
  });

  it('returns 404 for a recipe that does not exist', async () => {
    const response = await client.put('/api/recipes/424242', recipeBody({ version: 1 }));

    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe('recipe_not_found');
  });
});

describe('validation', () => {
  it('rejects an empty name with a field-scoped envelope', async () => {
    const response = await client.post('/api/recipes', recipeBody({ name: '   ' }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('validation_error');
    expect(body.error.fields.name).toBeDefined();
  });

  it('rejects unknown fields', async () => {
    const response = await client.post('/api/recipes', recipeBody({ favorite: true }));

    expect(response.status).toBe(400);
  });

  it('rejects a recipe with no ingredients or no instructions', async () => {
    expect((await client.post('/api/recipes', recipeBody({ ingredients: [] }))).status).toBe(400);
    expect((await client.post('/api/recipes', recipeBody({ instructions: [] }))).status).toBe(400);
  });

  it('rejects both a source link and source text', async () => {
    const response = await client.post(
      '/api/recipes',
      recipeBody({ sourceUrl: 'https://example.test', sourceText: 'A book' }),
    );

    expect(response.status).toBe(400);
    expect((await response.json()).error.fields.sourceText).toBeDefined();
  });

  it('rejects a non-http source link', async () => {
    const response = await client.post(
      '/api/recipes',
      recipeBody({ sourceUrl: 'javascript:alert(1)' }),
    );

    expect(response.status).toBe(400);
  });

  it('rejects an unparseable quantity and points at the row', async () => {
    const response = await client.post(
      '/api/recipes',
      recipeBody({ ingredients: [{ name: 'Flour', quantity: 'a heap' }] }),
    );

    expect(response.status).toBe(400);
    expect((await response.json()).error.fields['ingredients.0.quantity']).toBeDefined();
  });

  it('rejects both a known unit and a custom unit on one ingredient', async () => {
    const response = await client.post(
      '/api/recipes',
      recipeBody({
        ingredients: [{ name: 'Milk', quantity: '1', unitCode: 'cup', unitText: 'glug' }],
      }),
    );

    expect(response.status).toBe(400);
  });

  it('rejects duplicate tag ids', async () => {
    const quick = await createTag('Quick');
    const response = await client.post('/api/recipes', recipeBody({ tagIds: [quick, quick] }));

    expect(response.status).toBe(400);
    expect((await response.json()).error.fields.tagIds).toBeDefined();
  });

  it('rejects a category that does not exist', async () => {
    const response = await client.post('/api/recipes', recipeBody({ categoryId: 999_999 }));

    expect(response.status).toBe(400);
    expect((await response.json()).error.fields.categoryId).toBeDefined();
  });

  it('rejects a tag that does not exist', async () => {
    const response = await client.post('/api/recipes', recipeBody({ tagIds: [999_999] }));

    expect(response.status).toBe(400);
    expect((await response.json()).error.fields.tagIds).toBeDefined();
  });

  it('rejects a malformed JSON body', async () => {
    const response = await client.raw('/api/recipes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{ not json',
    });

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe('validation_error');
  });

  it('accepts an empty description and no times', async () => {
    const recipe = await createRecipe({
      description: '',
      prepMinutes: null,
      cookMinutes: null,
      notes: null,
      sourceUrl: null,
    });

    expect(recipe.description).toBe('');
    expect(recipe.totalMinutes).toBeNull();
    expect(recipe.notes).toBeNull();
  });
});
