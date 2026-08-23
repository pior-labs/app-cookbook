import { rm } from 'node:fs/promises';
import { eq, sql } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { storageRoot } from '../src/images/storage.js';
import { db } from '../src/db/index.js';
import {
  categories,
  recentlyViewedRecipes,
  recipes,
  tags,
  userFavorites,
  userRatings,
  users,
} from '../src/db/schema.js';
import { createRequireAuth } from '../src/middleware/auth.js';

// The starter categories the first domain migration seeds. `resetDatabase`
// restores them after truncating, and `starter categories` in the schema tests
// asserts this fixture still matches the migration.
export const STARTER_CATEGORIES = [
  'Breakfast',
  'Lunch',
  'Dinner',
  'Dessert',
  'Snack',
  'Drink',
] as const;

const TRUNCATED_TABLES = [
  'recently_viewed_recipes',
  'user_ratings',
  'user_favorites',
  'recipe_images',
  'recipe_tags',
  'recipe_instructions',
  'recipe_ingredients',
  'recipes',
  'tags',
  'categories',
  'verifications',
  'accounts',
  'sessions',
  'users',
] as const;

// Resets both halves of the application's persistent state. Truncating alone
// would leave uploaded files behind, and `restart identity` reuses recipe IDs,
// so a later test would see a previous test's image folders.
export async function resetDatabase(): Promise<void> {
  await rm(storageRoot(), { recursive: true, force: true });

  await db.execute(
    sql.raw(
      `truncate table ${TRUNCATED_TABLES.map((table) => `"${table}"`).join(
        ', ',
      )} restart identity cascade`,
    ),
  );

  await db
    .insert(categories)
    .values(
      STARTER_CATEGORIES.map((name) => ({ name, normalizedName: name.toLowerCase() })),
    );
}

export async function createUser(
  overrides: { name?: string; email?: string } = {},
): Promise<{ id: number; name: string; email: string }> {
  const suffix = Math.random().toString(36).slice(2, 10);
  const name = overrides.name ?? `Test User ${suffix}`;
  const email = overrides.email ?? `test-${suffix}@example.test`;

  const [row] = await db
    .insert(users)
    .values({ name, email, emailVerified: true })
    .returning({ id: users.id });

  return { id: row.id, name, email };
}

export async function categoryIdByName(name: string): Promise<number> {
  const row = await db.query.categories.findFirst({
    where: (table, { eq }) => eq(table.normalizedName, name.toLowerCase()),
  });

  if (!row) {
    throw new Error(`Test category not found: ${name}`);
  }

  return row.id;
}

export async function createTag(name: string): Promise<number> {
  const [row] = await db
    .insert(tags)
    .values({ name, normalizedName: name.toLowerCase() })
    .returning({ id: tags.id });

  return row.id;
}

// Favorites, ratings, recent history, and Trash have no endpoints yet: they
// arrive in slices 6 and 7. Browse and home already read them, so the suite
// writes the rows directly rather than waiting for the API that will set them.
export async function setFavorite(userId: number, recipeId: number): Promise<void> {
  await db.insert(userFavorites).values({ userId, recipeId });
}

export async function setRating(
  userId: number,
  recipeId: number,
  rating: number,
): Promise<void> {
  await db.insert(userRatings).values({ userId, recipeId, rating });
}

export async function setLastViewed(
  userId: number,
  recipeId: number,
  lastViewedAt: Date,
): Promise<void> {
  await db.insert(recentlyViewedRecipes).values({ userId, recipeId, lastViewedAt });
}

export async function softDeleteRecipe(recipeId: number, userId: number): Promise<void> {
  await db
    .update(recipes)
    .set({ deletedAt: new Date(), deletedByUserId: userId })
    .where(eq(recipes.id, recipeId));
}

// The test app uses the real authorization middleware with a stub session
// lookup, so deny-by-default behavior is exercised without a live OAuth
// provider. A request is authenticated by sending `x-test-user-id`.
export const TEST_USER_HEADER = 'x-test-user-id';

export type AppUnderTest = ReturnType<typeof createApp>;

export function createTestApp() {
  const requireAuth = createRequireAuth(async (headers) => {
    const id = headers.get(TEST_USER_HEADER);
    if (!id) {
      return null;
    }

    return { id, email: `user-${id}@example.test`, name: `User ${id}` };
  });

  return createApp({ requireAuth });
}

export interface TestClient {
  get(path: string, headers?: Record<string, string>): Promise<Response>;
  post(path: string, body: unknown): Promise<Response>;
  put(path: string, body: unknown): Promise<Response>;
  // Multipart upload with the body under the field the photo route expects.
  putFile(path: string, file: Blob, filename?: string, field?: string): Promise<Response>;
  delete(path: string): Promise<Response>;
  raw(path: string, init: RequestInit): Promise<Response>;
}

export function asUser(app: AppUnderTest, userId: number | string | null): TestClient {
  const headers = (extra: Record<string, string> = {}): Record<string, string> => ({
    ...(userId == null ? {} : { [TEST_USER_HEADER]: String(userId) }),
    ...extra,
  });

  const send = async (path: string, method: string, body: unknown) =>
    app.request(path, {
      method,
      headers: headers({ 'content-type': 'application/json' }),
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });

  return {
    get: async (path, extra) => app.request(path, { headers: headers(extra) }),
    post: (path, body) => send(path, 'POST', body),
    put: (path, body) => send(path, 'PUT', body),
    // `FormData` sets its own multipart boundary, so the content type must come
    // from the request body rather than from `headers()`.
    putFile: async (path, file, filename = 'photo.jpg', field = 'photo') => {
      const form = new FormData();
      form.append(field, file, filename);

      return app.request(path, { method: 'PUT', headers: headers(), body: form });
    },
    delete: async (path) => app.request(path, { method: 'DELETE', headers: headers() }),
    raw: async (path, init) =>
      app.request(path, { ...init, headers: headers(init.headers as Record<string, string>) }),
  };
}

