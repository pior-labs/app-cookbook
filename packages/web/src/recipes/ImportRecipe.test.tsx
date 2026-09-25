import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '../../test/render';
import { NewRecipePage } from './NewRecipePage.js';
import { draftFromImport, validateCreate } from './form-state.js';
import type { RecipeImportDraft } from '@cookbook/domain';
const draft: RecipeImportDraft = {
  name: 'Tomato soup',
  description: '',
  baseServings: null,
  prepMinutes: null,
  cookMinutes: 15,
  notes: null,
  ingredients: [
    {
      name: 'tomato',
      quantity: null,
      unitCode: 'cup',
      unitText: null,
      preparation: 'chopped',
      originalText: '? cups tomato, chopped',
    },
  ],
  instructions: [{ body: 'Simmer.' }],
  importMethod: 'url',
  sourceUrl: 'https://example.com/soup',
  photoDataUrl: null,
  warnings: [{ field: 'ingredients.0.quantity', message: 'The amount is cropped.' }],
  duplicates: [{ id: 2, name: 'Another tomato soup', reason: 'title' }],
};
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn(async (path: string, init?: RequestInit) => {
    if (path === '/api/categories')
      return Response.json([{ id: 1, name: 'Dinner', activeRecipeCount: 0 }]);
    if (path === '/api/tags') return Response.json([]);
    if (path === '/api/recipe-imports') return Response.json(draft);
    if (path === '/api/recipes' && init?.method === 'POST') return Response.json({ id: 9 });
    throw new Error(`Unexpected ${path}`);
  });
  vi.stubGlobal('fetch', fetchMock);
});
function mount() {
  render(
    <MemoryRouter>
      <NewRecipePage />
    </MemoryRouter>,
  );
}
async function preview() {
  const user = userEvent.setup();
  mount();
  await user.type(screen.getByLabelText('Recipe link'), 'https://example.com/soup');
  await user.click(screen.getByRole('button', { name: 'Preview recipe' }));
  await screen.findByRole('heading', { name: 'Review your import' });
  return user;
}
describe('import review', () => {
  it('retains unknown amounts, attribution and wording through normal validation', () => {
    const state = draftFromImport(draft);
    expect(state.baseServings).toBe('');
    expect(state.ingredients[0].quantity).toBe('');
    expect(validateCreate(state).ok).toBe(false);
    state.baseServings = '2';
    state.categoryId = '1';
    state.ingredients[0].quantity = '1 1/2';
    expect(validateCreate(state)).toMatchObject({
      ok: true,
      input: {
        importMethod: 'url',
        sourceUrl: draft.sourceUrl,
        ingredients: [{ originalText: '? cups tomato, chopped', quantity: '1 1/2' }],
      },
    });
  });
  it('previews without creating, highlights uncertainty and duplicates, then saves the edited draft', async () => {
    const user = await preview();
    expect(screen.getByText('The amount is cropped.')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Another tomato soup' })).toBeVisible();
    expect(screen.getByLabelText(/Base servings/)).toHaveValue(null);
    expect(fetchMock.mock.calls.some(([path]) => path === '/api/recipes')).toBe(false);
    await user.type(screen.getByLabelText(/Base servings/), '2');
    await user.selectOptions(screen.getByLabelText(/Category/), '1');
    await user.type(screen.getByRole('textbox', { name: 'Amount' }), '1 1/2');
    await user.click(screen.getByRole('button', { name: 'Save recipe' }));
    await screen.findByRole('heading', { name: 'Recipe saved' });
    const sent = fetchMock.mock.calls.find(([path]) => path === '/api/recipes')![1];
    expect(JSON.parse(sent!.body as string)).toMatchObject({
      baseServings: 2,
      importMethod: 'url',
      sourceUrl: draft.sourceUrl,
    });
  });
  it('cancel creates nothing and a failed import offers manual entry', async () => {
    const user = await preview();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(fetchMock.mock.calls.some(([path]) => path === '/api/recipes')).toBe(false);
  });
  it('keeps the source input on failure and lets the cook enter manually', async () => {
    fetchMock.mockImplementation(async (path: string) =>
      path === '/api/recipe-imports'
        ? Response.json(
            { error: { message: 'This page is blocked.', code: 'import_failed', fields: {} } },
            { status: 422 },
          )
        : Response.json([]),
    );
    const user = userEvent.setup();
    mount();
    await user.type(screen.getByLabelText('Recipe link'), 'https://example.com/soup');
    await user.click(screen.getByRole('button', { name: 'Preview recipe' }));
    await screen.findByRole('alert');
    expect(screen.getByLabelText('Recipe link')).toHaveValue('https://example.com/soup');
    await user.click(screen.getByRole('button', { name: 'Enter manually' }));
    await waitFor(() => expect(screen.getByLabelText(/Recipe name/)).toHaveValue(''));
  });
});
