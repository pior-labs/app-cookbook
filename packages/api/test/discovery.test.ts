import type { HomeSections, RecipeDetail, RecipeListPage } from '@cookbook/domain';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closeDatabase } from '../src/db/index.js';
import {
  asUser,
  categoryIdByName,
  createTag,
  createTestApp,
  createUser,
  resetDatabase,
  setFavorite,
  setLastViewed,
  setRating,
  softDeleteRecipe,
  type AppUnderTest,
  type TestClient,
} from './helpers.js';

// Browse, search, filtering, and home discovery against a real migrated
// database (technical design sections 7.2, 9, and 14.2).

const app: AppUnderTest = createTestApp();

let client: TestClient;
let userId: number;

interface RecipeSeed {
  name?: string;
  description?: string;
  category?: string;
  prepMinutes?: number | null;
  cookMinutes?: number | null;
  ingredients?: string[];
  tagIds?: number[];
}

async function createRecipe(seed: RecipeSeed = {}): Promise<RecipeDetail> {
  const response = await client.post('/api/recipes', {
    name: seed.name ?? 'Weeknight Chili',
    description: seed.description ?? '',
    baseServings: 4,
    prepMinutes: seed.prepMinutes === undefined ? 10 : seed.prepMinutes,
    cookMinutes: seed.cookMinutes === undefined ? 20 : seed.cookMinutes,
    categoryId: await categoryIdByName(seed.category ?? 'Dinner'),
    ingredients: (seed.ingredients ?? ['Ground beef']).map((name) => ({ name })),
    instructions: [{ body: 'Cook it.' }],
    tagIds: seed.tagIds ?? [],
  });

  expect(response.status).toBe(201);
  return (await response.json()) as RecipeDetail;
}

async function browse(query = ''): Promise<RecipeListPage> {
  const response = await client.get(`/api/recipes${query}`);
  expect(response.status).toBe(200);

  return (await response.json()) as RecipeListPage;
}

async function names(query = ''): Promise<string[]> {
  return (await browse(query)).items.map((recipe) => recipe.name);
}

afterAll(async () => {
  await closeDatabase();
});

beforeEach(async () => {
  await resetDatabase();
  userId = (await createUser()).id;
  client = asUser(app, userId);
});

describe('GET /api/recipes — browse', () => {
  it('returns an empty page before anything is saved', async () => {
    expect(await browse()).toEqual({ items: [], nextCursor: null });
  });

  it('lists recipes newest first with derived total time', async () => {
    await createRecipe({ name: 'First' });
    const second = await createRecipe({ name: 'Second' });

    const page = await browse();

    expect(page.items.map((recipe) => recipe.name)).toEqual(['Second', 'First']);
    expect(page.items[0].id).toBe(second.id);
    expect(page.items[0].totalMinutes).toBe(30);
    expect(page.items[0].categoryName).toBe('Dinner');
    expect(page.items[0].hasImage).toBe(false);
    expect(page.nextCursor).toBeNull();
  });

  it('excludes a recipe that has been moved to Trash', async () => {
    const trashed = await createRecipe({ name: 'Retired Bake' });
    await createRecipe({ name: 'Weeknight Chili' });
    await softDeleteRecipe(trashed.id, userId);

    expect(await names()).toEqual(['Weeknight Chili']);
  });

  it('requires authentication', async () => {
    expect((await asUser(app, null).get('/api/recipes')).status).toBe(401);
  });

  it('rejects an unknown query parameter rather than ignoring it', async () => {
    const response = await client.get('/api/recipes?madeUp=1');

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe('validation_error');
  });
});

describe('GET /api/recipes — search', () => {
  it('matches the recipe name, description, ingredient, category, and tag', async () => {
    const tagId = await createTag('Batch cooking');
    await createRecipe({ name: 'Weeknight Chili', ingredients: ['Ground beef', 'Cumin'] });
    await createRecipe({ name: 'Pancakes', description: 'Fluffy Sunday breakfast.' });
    await createRecipe({ name: 'Lentil Stew', category: 'Lunch', tagIds: [tagId] });

    expect(await names('?q=chili')).toEqual(['Weeknight Chili']);
    expect(await names('?q=cumin')).toEqual(['Weeknight Chili']);
    expect(await names('?q=fluffy')).toEqual(['Pancakes']);
    expect(await names('?q=lunch')).toEqual(['Lentil Stew']);
    expect(await names('?q=batch')).toEqual(['Lentil Stew']);
  });

  it('requires every token to match somewhere, regardless of case', async () => {
    await createRecipe({ name: 'Weeknight Chili', ingredients: ['Ground beef'] });
    await createRecipe({ name: 'Weeknight Pasta', ingredients: ['Spaghetti'] });

    expect(await names('?q=WEEKNIGHT%20beef')).toEqual(['Weeknight Chili']);
    expect(await names('?q=weeknight%20anchovy')).toEqual([]);
  });

  it('returns one row for a recipe whose ingredients all match', async () => {
    await createRecipe({
      name: 'Pepper Trio',
      ingredients: ['Red pepper', 'Green pepper', 'Black pepper'],
    });

    expect(await names('?q=pepper')).toEqual(['Pepper Trio']);
  });

  it('treats wildcard characters as literal text', async () => {
    await createRecipe({ name: 'Weeknight Chili' });

    // `%` matching everything would return the chili; escaped, it matches
    // nothing because no recipe contains a literal percent sign.
    expect(await names('?q=%25')).toEqual([]);
    expect(await names('?q=_')).toEqual([]);
  });
});

describe('GET /api/recipes — filters', () => {
  it('filters by category', async () => {
    await createRecipe({ name: 'Weeknight Chili', category: 'Dinner' });
    await createRecipe({ name: 'Pancakes', category: 'Breakfast' });

    const breakfast = await categoryIdByName('Breakfast');
    expect(await names(`?categoryId=${breakfast}`)).toEqual(['Pancakes']);
  });

  it('requires every requested tag, not any of them', async () => {
    const weeknight = await createTag('Weeknight');
    const vegetarian = await createTag('Vegetarian');
    await createRecipe({ name: 'Both', tagIds: [weeknight, vegetarian] });
    await createRecipe({ name: 'One', tagIds: [weeknight] });

    expect(await names(`?tagId=${weeknight}`)).toEqual(['One', 'Both']);
    expect(await names(`?tagId=${weeknight}&tagId=${vegetarian}`)).toEqual(['Both']);
  });

  it('counts a repeated tag filter once', async () => {
    const weeknight = await createTag('Weeknight');
    await createRecipe({ name: 'Both', tagIds: [weeknight] });

    expect(await names(`?tagId=${weeknight}&tagId=${weeknight}`)).toEqual(['Both']);
  });

  it('filters by maximum total time and excludes recipes with no recorded time', async () => {
    await createRecipe({ name: 'Quick', prepMinutes: 5, cookMinutes: 10 });
    await createRecipe({ name: 'Slow', prepMinutes: 30, cookMinutes: 90 });
    await createRecipe({ name: 'Unknown', prepMinutes: null, cookMinutes: null });

    expect(await names('?maxTotalMinutes=30')).toEqual(['Quick']);
  });

  it('filters by the household average rating', async () => {
    const other = await createUser();
    const loved = await createRecipe({ name: 'Loved' });
    const mixed = await createRecipe({ name: 'Mixed' });
    await createRecipe({ name: 'Unrated' });

    await setRating(userId, loved.id, 5);
    await setRating(other.id, loved.id, 5);
    await setRating(userId, mixed.id, 4);
    await setRating(other.id, mixed.id, 2);

    expect(await names('?minRating=4')).toEqual(['Loved']);
    expect((await names('?minRating=3')).sort()).toEqual(['Loved', 'Mixed']);
  });

  it('filters by the acting user’s own favorites', async () => {
    const other = await createUser();
    const mine = await createRecipe({ name: 'Mine' });
    const theirs = await createRecipe({ name: 'Theirs' });

    await setFavorite(userId, mine.id);
    await setFavorite(other.id, theirs.id);

    expect(await names('?favorite=true')).toEqual(['Mine']);
  });

  it('composes a text query with filters', async () => {
    const weeknight = await createTag('Weeknight');
    await createRecipe({ name: 'Weeknight Chili', tagIds: [weeknight], cookMinutes: 20 });
    await createRecipe({ name: 'Weeknight Chili Deluxe', cookMinutes: 20 });
    await createRecipe({ name: 'Sunday Chili', tagIds: [weeknight], cookMinutes: 240 });

    expect(await names(`?q=chili&tagId=${weeknight}&maxTotalMinutes=60`)).toEqual([
      'Weeknight Chili',
    ]);
  });

  it('reports each per-recipe rating and favorite state for the acting user', async () => {
    const other = await createUser();
    const recipe = await createRecipe({ name: 'Weeknight Chili' });

    await setFavorite(userId, recipe.id);
    await setRating(userId, recipe.id, 4);
    await setRating(other.id, recipe.id, 2);

    const [summary] = (await browse()).items;

    expect(summary.userState).toEqual({ favorite: true, rating: 4 });
    expect(summary.rating).toEqual({ average: 3, count: 2 });
  });
});

describe('GET /api/recipes — sorting and pagination', () => {
  it('sorts by name, ignoring case', async () => {
    await createRecipe({ name: 'banana bread' });
    await createRecipe({ name: 'Apple Cake' });
    await createRecipe({ name: 'Cherry Pie' });

    expect(await names('?sort=name')).toEqual(['Apple Cake', 'banana bread', 'Cherry Pie']);
  });

  it('sorts by household rating with unrated recipes last', async () => {
    const great = await createRecipe({ name: 'Great' });
    const fine = await createRecipe({ name: 'Fine' });
    await createRecipe({ name: 'Unrated' });

    await setRating(userId, great.id, 5);
    await setRating(userId, fine.id, 3);

    expect(await names('?sort=rating')).toEqual(['Great', 'Fine', 'Unrated']);
  });

  it('sorts by most recently updated', async () => {
    const first = await createRecipe({ name: 'First' });
    await createRecipe({ name: 'Second' });

    const updated = await client.put(`/api/recipes/${first.id}`, {
      name: 'First',
      description: 'Edited.',
      baseServings: 4,
      prepMinutes: 10,
      cookMinutes: 20,
      categoryId: await categoryIdByName('Dinner'),
      ingredients: [{ name: 'Ground beef' }],
      instructions: [{ body: 'Cook it.' }],
      tagIds: [],
      version: first.version,
    });
    expect(updated.status).toBe(200);

    expect(await names('?sort=recentlyUpdated')).toEqual(['First', 'Second']);
  });

  it('walks every page exactly once for each sort', async () => {
    for (const name of ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo']) {
      await createRecipe({ name });
    }

    for (const sort of ['recentlyAdded', 'recentlyUpdated', 'name', 'rating'] as const) {
      const seen: string[] = [];
      let cursor: string | null = null;
      let pages = 0;

      do {
        const page: RecipeListPage = await browse(
          `?sort=${sort}&limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
        );
        seen.push(...page.items.map((recipe) => recipe.name));
        cursor = page.nextCursor;
        pages += 1;
        expect(pages).toBeLessThan(10);
      } while (cursor);

      expect(seen.sort()).toEqual(['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo']);
    }
  });

  it('does not report a next page when the last page is exactly full', async () => {
    await createRecipe({ name: 'Alpha' });
    await createRecipe({ name: 'Bravo' });

    const page = await browse('?limit=2');

    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toBeNull();
  });

  it('keeps filters applied across pages', async () => {
    const weeknight = await createTag('Weeknight');
    for (const name of ['Alpha', 'Bravo', 'Charlie']) {
      await createRecipe({ name, tagIds: [weeknight] });
    }
    await createRecipe({ name: 'Untagged' });

    const first = await browse(`?tagId=${weeknight}&limit=2`);
    expect(first.nextCursor).not.toBeNull();

    const second = await browse(
      `?tagId=${weeknight}&limit=2&cursor=${encodeURIComponent(first.nextCursor!)}`,
    );

    expect([...first.items, ...second.items].map((recipe) => recipe.name).sort()).toEqual([
      'Alpha',
      'Bravo',
      'Charlie',
    ]);
  });

  it('rejects a cursor issued for a different sort', async () => {
    await createRecipe({ name: 'Alpha' });
    await createRecipe({ name: 'Bravo' });

    const page = await browse('?limit=1');
    const response = await client.get(
      `/api/recipes?sort=name&limit=1&cursor=${encodeURIComponent(page.nextCursor!)}`,
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('validation_error');
    expect(body.error.fields.cursor).toBeDefined();
  });

  it('rejects a corrupt cursor with the same recoverable message', async () => {
    const response = await client.get('/api/recipes?cursor=not-a-cursor');

    expect(response.status).toBe(400);
    expect((await response.json()).error.fields.cursor).toBeDefined();
  });

  it('rejects a page size above the maximum', async () => {
    expect((await client.get('/api/recipes?limit=101')).status).toBe(400);
  });
});

describe('GET /api/home', () => {
  it('returns every section empty for a household with no recipes', async () => {
    const response = await client.get('/api/home');
    expect(response.status).toBe(200);

    const home = (await response.json()) as HomeSections;
    expect(home.recentlyViewed).toEqual([]);
    expect(home.favorites).toEqual([]);
    expect(home.highlyRated).toEqual([]);
    expect(home.recentlyAdded).toEqual([]);
    // Categories come from the starter seed, so the screen always has
    // somewhere to send a cook.
    expect(home.categories.length).toBeGreaterThan(0);
  });

  it('fills each section from the acting user’s own state', async () => {
    const other = await createUser();
    const viewed = await createRecipe({ name: 'Viewed' });
    const favorite = await createRecipe({ name: 'Favorite' });
    const rated = await createRecipe({ name: 'Rated' });

    await setLastViewed(userId, viewed.id, new Date('2026-08-20T10:00:00Z'));
    await setLastViewed(other.id, rated.id, new Date('2026-08-21T10:00:00Z'));
    await setFavorite(userId, favorite.id);
    await setFavorite(other.id, rated.id);
    await setRating(userId, rated.id, 5);

    const home = (await (await client.get('/api/home')).json()) as HomeSections;

    expect(home.recentlyViewed.map((recipe) => recipe.name)).toEqual(['Viewed']);
    expect(home.favorites.map((recipe) => recipe.name)).toEqual(['Favorite']);
    expect(home.highlyRated.map((recipe) => recipe.name)).toEqual(['Rated']);
    expect(home.recentlyAdded.map((recipe) => recipe.name)).toEqual([
      'Rated',
      'Favorite',
      'Viewed',
    ]);
  });

  it('orders recently viewed by the acting user’s own view time', async () => {
    const older = await createRecipe({ name: 'Older' });
    const newer = await createRecipe({ name: 'Newer' });

    await setLastViewed(userId, older.id, new Date('2026-08-01T10:00:00Z'));
    await setLastViewed(userId, newer.id, new Date('2026-08-22T10:00:00Z'));

    const home = (await (await client.get('/api/home')).json()) as HomeSections;
    expect(home.recentlyViewed.map((recipe) => recipe.name)).toEqual(['Newer', 'Older']);
  });

  it('leaves a trashed recipe out of every section', async () => {
    const trashed = await createRecipe({ name: 'Retired Bake' });
    await setFavorite(userId, trashed.id);
    await setRating(userId, trashed.id, 5);
    await setLastViewed(userId, trashed.id, new Date('2026-08-22T10:00:00Z'));
    await softDeleteRecipe(trashed.id, userId);

    const home = (await (await client.get('/api/home')).json()) as HomeSections;

    expect(home.recentlyViewed).toEqual([]);
    expect(home.favorites).toEqual([]);
    expect(home.highlyRated).toEqual([]);
    expect(home.recentlyAdded).toEqual([]);
  });

  it('requires authentication', async () => {
    expect((await asUser(app, null).get('/api/home')).status).toBe(401);
  });
});
