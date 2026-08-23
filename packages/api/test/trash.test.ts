import type { HomeSections, RecipeDetail, TrashListPage, TrashedRecipe } from '@cookbook/domain';
import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closeDatabase, db } from '../src/db/index.js';
import {
  recipeImages,
  recipeIngredients,
  recentlyViewedRecipes,
  userFavorites,
  userRatings,
} from '../src/db/schema.js';
import { listStoredFolders } from '../src/images/storage.js';
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

// Recoverable deletion end to end (technical design section 10, ADR 0005).
// The question every test here asks is the one a cook cares about: after the
// mistake, is the recipe still the recipe?

const app: AppUnderTest = createTestApp();

let client: TestClient;
let user: { id: number; name: string; email: string };

async function createRecipe(name = 'Weeknight Chili', tagIds: number[] = []): Promise<RecipeDetail> {
  const response = await client.post('/api/recipes', {
    name,
    description: 'A one-pot chili the household actually finishes.',
    baseServings: 4,
    categoryId: await categoryIdByName('Dinner'),
    ingredients: [{ name: 'Ground beef', quantity: '1 1/2', unitCode: 'lb' }],
    instructions: [{ body: 'Brown the beef.' }],
    tagIds,
  });

  expect(response.status).toBe(201);
  return (await response.json()) as RecipeDetail;
}

async function trash(recipeId: number): Promise<void> {
  expect((await client.delete(`/api/recipes/${recipeId}`)).status).toBe(204);
}

async function listTrash(query = ''): Promise<TrashListPage> {
  const response = await client.get(`/api/trash${query}`);
  expect(response.status).toBe(200);
  return (await response.json()) as TrashListPage;
}

async function uploadPhoto(recipeId: number): Promise<void> {
  const data = await sharp({
    create: { width: 800, height: 600, channels: 3, background: { r: 180, g: 90, b: 40 } },
  })
    .jpeg()
    .toBuffer();

  const response = await client.putFile(
    `/api/recipes/${recipeId}/photo`,
    new Blob([data], { type: 'image/jpeg' }),
  );
  expect(response.status).toBe(200);
}

afterAll(async () => {
  await closeDatabase();
});

beforeEach(async () => {
  await resetDatabase();
  user = await createUser({ name: 'Alex Cook' });
  client = asUser(app, user.id);
});

describe('moving a recipe to Trash', () => {
  it('removes it from the live cookbook without destroying anything', async () => {
    const recipe = await createRecipe();

    await trash(recipe.id);

    expect((await client.get(`/api/recipes/${recipe.id}`)).status).toBe(404);

    const rows = await db
      .select({ id: recipeIngredients.id })
      .from(recipeIngredients)
      .where(eq(recipeIngredients.recipeId, recipe.id));

    expect(rows).toHaveLength(1);
  });

  it('drops it out of browse, home, and recent history', async () => {
    const recipe = await createRecipe('Weeknight Chili');
    await client.put(`/api/recipes/${recipe.id}/favorite`, {});
    await client.post(`/api/recipes/${recipe.id}/view`, {});
    await createRecipe('Sunday Roast');

    await trash(recipe.id);

    const browse = await (await client.get('/api/recipes')).json();
    expect(browse.items.map((item: { name: string }) => item.name)).toEqual(['Sunday Roast']);

    const home = (await (await client.get('/api/home')).json()) as HomeSections;
    expect(home.favorites).toHaveLength(0);
    expect(home.recentlyViewed).toHaveLength(0);

    expect(await (await client.get('/api/recent')).json()).toHaveLength(0);
  });

  it('records who put it there', async () => {
    const recipe = await createRecipe();
    await trash(recipe.id);

    const [row] = (await listTrash()).items;

    expect(row).toMatchObject({
      id: recipe.id,
      name: 'Weeknight Chili',
      categoryName: 'Dinner',
      deletedByUserId: user.id,
      deletedByName: 'Alex Cook',
    });
    expect(Date.parse(row.deletedAt)).not.toBeNaN();
  });

  it('cannot be deleted twice', async () => {
    const recipe = await createRecipe();
    await trash(recipe.id);

    const again = await client.delete(`/api/recipes/${recipe.id}`);

    expect(again.status).toBe(404);
    expect((await again.json()).error.code).toBe('recipe_not_found');
    expect((await listTrash()).items).toHaveLength(1);
  });

  it('refuses per-user and photo actions once a recipe is in Trash', async () => {
    const recipe = await createRecipe();
    await trash(recipe.id);

    expect((await client.put(`/api/recipes/${recipe.id}/favorite`, {})).status).toBe(404);
    expect((await client.put(`/api/recipes/${recipe.id}/rating`, { rating: 4 })).status).toBe(404);
    expect((await client.post(`/api/recipes/${recipe.id}/view`, {})).status).toBe(404);
    expect((await client.get(`/api/recipes/${recipe.id}/photo/card`)).status).toBe(404);
  });

  it('returns 404 for a recipe that does not exist', async () => {
    expect((await client.delete('/api/recipes/9999')).status).toBe(404);
  });

  it('requires authentication', async () => {
    const recipe = await createRecipe();

    expect((await asUser(app, null).delete(`/api/recipes/${recipe.id}`)).status).toBe(401);
  });
});

describe('listing Trash', () => {
  it('shows the most recently deleted first and nothing that is still live', async () => {
    const first = await createRecipe('First');
    const second = await createRecipe('Second');
    await createRecipe('Still here');

    await trash(first.id);
    await trash(second.id);

    expect((await listTrash()).items.map((item: TrashedRecipe) => item.name)).toEqual([
      'Second',
      'First',
    ]);
  });

  it('pages through every trashed recipe exactly once', async () => {
    for (const name of ['One', 'Two', 'Three', 'Four', 'Five']) {
      await trash((await createRecipe(name)).id);
    }

    const seen: string[] = [];
    let cursor: string | null = null;

    do {
      const page: TrashListPage = await listTrash(
        `?limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
      );

      seen.push(...page.items.map((item) => item.name));
      cursor = page.nextCursor;
    } while (cursor);

    expect(seen).toEqual(['Five', 'Four', 'Three', 'Two', 'One']);
  });

  it('rejects a browse cursor with a recoverable, field-scoped error', async () => {
    for (const name of ['One', 'Two']) {
      await createRecipe(name);
    }

    const browse = await (await client.get('/api/recipes?limit=1')).json();
    const response = await client.get(
      `/api/trash?cursor=${encodeURIComponent(browse.nextCursor)}`,
    );

    expect(response.status).toBe(400);
    expect((await response.json()).error.fields.cursor).toBeDefined();
  });

  it('rejects a corrupt cursor the same way', async () => {
    const response = await client.get('/api/trash?cursor=not-a-cursor');

    expect(response.status).toBe(400);
    expect((await response.json()).error.fields.cursor).toBeDefined();
  });

  it('requires authentication', async () => {
    expect((await asUser(app, null).get('/api/trash')).status).toBe(401);
  });
});

describe('restoring from Trash', () => {
  it('gives back the recipe that was deleted, not a reconstruction of it', async () => {
    const tagId = await createTag('Weeknight');
    const recipe = await createRecipe('Weeknight Chili', [tagId]);
    const other = asUser(app, (await createUser()).id);

    await client.put(`/api/recipes/${recipe.id}/favorite`, {});
    await client.put(`/api/recipes/${recipe.id}/rating`, { rating: 5 });
    await other.put(`/api/recipes/${recipe.id}/rating`, { rating: 3 });
    await client.post(`/api/recipes/${recipe.id}/view`, {});

    await trash(recipe.id);
    expect((await client.post(`/api/trash/${recipe.id}/restore`, {})).status).toBe(204);

    const restored = (await (await client.get(`/api/recipes/${recipe.id}`)).json()) as RecipeDetail;

    expect(restored.ingredients).toHaveLength(1);
    expect(restored.instructions).toHaveLength(1);
    expect(restored.tags.map((tag) => tag.name)).toEqual(['Weeknight']);
    expect(restored.userState).toEqual({ favorite: true, rating: 5 });
    expect(restored.rating).toEqual({ average: 4, count: 2 });
    expect(restored.version).toBe(recipe.version);

    expect(await (await client.get('/api/recent')).json()).toHaveLength(1);
    expect((await listTrash()).items).toHaveLength(0);
  });

  it('puts it back in browse and leaves it editable', async () => {
    const recipe = await createRecipe();
    await trash(recipe.id);
    await client.post(`/api/trash/${recipe.id}/restore`, {});

    const browse = await (await client.get('/api/recipes')).json();
    expect(browse.items).toHaveLength(1);

    const saved = await client.put(`/api/recipes/${recipe.id}`, {
      name: 'Weeknight Chili',
      description: 'Now with more chili.',
      baseServings: 4,
      categoryId: await categoryIdByName('Dinner'),
      ingredients: [{ name: 'Ground beef' }],
      instructions: [{ body: 'Brown the beef.' }],
      version: recipe.version,
    });

    expect(saved.status).toBe(200);
  });

  it('refuses a recipe that is not in Trash', async () => {
    const recipe = await createRecipe();

    const live = await client.post(`/api/trash/${recipe.id}/restore`, {});
    expect(live.status).toBe(404);
    expect((await live.json()).error.code).toBe('recipe_not_in_trash');

    await trash(recipe.id);
    await client.post(`/api/trash/${recipe.id}/restore`, {});

    expect((await client.post(`/api/trash/${recipe.id}/restore`, {})).status).toBe(404);
  });

  it('requires authentication', async () => {
    const recipe = await createRecipe();
    await trash(recipe.id);

    expect((await asUser(app, null).post(`/api/trash/${recipe.id}/restore`, {})).status).toBe(401);
  });
});

describe('permanently deleting from Trash', () => {
  it('removes the recipe and everything that hung off it', async () => {
    const recipe = await createRecipe();
    const other = asUser(app, (await createUser()).id);

    await client.put(`/api/recipes/${recipe.id}/favorite`, {});
    await other.put(`/api/recipes/${recipe.id}/rating`, { rating: 2 });
    await client.post(`/api/recipes/${recipe.id}/view`, {});

    await trash(recipe.id);
    expect((await client.delete(`/api/trash/${recipe.id}`)).status).toBe(204);

    expect((await listTrash()).items).toHaveLength(0);
    expect((await client.get(`/api/recipes/${recipe.id}`)).status).toBe(404);

    const remaining = await Promise.all([
      db.select().from(recipeIngredients).where(eq(recipeIngredients.recipeId, recipe.id)),
      db.select().from(userFavorites).where(eq(userFavorites.recipeId, recipe.id)),
      db.select().from(userRatings).where(eq(userRatings.recipeId, recipe.id)),
      db
        .select()
        .from(recentlyViewedRecipes)
        .where(eq(recentlyViewedRecipes.recipeId, recipe.id)),
    ]);

    expect(remaining.map((rows) => rows.length)).toEqual([0, 0, 0, 0]);
  });

  it('takes the photo files with it', async () => {
    const recipe = await createRecipe();
    await uploadPhoto(recipe.id);

    await trash(recipe.id);
    // Soft deletion keeps the files, which is what makes restoration lossless.
    expect(await listStoredFolders()).toHaveLength(1);

    await client.delete(`/api/trash/${recipe.id}`);

    expect(await listStoredFolders()).toHaveLength(0);
    expect(
      await db.select().from(recipeImages).where(eq(recipeImages.recipeId, recipe.id)),
    ).toHaveLength(0);
  });

  it('cannot reach a live recipe', async () => {
    const recipe = await createRecipe();

    const response = await client.delete(`/api/trash/${recipe.id}`);

    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe('recipe_not_in_trash');
    expect((await client.get(`/api/recipes/${recipe.id}`)).status).toBe(200);
  });

  it('frees the category a trashed recipe was holding', async () => {
    const categoryId = await categoryIdByName('Dinner');
    const recipe = await createRecipe();
    await trash(recipe.id);

    const blocked = await client.delete(`/api/categories/${categoryId}`);
    expect(blocked.status).toBe(409);
    expect((await blocked.json()).error.message).toContain('Trash');

    await client.delete(`/api/trash/${recipe.id}`);

    expect((await client.delete(`/api/categories/${categoryId}`)).status).toBe(204);
  });

  it('requires authentication', async () => {
    const recipe = await createRecipe();
    await trash(recipe.id);

    expect((await asUser(app, null).delete(`/api/trash/${recipe.id}`)).status).toBe(401);
  });
});
