import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createServer } from '../src/server.js';
import { createLogger } from '../src/logger.js';
const mocks = vi.hoisted(() => ({
  previewRecipeImport: vi.fn(),
  createRecipe: vi.fn(),
  listCategories: vi.fn(),
}));
vi.mock('@cookbook/api/services', () => mocks);
let client: Client;
const user = { id: 7, name: 'Ada', email: 'ada@example.test' };
const recipe = {
  name: 'Soup',
  description: '',
  categoryId: 1,
  baseServings: 2,
  importMethod: 'text',
  ingredients: [
    { name: 'water', quantity: '1 1/2', unitCode: 'cup', originalText: '1 1/2 cups water', section: 'Sauce' },
  ],
  instructions: [{ body: 'Boil.', section: 'Simmer' }],
};
beforeEach(async () => {
  const { server } = createServer(user, createLogger('error'));
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: 'test', version: '0.0.0' });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
});
afterEach(async () => {
  await client.close();
  vi.resetAllMocks();
});
it('returns a structured unsaved preview and categories without invoking creation', async () => {
  const { categoryId: _categoryId, ...previewRecipe } = recipe;
  mocks.previewRecipeImport.mockResolvedValue({
    ...previewRecipe,
    prepMinutes: null,
    cookMinutes: null,
    notes: null,
    sourceUrl: null,
    photoDataUrl: null,
    warnings: [],
    duplicates: [],
    ingredients: [{ ...recipe.ingredients[0], unitText: null, preparation: null }],
  });
  mocks.listCategories.mockResolvedValue([{ id: 1, name: 'Dinner' }]);
  const result = await client.callTool({
    name: 'preview_recipe_import',
    arguments: { text: '1 1/2 cups water. Boil.' },
  });
  expect(result.isError).not.toBe(true);
  expect(result.structuredContent).toMatchObject({
    draft: { name: 'Soup', ingredients: [expect.objectContaining({ section: 'Sauce' })], instructions: [expect.objectContaining({ section: 'Simmer' })] },
    categories: [{ id: 1, name: 'Dinner' }],
  });
  expect(mocks.previewRecipeImport).toHaveBeenCalledWith(
    { method: 'text', text: '1 1/2 cups water. Boil.' },
    { includePhoto: false },
  );
  expect(mocks.createRecipe).not.toHaveBeenCalled();
});
it('rejects missing/false confirmation and malformed recipe amounts', async () => {
  for (const args of [
    { recipe },
    { recipe, confirmed: false },
    { recipe: { ...recipe, ingredients: [{ name: 'water', quantity: 'guess' }] }, confirmed: true },
  ]) {
    const result = await client.callTool({ name: 'create_recipe', arguments: args });
    expect(result.isError).toBe(true);
  }
  expect(mocks.createRecipe).not.toHaveBeenCalled();
});
it('parses an approved recipe once and attributes it to the configured member', async () => {
  mocks.createRecipe.mockResolvedValue({ id: 12, name: 'Soup' });
  const result = await client.callTool({
    name: 'create_recipe',
    arguments: { recipe, confirmed: true },
  });
  expect(result.isError).not.toBe(true);
  expect(mocks.createRecipe).toHaveBeenCalledWith(
    expect.objectContaining({
      importMethod: 'text',
      ingredients: [
        expect.objectContaining({
          quantity: { numerator: 3, denominator: 2 },
          originalText: '1 1/2 cups water',
          section: 'Sauce',
        }),
      ],
      instructions: [{ body: 'Boil.', section: 'Simmer' }],
    }),
    user.id,
  );
});
it('limits section names after trimming, using the shared recipe validation', async () => {
  mocks.createRecipe.mockResolvedValue({ id: 12, name: 'Soup' });
  const section = 'x'.repeat(80);
  const approved = { ...recipe,
    ingredients: [{ ...recipe.ingredients[0], section: `  ${section}  ` }],
    instructions: [{ body: 'Boil.', section: '   ' }],
  };
  expect((await client.callTool({ name: 'create_recipe', arguments: { recipe: approved, confirmed: true } })).isError).not.toBe(true);
  expect(mocks.createRecipe).toHaveBeenCalledWith(expect.objectContaining({
    ingredients: [expect.objectContaining({ section })],
    instructions: [{ body: 'Boil.', section: null }],
  }), user.id);
  const rejected = await client.callTool({ name: 'create_recipe', arguments: { confirmed: true,
    recipe: { ...approved, instructions: [{ body: 'Boil.', section: 'x'.repeat(81) }] },
  } });
  expect(rejected.isError).toBe(true);
  expect(JSON.stringify(rejected.content)).toContain('instructions.0.section');
  expect(mocks.createRecipe).toHaveBeenCalledTimes(1);
});
it('requires exactly one source', async () => {
  for (const args of [{}, { url: 'https://example.com', text: 'Soup' }]) {
    expect(
      (await client.callTool({ name: 'preview_recipe_import', arguments: args })).isError,
    ).toBe(true);
  }
  expect(mocks.previewRecipeImport).not.toHaveBeenCalled();
});
it('does not disclose database errors', async () => {
  mocks.createRecipe.mockRejectedValue(new Error('password=secret SQL INSERT Soup'));
  const result = await client.callTool({
    name: 'create_recipe',
    arguments: { recipe, confirmed: true },
  });
  expect(result.isError).toBe(true);
  expect(JSON.stringify(result)).not.toMatch(/secret|SQL/);
});
