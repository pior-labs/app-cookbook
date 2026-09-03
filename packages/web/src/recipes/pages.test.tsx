import type { RecipeDetail } from '@cookbook/domain';
import { screen, waitFor } from '@testing-library/react';
import { render } from '../../test/render';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EditRecipePage } from './EditRecipePage.jsx';
import { RecipeDetailPage } from './RecipeDetailPage.jsx';

// Page-level loading, error, and version-conflict behaviour
// (technical design sections 11.3 and 14.3).

const RECIPE: RecipeDetail = {
  id: 12,
  name: 'Weeknight Chili',
  description: 'A one-pot chili.',
  categoryId: 1,
  categoryName: 'Dinner',
  prepMinutes: 15,
  cookMinutes: 45,
  totalMinutes: 60,
  rating: { average: null, count: 0 },
  hasImage: false,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
  userState: { favorite: false, rating: null },
  baseServings: 4,
  notes: 'Better the next day.',
  sourceUrl: 'https://example.test/chili',
  sourceText: null,
  createdByUserId: 1,
  version: 3,
  ingredients: [
    {
      id: 1,
      position: 0,
      quantity: { numerator: 3, denominator: 2 },
      unitCode: 'lb',
      unitText: null,
      name: 'Ground beef',
      preparation: null,
    },
  ],
  instructions: [{ id: 1, position: 0, body: 'Brown the beef.' }],
  tags: [{ id: 7, name: 'Weeknight', color: '#6b8db5', createdAt: '', updatedAt: '' }],
  image: null,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function errorResponse(status: number, code: string, message: string, fields = {}): Response {
  return jsonResponse({ error: { code, message, fields } }, status);
}

function renderAt(path: string, element: React.ReactNode, routePath: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={routePath} element={element} />
        <Route path="/" element={<p>Cookbook home</p>} />
        <Route path="/recipes/new" element={<p>New recipe</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

describe('recipe detail page', () => {
  it('shows a skeleton before the recipe arrives, then the recipe', async () => {
    fetchMock.mockResolvedValue(jsonResponse(RECIPE));

    renderAt('/recipes/12', <RecipeDetailPage />, '/recipes/:id');

    expect(screen.getByRole('status')).toHaveTextContent(/loading recipe/i);

    expect(await screen.findByRole('heading', { name: 'Weeknight Chili' })).toBeInTheDocument();
    expect(screen.getByText('Brown the beef.')).toBeInTheDocument();
    expect(screen.getByText(/better the next day/i)).toBeInTheDocument();
  });

  it('opens the source link safely in a new tab', async () => {
    fetchMock.mockResolvedValue(jsonResponse(RECIPE));

    renderAt('/recipes/12', <RecipeDetailPage />, '/recipes/:id');
    const link = await screen.findByRole('link', { name: 'example.test' });

    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('keeps context and offers retry after a network error', async () => {
    const user = userEvent.setup();
    fetchMock.mockRejectedValueOnce(new TypeError('offline'));

    renderAt('/recipes/12', <RecipeDetailPage />, '/recipes/:id');

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not reach the cookbook/i);

    fetchMock.mockResolvedValue(jsonResponse(RECIPE));
    await user.click(screen.getByRole('button', { name: /try again/i }));

    expect(await screen.findByRole('heading', { name: 'Weeknight Chili' })).toBeInTheDocument();
  });

  it('explains a missing recipe without offering a pointless retry', async () => {
    fetchMock.mockResolvedValue(
      errorResponse(404, 'recipe_not_found', 'This recipe does not exist.'),
    );

    renderAt('/recipes/99', <RecipeDetailPage />, '/recipes/:id');

    expect(await screen.findByText(/that recipe is not here/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
  });

  it('rejects a non-numeric id without calling the API', async () => {
    renderAt('/recipes/not-a-number', <RecipeDetailPage />, '/recipes/:id');

    expect(await screen.findByText(/that recipe is not here/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('recipe edit page', () => {
  function mockLoad() {
    fetchMock.mockImplementation((input: string, init?: RequestInit) => {
      if (input.startsWith('/api/categories')) {
        return Promise.resolve(
          jsonResponse([
            { id: 1, name: 'Dinner', activeRecipeCount: 1, createdAt: '', updatedAt: '' },
          ]),
        );
      }
      if (input.startsWith('/api/tags')) return Promise.resolve(jsonResponse([]));
      if (!init?.method) return Promise.resolve(jsonResponse(RECIPE));

      return Promise.resolve(jsonResponse(RECIPE));
    });
  }

  it('seeds the form from the loaded recipe', async () => {
    mockLoad();

    renderAt('/recipes/12/edit', <EditRecipePage />, '/recipes/:id/edit');

    expect(await screen.findByRole('textbox', { name: 'Recipe name' })).toHaveValue(
      'Weeknight Chili',
    );
    expect(screen.getByRole('spinbutton', { name: 'Base servings' })).toHaveValue(4);
    // The saved `1 1/2` round-trips as an editable string, not a decimal.
    expect(screen.getByRole('textbox', { name: 'Amount' })).toHaveValue('1 1/2');
  });

  it('explains a version conflict and never discards the edit', async () => {
    const user = userEvent.setup();
    mockLoad();

    renderAt('/recipes/12/edit', <EditRecipePage />, '/recipes/:id/edit');

    const name = await screen.findByRole('textbox', { name: 'Recipe name' });
    await user.clear(name);
    await user.type(name, 'My renamed chili');

    fetchMock.mockImplementation((input: string, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        return Promise.resolve(
          errorResponse(
            409,
            'recipe_version_conflict',
            'This recipe changed after you opened it.',
          ),
        );
      }
      return Promise.resolve(jsonResponse(RECIPE));
    });

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByText(/someone else saved this recipe first/i)).toBeInTheDocument();
    // The conflict offers a way forward, and the typed name is still there.
    expect(screen.getByRole('button', { name: /reload their version/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /start a separate copy/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Recipe name' })).toHaveValue('My renamed chili');
  });

  it('surfaces server field errors on the offending row', async () => {
    const user = userEvent.setup();
    mockLoad();

    renderAt('/recipes/12/edit', <EditRecipePage />, '/recipes/:id/edit');
    await screen.findByRole('textbox', { name: 'Recipe name' });

    fetchMock.mockImplementation((input: string, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        return Promise.resolve(
          errorResponse(400, 'validation_error', 'Some values need attention.', {
            'ingredients.0.name': ['This ingredient needs a name.'],
          }),
        );
      }
      return Promise.resolve(jsonResponse(RECIPE));
    });

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(screen.getByText('This ingredient needs a name.')).toBeInTheDocument();
    });
  });

  it('blocks client-invalid input before it reaches the API', async () => {
    const user = userEvent.setup();
    mockLoad();

    renderAt('/recipes/12/edit', <EditRecipePage />, '/recipes/:id/edit');

    const name = await screen.findByRole('textbox', { name: 'Recipe name' });
    await user.clear(name);

    const putsBefore = fetchMock.mock.calls.filter(([, init]) => init?.method === 'PUT').length;
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    });
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'PUT')).toHaveLength(
      putsBefore,
    );
  });
});
