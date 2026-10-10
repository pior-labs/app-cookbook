import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '../../test/render';
import { NewRecipePage } from './NewRecipePage.js';
import { draftFromImport, validateCreate } from './form-state.js';
import { createRecipeSchema, type RecipeImportDraft } from '@cookbook/domain';
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
      section: null,
      quantity: null,
      unitCode: 'cup',
      unitText: null,
      preparation: 'chopped',
      originalText: '? cups tomato, chopped',
    },
  ],
  instructions: [{ body: 'Simmer.', section: null }],
  importMethod: 'url',
  sourceUrl: 'https://example.com/soup',
  photoDataUrl: null,
  warnings: [{ field: 'ingredients.0.quantity', message: 'The amount is cropped.' }],
  duplicates: [{ id: 2, name: 'Another tomato soup', reason: 'title' }],
};
let fetchMock: ReturnType<typeof vi.fn>;
let previewDraft: RecipeImportDraft;
beforeEach(() => {
  previewDraft = draft;
  fetchMock = vi.fn(async (path: string, init?: RequestInit) => {
    if (path === '/api/categories')
      return Response.json([{ id: 1, name: 'Dinner', activeRecipeCount: 0 }]);
    if (path === '/api/tags') return Response.json([]);
    if (path === '/api/recipe-imports') return Response.json(previewDraft);
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
  it('shows imported independent headings and saves their edited names', async () => {
    previewDraft = { ...draft, baseServings: 2,
      ingredients: [{ ...draft.ingredients[0], section: 'Sauce', quantity: '1' }],
      instructions: [{ body: 'Simmer.', section: 'Cook' }],
    };
    const user = await preview();
    const heading = screen.getByRole('textbox', { name: 'Ingredient section 1' });
    expect(heading).toHaveValue('Sauce');
    expect(screen.getByRole('textbox', { name: 'Step section 1' })).toHaveValue('Cook');
    await user.clear(heading); await user.type(heading, 'Dressing');
    await user.selectOptions(screen.getByLabelText(/Category/), '1');
    await user.click(screen.getByRole('button', { name: 'Save recipe' }));
    await screen.findByRole('heading', { name: 'Recipe saved' });
    const request = JSON.parse(fetchMock.mock.calls.find(([path]) => path === '/api/recipes')![1]!.body as string);
    expect(request).toMatchObject({ ingredients: [expect.objectContaining({ section: 'Dressing' })], instructions: [{ body: 'Simmer.', section: 'Cook' }] });
  });
  it.each(['keep', 'edit', 'choose known'] as const)(
    'shows an unsupported unit as editable custom text and can save it: %s',
    async (action) => {
      previewDraft = {
        ...draft,
        baseServings: 2,
        ingredients: [{ ...draft.ingredients[0], quantity: '1', unitCode: 'cups' }],
        warnings: [{ field: 'ingredients.0.unitCode', message: 'Unknown unit.' }],
      };
      const user = await preview();
      const unit = screen.getByRole('combobox', { name: 'Unit' });
      expect(unit).toHaveDisplayValue('Custom…');
      expect(screen.getByLabelText('Custom unit')).toHaveValue('cups');

      if (action === 'edit') {
        await user.clear(screen.getByLabelText('Custom unit'));
        await user.type(screen.getByLabelText('Custom unit'), 'scoops');
      } else if (action === 'choose known') {
        await user.selectOptions(unit, 'cup');
        expect(screen.queryByLabelText('Custom unit')).not.toBeInTheDocument();
      }
      await user.selectOptions(screen.getByLabelText(/Category/), '1');
      await user.click(screen.getByRole('button', { name: 'Save recipe' }));
      await screen.findByRole('heading', { name: 'Recipe saved' });

      const sent = fetchMock.mock.calls.find(([path]) => path === '/api/recipes')![1];
      const request = JSON.parse(sent!.body as string);
      expect(createRecipeSchema.safeParse(request).success).toBe(true);
      expect(request.ingredients[0]).toMatchObject({
        unitCode: action === 'choose known' ? 'cup' : null,
        unitText: action === 'choose known' ? null : action === 'edit' ? 'scoops' : 'cups',
        originalText: draft.ingredients[0].originalText,
      });
    },
  );

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

it('keeps long imported durations exact through review and saving', () => {
  const review = draftFromImport({ ...draft, baseServings: 2, prepMinutes: 180, cookMinutes: 90 });
  review.categoryId = '1';
  expect(review.prepMinutes).toBe('3');
  expect(review.prepTimeUnit).toBe('hours');
  expect(review.cookMinutes).toBe('90');
  expect(review.cookTimeUnit).toBe('minutes');
  const result = validateCreate(review);
  expect(result.ok).toBe(true);
  if (result.ok) expect(result.input).toMatchObject({ prepMinutes: 180, cookMinutes: 90 });
});
