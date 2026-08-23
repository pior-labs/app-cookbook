import type {
  HomeSections,
  RecipeDetail,
  RecipePreferences,
  RecipeSummary,
} from '@cookbook/domain';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closeDatabase } from '../src/db/index.js';
import {
  asUser,
  categoryIdByName,
  createTestApp,
  createUser,
  resetDatabase,
  softDeleteRecipe,
  type AppUnderTest,
  type TestClient,
} from './helpers.js';

// Favorites, ratings, and recently viewed: one person's marks on shared
// household data (technical design sections 4.6 and 7.2).

const app: AppUnderTest = createTestApp();

let client: TestClient;
let userId: number;

async function createRecipe(name = 'Weeknight Chili'): Promise<RecipeDetail> {
  const response = await client.post('/api/recipes', {
    name,
    description: '',
    baseServings: 4,
    categoryId: await categoryIdByName('Dinner'),
    ingredients: [{ name: 'Ground beef' }],
    instructions: [{ body: 'Cook it.' }],
  });

  expect(response.status).toBe(201);
  return (await response.json()) as RecipeDetail;
}

async function preferences(response: Response): Promise<RecipePreferences> {
  expect(response.status).toBe(200);
  return (await response.json()) as RecipePreferences;
}

async function detail(id: number): Promise<RecipeDetail> {
  return (await (await client.get(`/api/recipes/${id}`)).json()) as RecipeDetail;
}

afterAll(async () => {
  await closeDatabase();
});

beforeEach(async () => {
  await resetDatabase();
  userId = (await createUser()).id;
  client = asUser(app, userId);
});

describe('favorites', () => {
  it('favorites a recipe and reports the resulting state', async () => {
    const recipe = await createRecipe();

    const state = await preferences(await client.put(`/api/recipes/${recipe.id}/favorite`, {}));

    expect(state.userState).toEqual({ favorite: true, rating: null });
    expect((await detail(recipe.id)).userState.favorite).toBe(true);
  });

  it('is idempotent in both directions', async () => {
    const recipe = await createRecipe();

    await client.put(`/api/recipes/${recipe.id}/favorite`, {});
    const twice = await preferences(await client.put(`/api/recipes/${recipe.id}/favorite`, {}));
    expect(twice.userState.favorite).toBe(true);

    await client.delete(`/api/recipes/${recipe.id}/favorite`);
    const gone = await preferences(await client.delete(`/api/recipes/${recipe.id}/favorite`));
    expect(gone.userState.favorite).toBe(false);
  });

  it('belongs to one person, not the household', async () => {
    const recipe = await createRecipe();
    const other = await createUser();

    await client.put(`/api/recipes/${recipe.id}/favorite`, {});

    const theirs = await asUser(app, other.id).get(`/api/recipes/${recipe.id}`);
    expect(((await theirs.json()) as RecipeDetail).userState.favorite).toBe(false);
  });

  it('shows up in the home favorites section', async () => {
    const recipe = await createRecipe('Weeknight Chili');
    await client.put(`/api/recipes/${recipe.id}/favorite`, {});

    const home = (await (await client.get('/api/home')).json()) as HomeSections;
    expect(home.favorites.map((item) => item.name)).toEqual(['Weeknight Chili']);
  });

  it('filters browse down to the current user’s favorites', async () => {
    const mine = await createRecipe('Mine');
    await createRecipe('Theirs');
    await client.put(`/api/recipes/${mine.id}/favorite`, {});

    const page = await (await client.get('/api/recipes?favorite=true')).json();
    expect(page.items.map((item: { name: string }) => item.name)).toEqual(['Mine']);
  });

  it('returns 404 for a recipe that does not exist', async () => {
    expect((await client.put('/api/recipes/9999/favorite', {})).status).toBe(404);
    expect((await client.delete('/api/recipes/9999/favorite')).status).toBe(404);
  });

  it('refuses to favorite a recipe that is in Trash', async () => {
    const recipe = await createRecipe();
    await softDeleteRecipe(recipe.id, userId);

    expect((await client.put(`/api/recipes/${recipe.id}/favorite`, {})).status).toBe(404);
  });

  it('requires authentication', async () => {
    const recipe = await createRecipe();

    expect((await asUser(app, null).put(`/api/recipes/${recipe.id}/favorite`, {})).status).toBe(401);
  });
});

describe('ratings', () => {
  it('records a rating and reports the household average with it', async () => {
    const recipe = await createRecipe();

    const state = await preferences(
      await client.put(`/api/recipes/${recipe.id}/rating`, { rating: 4 }),
    );

    expect(state.userState.rating).toBe(4);
    expect(state.rating).toEqual({ average: 4, count: 1 });
  });

  it('replaces the rating instead of adding another', async () => {
    const recipe = await createRecipe();

    await client.put(`/api/recipes/${recipe.id}/rating`, { rating: 2 });
    const state = await preferences(
      await client.put(`/api/recipes/${recipe.id}/rating`, { rating: 5 }),
    );

    expect(state.userState.rating).toBe(5);
    expect(state.rating).toEqual({ average: 5, count: 1 });
  });

  it('averages across the household while reporting only the caller’s own', async () => {
    const recipe = await createRecipe();
    const other = await createUser();

    await client.put(`/api/recipes/${recipe.id}/rating`, { rating: 5 });
    await asUser(app, other.id).put(`/api/recipes/${recipe.id}/rating`, { rating: 2 });

    const mine = await detail(recipe.id);
    expect(mine.userState.rating).toBe(5);
    expect(mine.rating).toEqual({ average: 3.5, count: 2 });
  });

  it('clears a rating and drops it out of the average', async () => {
    const recipe = await createRecipe();
    const other = await createUser();

    await client.put(`/api/recipes/${recipe.id}/rating`, { rating: 1 });
    await asUser(app, other.id).put(`/api/recipes/${recipe.id}/rating`, { rating: 5 });

    const state = await preferences(await client.delete(`/api/recipes/${recipe.id}/rating`));

    expect(state.userState.rating).toBeNull();
    expect(state.rating).toEqual({ average: 5, count: 1 });
  });

  it('reports no average once the last rating is removed', async () => {
    const recipe = await createRecipe();

    await client.put(`/api/recipes/${recipe.id}/rating`, { rating: 3 });
    const state = await preferences(await client.delete(`/api/recipes/${recipe.id}/rating`));

    expect(state.rating).toEqual({ average: null, count: 0 });
  });

  it('clearing a rating that was never set is not an error', async () => {
    const recipe = await createRecipe();

    const state = await preferences(await client.delete(`/api/recipes/${recipe.id}/rating`));
    expect(state.userState.rating).toBeNull();
  });

  it('rejects a rating outside 1 to 5', async () => {
    const recipe = await createRecipe();

    for (const rating of [0, 6, 2.5, -1]) {
      const response = await client.put(`/api/recipes/${recipe.id}/rating`, { rating });

      expect(response.status).toBe(400);
      expect((await response.json()).error.fields.rating).toBeDefined();
    }
  });

  it('rejects a body with no rating at all', async () => {
    const recipe = await createRecipe();

    expect((await client.put(`/api/recipes/${recipe.id}/rating`, {})).status).toBe(400);
  });

  it('feeds the highly rated home section', async () => {
    const recipe = await createRecipe('Weeknight Chili');
    await client.put(`/api/recipes/${recipe.id}/rating`, { rating: 5 });

    const home = (await (await client.get('/api/home')).json()) as HomeSections;
    expect(home.highlyRated.map((item) => item.name)).toEqual(['Weeknight Chili']);
  });

  it('refuses to rate a recipe that is in Trash', async () => {
    const recipe = await createRecipe();
    await softDeleteRecipe(recipe.id, userId);

    expect((await client.put(`/api/recipes/${recipe.id}/rating`, { rating: 4 })).status).toBe(404);
  });

  it('requires authentication', async () => {
    const recipe = await createRecipe();
    const response = await asUser(app, null).put(`/api/recipes/${recipe.id}/rating`, { rating: 4 });

    expect(response.status).toBe(401);
  });
});

describe('recently viewed', () => {
  it('records a view and answers with no body', async () => {
    const recipe = await createRecipe('Weeknight Chili');

    const response = await client.post(`/api/recipes/${recipe.id}/view`, {});
    expect(response.status).toBe(204);

    const home = (await (await client.get('/api/home')).json()) as HomeSections;
    expect(home.recentlyViewed.map((item) => item.name)).toEqual(['Weeknight Chili']);
  });

  it('moves a re-opened recipe back to the top instead of listing it twice', async () => {
    const first = await createRecipe('First');
    const second = await createRecipe('Second');

    await client.post(`/api/recipes/${first.id}/view`, {});
    await client.post(`/api/recipes/${second.id}/view`, {});
    await client.post(`/api/recipes/${first.id}/view`, {});

    const home = (await (await client.get('/api/home')).json()) as HomeSections;
    expect(home.recentlyViewed.map((item) => item.name)).toEqual(['First', 'Second']);
  });

  it('is per user', async () => {
    const recipe = await createRecipe();
    const other = await createUser();

    await client.post(`/api/recipes/${recipe.id}/view`, {});

    const theirs = (await (
      await asUser(app, other.id).get('/api/home')
    ).json()) as HomeSections;
    expect(theirs.recentlyViewed).toEqual([]);
  });

  it('returns 404 for a recipe that does not exist or is in Trash', async () => {
    const recipe = await createRecipe();
    await softDeleteRecipe(recipe.id, userId);

    expect((await client.post('/api/recipes/9999/view', {})).status).toBe(404);
    expect((await client.post(`/api/recipes/${recipe.id}/view`, {})).status).toBe(404);
  });

  it('requires authentication', async () => {
    const recipe = await createRecipe();

    expect((await asUser(app, null).post(`/api/recipes/${recipe.id}/view`, {})).status).toBe(401);
  });
});

describe('GET /api/recent', () => {
  it('returns the acting user’s recent history, most recent first', async () => {
    const first = await createRecipe('First');
    const second = await createRecipe('Second');

    await client.post(`/api/recipes/${first.id}/view`, {});
    await client.post(`/api/recipes/${second.id}/view`, {});

    const response = await client.get('/api/recent');
    expect(response.status).toBe(200);

    const recipes = (await response.json()) as RecipeSummary[];
    expect(recipes.map((recipe) => recipe.name)).toEqual(['Second', 'First']);
  });

  it('returns nothing before anything has been opened', async () => {
    await createRecipe();

    expect(await (await client.get('/api/recent')).json()).toEqual([]);
  });

  it('honours a limit and rejects one past the maximum', async () => {
    for (const name of ['One', 'Two', 'Three']) {
      const recipe = await createRecipe(name);
      await client.post(`/api/recipes/${recipe.id}/view`, {});
    }

    const limited = (await (await client.get('/api/recent?limit=2')).json()) as RecipeSummary[];
    expect(limited).toHaveLength(2);

    expect((await client.get('/api/recent?limit=101')).status).toBe(400);
  });

  it('leaves a trashed recipe out even though the view row survives', async () => {
    const recipe = await createRecipe();
    await client.post(`/api/recipes/${recipe.id}/view`, {});
    await softDeleteRecipe(recipe.id, userId);

    expect(await (await client.get('/api/recent')).json()).toEqual([]);
  });

  it('requires authentication', async () => {
    expect((await asUser(app, null).get('/api/recent')).status).toBe(401);
  });
});
