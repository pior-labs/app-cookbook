import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { db, closeDatabase } from '../src/db/index.js';
import {
  asUser,
  categoryIdByName,
  createTestApp,
  createUser,
  resetDatabase,
  softDeleteRecipe,
  type TestClient,
} from './helpers.js';
import { scaleQuantity } from '@cookbook/domain';
const mocks = vi.hoisted(() => ({ provider: vi.fn(), page: vi.fn(), photo: vi.fn() }));
vi.mock('../src/ai/provider.js', () => ({ openAIProvider: mocks.provider }));
vi.mock('../src/import/fetch.js', async (original) => ({
  ...(await original<object>()),
  fetchRecipePage: mocks.page,
  fetchPublicResource: mocks.photo,
}));
const content = {
  name: 'Weeknight tomato soup',
  description: 'A simple soup.',
  baseServings: null,
  prepMinutes: null,
  cookMinutes: 15,
  notes: null,
  ingredients: [
    {
      name: 'tomatoes',
      quantity: '1 1/2',
      unitCode: 'cup',
      unitText: null,
      preparation: 'chopped',
      originalText: '1 1/2 cups tomatoes, chopped',
    },
  ],
  instructions: [{ body: 'Simmer the tomatoes.' }],
  warnings: [],
};
const app = createTestApp();
let client: TestClient;
let userId: number;
let categoryId: number;
beforeEach(async () => {
  await resetDatabase();
  userId = (await createUser()).id;
  categoryId = await categoryIdByName('Dinner');
  client = asUser(app, userId);
  mocks.provider.mockResolvedValue({ value: structuredClone(content) });
});
afterEach(() => vi.resetAllMocks());
afterAll(closeDatabase);
async function previewText() {
  const response = await client.post('/api/recipe-imports', {
    method: 'text',
    text: '1 1/2 cups tomatoes, chopped. Simmer.',
  });
  expect(response.status).toBe(200);
  return response.json();
}
function saveBody(preview: typeof content) {
  const { warnings: _warnings, ...recipe } = preview;
  return { ...recipe, baseServings: 2, categoryId, importMethod: 'text' };
}

describe('recipe import HTTP and persistence', () => {
  it('requires authentication before extraction', async () => {
    expect(
      (await asUser(app, null).post('/api/recipe-imports', { method: 'text', text: 'Soup' }))
        .status,
    ).toBe(401);
    expect(
      (
        await asUser(app, null).putFile(
          '/api/recipe-imports/image',
          new Blob(['x']),
          'x.png',
          'image',
        )
      ).status,
    ).toBe(401);
    expect(mocks.provider).not.toHaveBeenCalled();
  });
  it('does not persist previews, keeps unknown servings blank, and creates only through normal validation', async () => {
    const draft = await previewText();
    expect(draft.baseServings).toBeNull();
    expect(await db.query.recipes.findMany()).toHaveLength(0);
    expect(
      (await client.post('/api/recipes', { ...saveBody(content), baseServings: null })).status,
    ).toBe(400);
    const saved = await client.post('/api/recipes', saveBody(content));
    expect(saved.status).toBe(201);
    const recipe = await saved.json();
    expect(recipe).toMatchObject({
      importMethod: 'text',
      createdByUserId: userId,
      baseServings: 2,
    });
    expect(recipe.ingredients[0]).toMatchObject({
      quantity: { numerator: 3, denominator: 2 },
      originalText: content.ingredients[0].originalText,
    });
    expect(scaleQuantity(recipe.ingredients[0].quantity, 2, 4)).toEqual({
      numerator: 3,
      denominator: 1,
    });
    const updated = await client.put(`/api/recipes/${recipe.id}`, {
      ...saveBody(content),
      version: recipe.version,
      name: 'Edited soup',
    });
    expect(updated.status).toBe(200);
    expect((await updated.json()).ingredients[0].originalText).toBe(
      content.ingredients[0].originalText,
    );
  });
  it('warns about similar active titles and matching sources, permits duplicates and ignores trash', async () => {
    const first = await client.post('/api/recipes', {
      ...saveBody(content),
      sourceUrl: 'https://example.com/soup/',
    });
    const existing = await first.json();
    expect((await previewText()).duplicates).toEqual([
      { id: existing.id, name: content.name, reason: 'title' },
    ]);
    mocks.page.mockResolvedValue({ html: '<main>Soup</main>', url: 'https://example.com/soup' });
    const linked = await client.post('/api/recipe-imports', {
      method: 'url',
      url: 'https://example.com/soup#recipe',
    });
    expect((await linked.json()).duplicates[0].reason).toBe('url');
    expect((await client.post('/api/recipes', saveBody(content))).status).toBe(201);
    await softDeleteRecipe(existing.id, userId);
    expect((await previewText()).duplicates).toHaveLength(1);
  });
  it('imports a page photo into the preview without storing it, and treats photo failure as optional', async () => {
    mocks.page.mockResolvedValue({
      html: '<meta property="og:image" content="/soup.png"><main>Soup</main>',
      url: 'https://example.com/soup',
    });
    const data = await sharp({ create: { width: 30, height: 20, channels: 3, background: 'red' } })
      .png()
      .toBuffer();
    mocks.photo.mockResolvedValue({ data });
    const response = await client.post('/api/recipe-imports', {
      method: 'url',
      url: 'https://example.com/soup',
    });
    const draft = await response.json();
    expect(response.status).toBe(200);
    expect(draft.sourceUrl).toBe('https://example.com/soup');
    expect(draft.photoDataUrl).toMatch(/^data:image\/webp;base64,/);
    expect(await db.query.recipeImages.findMany()).toHaveLength(0);
    expect(await db.query.recipes.findMany()).toHaveLength(0);
    mocks.photo.mockRejectedValue(new Error('private image host'));
    const failedPhoto = await client.post('/api/recipe-imports', {
      method: 'url',
      url: 'https://example.com/soup',
    });
    expect((await failedPhoto.json()).warnings).toContainEqual(
      expect.objectContaining({ field: 'photo' }),
    );
  });
  it('accepts a screenshot as image content, rejects bad uploads, and retains no image', async () => {
    const png = await sharp({ create: { width: 30, height: 20, channels: 3, background: 'white' } })
      .png()
      .toBuffer();
    const response = await client.putFile(
      '/api/recipe-imports/image',
      new Blob([new Uint8Array(png)], { type: 'image/png' }),
      'recipe.png',
      'image',
    );
    expect(response.status).toBe(200);
    expect((await response.json()).importMethod).toBe('image');
    expect(mocks.provider.mock.calls[0][0].imageDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(await db.query.recipeImages.findMany()).toHaveLength(0);
    const bad = await client.putFile(
      '/api/recipe-imports/image',
      new Blob(['fake'], { type: 'image/png' }),
      'fake.png',
      'image',
    );
    expect(bad.status).toBe(422);
  });
  it('counts actual body bytes even when Content-Length is false', async () => {
    const response = await client.raw('/api/recipe-imports', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': '1' },
      body: JSON.stringify({ method: 'text', text: 'x'.repeat(180_001) }),
    });
    expect(response.status).toBe(422);
    expect(mocks.provider).not.toHaveBeenCalled();
  });
  it('rejects oversized inputs, private URLs and invalid model output without writes', async () => {
    expect(
      (await client.post('/api/recipe-imports', { method: 'text', text: 'x'.repeat(180_001) }))
        .status,
    ).toBe(422);
    expect(
      (await client.post('/api/recipe-imports', { method: 'url', url: 'http://127.0.0.1' })).status,
    ).toBe(422);
    expect(mocks.page).not.toHaveBeenCalled();
    mocks.provider.mockResolvedValue({ value: { name: 'invalid' } });
    expect(
      (await client.post('/api/recipe-imports', { method: 'text', text: 'Soup' })).status,
    ).toBe(422);
    expect(await db.query.recipes.findMany()).toHaveLength(0);
  });
});
